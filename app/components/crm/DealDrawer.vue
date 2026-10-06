<script setup lang="ts">
import type { AttributionTouch } from '#iconic-ui/app/types'
import type {
  ContactBooking,
  ContactProfile,
  DealDetail,
  MoveDealInput,
  Paginated,
  StageMapRow,
  TimelineItem
} from '../../types/api'
import { firstApiMessage } from '../../utils/apiForm'
import { formatAttribution } from './contactHelpers'
import LogActivityModal from './LogActivityModal.vue'
import ReasonModal from '../bookings/ReasonModal.vue'
import { slaBadge } from './salesHelpers'

const open = defineModel<boolean>('open', { required: true })

const props = defineProps<{
  dealId: number | null
  revision: number
}>()

const emit = defineEmits<{
  changed: []
}>()

const MOVES: Array<MoveDealInput['stage']> = ['NEW_LEAD', 'QUALIFYING', 'QUOTED', 'NEGOTIATION', 'LOST']

const { t } = useI18n()
const { request } = useApi()
const { format } = useMoney()
const { format: formatDate } = useDates()
const { can } = useAuth()
const toast = useToast()

const deal = ref<DealDetail | null>(null)
const stageLabel = ref('')
const timeline = ref<Array<TimelineItem>>([])
const bookings = ref<Array<ContactBooking>>([])
const bindId = ref('')
const activityOpen = ref(false)
const lostOpen = ref(false)
const lostSubmitting = ref(false)
const lostError = ref('')
const pendingStage = ref<MoveDealInput['stage'] | null>(null)
const error = ref('')

const canAct = computed(() => can('pipeline.move_stage'))
const canLog = computed(() => can('contacts.manage'))
const unbound = computed(() => deal.value !== null && deal.value.booking === null)
const badge = computed(() => slaBadge(deal.value?.sla.state ?? null))

const moveItems = computed(() => MOVES.map(stage => ({
  label: t(`crmPipeline.stages.${stage}`),
  value: stage
})))

const bindItems = computed(() => bookings.value.map(booking => ({
  label: booking.display_reference ?? String(booking.id),
  value: String(booking.id)
})))

watch(
  () => [open.value, props.dealId, props.revision] as const,
  async ([isOpen, id]) => {
    if (!isOpen || id === null) {
      return
    }

    await load(id)
  }
)

async function load(id: number): Promise<void> {
  error.value = ''
  const [detail, map] = await Promise.all([
    request(`/api/crm/deals/${String(id)}`) as Promise<DealDetail>,
    request('/api/crm/pipeline/stage-map') as Promise<{ data: Array<StageMapRow> }>
  ])
  deal.value = detail
  stageLabel.value = map.data.find(row => row.stage === detail.stage)?.label ?? detail.stage
  const page = await request(`/api/crm/contacts/${String(detail.contact_id)}/timeline?per_page=100`) as Paginated<TimelineItem>
  timeline.value = page.data.filter(item => item.link?.type === 'deal' && item.link.id === detail.id)

  if (detail.booking === null) {
    const profile = await request(`/api/crm/contacts/${String(detail.contact_id)}`) as ContactProfile
    bookings.value = profile.bookings
  } else {
    bookings.value = []
  }
}

function touchLabel(value: { [key: string]: unknown } | null): string {
  if (value === null) {
    return '—'
  }

  const touch: AttributionTouch = {
    source: typeof value.source === 'string' ? value.source : undefined,
    medium: typeof value.medium === 'string' ? value.medium : undefined,
    campaign: typeof value.campaign === 'string' ? value.campaign : undefined,
    content: typeof value.content === 'string' ? value.content : undefined,
    term: typeof value.term === 'string' ? value.term : undefined,
    landing_path: typeof value.landing_path === 'string' ? value.landing_path : undefined
  }

  return formatAttribution(touch)
}

async function take(): Promise<void> {
  if (deal.value === null) {
    return
  }

  try {
    deal.value = await request(`/api/crm/deals/${String(deal.value.id)}/assign`, {
      method: 'POST',
      body: {}
    }) as DealDetail
    emit('changed')
  } catch (caught: unknown) {
    error.value = firstApiMessage(caught) ?? t('crmPipeline.moveFailed')
  }
}

async function bind(): Promise<void> {
  if (deal.value === null || bindId.value === '') {
    return
  }

  try {
    deal.value = await request(`/api/crm/deals/${String(deal.value.id)}/bind`, {
      method: 'POST',
      body: { booking_id: Number(bindId.value) }
    }) as DealDetail
    bindId.value = ''
    emit('changed')
    await load(deal.value.id)
  } catch (caught: unknown) {
    error.value = firstApiMessage(caught) ?? t('crmPipeline.moveFailed')
  }
}

function onMoveChange(stage: string | number | boolean | null | undefined): void {
  if (typeof stage !== 'string' || stage === '') {
    return
  }

  askMove(stage)
}

function askMove(stage: string): void {
  if (!MOVES.includes(stage as MoveDealInput['stage'])) {
    return
  }

  const next = stage as MoveDealInput['stage']

  if (next === 'LOST') {
    pendingStage.value = next
    lostError.value = ''
    lostOpen.value = true
    return
  }

  void move(next, null)
}

async function move(stage: MoveDealInput['stage'], reason: string | null): Promise<void> {
  if (deal.value === null) {
    return
  }

  try {
    deal.value = await request(`/api/crm/deals/${String(deal.value.id)}/stage`, {
      method: 'PATCH',
      body: { stage, reason }
    }) as DealDetail
    emit('changed')
  } catch (caught: unknown) {
    const message = firstApiMessage(caught) ?? t('crmPipeline.moveFailed')

    if (lostOpen.value) {
      lostError.value = message
    } else {
      toast.add({ title: message })
    }
  }
}

async function submitLost(reason: string): Promise<void> {
  if (pendingStage.value === null) {
    return
  }

  lostSubmitting.value = true
  lostError.value = ''

  try {
    await move(pendingStage.value, reason)

    if (lostError.value === '') {
      lostOpen.value = false
      pendingStage.value = null
    }
  } finally {
    lostSubmitting.value = false
  }
}
</script>

<template>
  <USlideover
    :open="open"
    class="history-drawer"
    @update:open="open = $event"
  >
    <template #header>
      <div v-if="deal">
        <h2>{{ deal.title }}</h2>
        <div class="bid">
          {{ stageLabel }}
          ·
          {{ deal.owner?.name ?? t('crmPipeline.unassigned') }}
        </div>
      </div>
    </template>
    <template #body>
      <div
        v-if="deal"
        class="crm-deal"
      >
        <p
          v-if="error"
          class="warnbox"
        >
          {{ error }}
        </p>
        <p class="crm-held">
          {{ stageLabel }}
          ·
          {{ deal.owner?.name ?? t('crmPipeline.unassigned') }}
        </p>
        <p class="card-val">
          {{ format(deal.value) }}
          <span>{{ deal.value_label }}</span>
        </p>
        <p class="crm-held">
          <span
            v-if="badge"
            class="slabadge"
            :class="deal.sla.state ?? 'ok'"
          >{{ badge }}</span>
          {{ deal.sla.label }}
        </p>
        <p
          v-if="deal.booking"
          class="rmsref"
        >
          {{ deal.booking.reference }}
          · {{ deal.booking.status }}
          · {{ formatDate(deal.booking.check_in, 'short') }} – {{ formatDate(deal.booking.check_out, 'short') }}
          · {{ t('crmPipeline.nights', { nights: String(deal.booking.nights) }) }}
          <template v-if="deal.booking.room_type">
            · {{ deal.booking.room_type }}
          </template>
          <template v-if="deal.booking.property_name">
            · {{ deal.booking.property_name }}
          </template>
          · {{ format(deal.booking.charges_total) }}
          · {{ t('crmPipeline.paid') }} {{ format(deal.booking.paid) }}
          · {{ t('crmPipeline.balance') }} {{ format(deal.booking.balance) }}
        </p>
        <p
          v-else
          class="rmsref none"
        >
          {{ t('crmPipeline.noRmsYet') }}
        </p>
        <p
          v-if="deal.booking?.agency"
          class="crm-held"
        >
          {{ t('crmPipeline.partner') }}: {{ deal.booking.agency.name }}
        </p>
        <p
          v-if="deal.booking && deal.booking.offer_codes.length > 0"
          class="crm-held"
        >
          {{ t('crmPipeline.offer') }}: {{ deal.booking.offer_codes.join(', ') }}
        </p>
        <p
          v-if="deal.booking"
          class="crm-held"
        >
          {{ deal.booking.main_channel }} · {{ deal.booking.channel_of_origin }}
          · {{ touchLabel(deal.booking.utm_first) }}
        </p>
        <div class="sec">
          <h4>{{ t('crmPipeline.searches') }}</h4>
          <ul v-if="deal.searches.length > 0">
            <li
              v-for="search in deal.searches"
              :key="`${search.at}-${search.name}`"
            >
              {{ search.name }}
              <template v-if="search.detail">
                · {{ search.detail }}
              </template>
            </li>
          </ul>
          <p
            v-else
            class="crm-held"
          >
            {{ t('crmPipeline.noSearches') }}
          </p>
        </div>

        <div
          v-if="canAct && unbound"
          class="field"
        >
          <label for="drawer-move">{{ t('crmPipeline.moveTo') }}</label>
          <USelect
            id="drawer-move"
            :model-value="''"
            class="w-full"
            :placeholder="t('crmPipeline.moveTo')"
            :items="moveItems"
            @update:model-value="onMoveChange"
          />
        </div>

        <div class="crm-deal-actions">
          <UButton
            v-if="canAct && deal.owner === null"
            variant="outline"
            @click="take"
          >
            {{ t('crmPipeline.take') }}
          </UButton>
          <UButton
            v-if="canLog"
            variant="outline"
            @click="activityOpen = true"
          >
            {{ t('crmPipeline.logActivity') }}
          </UButton>
          <NuxtLink
            v-if="deal.booking"
            class="lnk"
            :to="`/rms/reservations/bookings?open=${deal.booking.reference}`"
          >
            {{ t('crmPipeline.openBooking') }}
          </NuxtLink>
          <NuxtLink
            class="lnk"
            :to="`/crm/sales/contacts?open=${String(deal.contact_id)}`"
          >
            {{ t('crmPipeline.openContact') }}
          </NuxtLink>
          <NuxtLink
            class="lnk"
            to="/rms/reservations/bookings?new=1"
          >
            {{ t('crmPipeline.createQuote') }}
          </NuxtLink>
        </div>

        <div
          v-if="canAct && unbound && bookings.length > 0"
          class="field"
        >
          <label for="drawer-bind">{{ t('crmPipeline.bind') }}</label>
          <div class="crm-inline">
            <USelect
              id="drawer-bind"
              v-model="bindId"
              class="w-full"
              :placeholder="t('crmPipeline.pickBooking')"
              :items="bindItems"
            />
            <UButton
              variant="outline"
              :disabled="bindId === ''"
              @click="bind"
            >
              {{ t('crmPipeline.bind') }}
            </UButton>
          </div>
        </div>

        <div class="sec">
          <h4>{{ t('crmContacts.timelineTitle') }}</h4>
          <p
            v-if="timeline.length === 0"
            class="crm-held"
          >
            {{ t('crmContacts.timelineEmpty') }}
          </p>
          <div
            v-else
            class="crm-tl"
          >
            <div
              v-for="item in timeline"
              :key="`${item.at}-${item.title}`"
              class="crm-ev"
            >
              <span class="t">{{ formatDate(item.at, 'dateTime') }}</span>
              <div class="crm-ev-title">
                {{ item.title }}
              </div>
              <div
                v-if="item.detail !== ''"
                class="crm-held"
              >
                {{ item.detail }}
              </div>
            </div>
          </div>
        </div>
      </div>
    </template>
  </USlideover>

  <LogActivityModal
    v-model:open="activityOpen"
    :contact-id="deal?.contact_id ?? null"
    :deal-id="deal?.id ?? null"
    @saved="deal && load(deal.id)"
  />
  <ReasonModal
    v-model:open="lostOpen"
    :title="t('crmPipeline.lostTitle')"
    hint="required"
    :submitting="lostSubmitting"
    :error="lostError"
    @submit="submitLost"
  />
</template>
