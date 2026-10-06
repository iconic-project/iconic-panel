<script setup lang="ts">
import type {
  Booking,
  BookingFormOptions,
  HoldListItem,
  HoldListRules,
  PreferredChannel,
  WaitlistEntry
} from '../../../types/api'
import BookingPanel from '../../../components/bookings/BookingPanel.vue'
import ReasonModal from '../../../components/bookings/ReasonModal.vue'
import AddWaitlistModal from '../../../components/holds/AddWaitlistModal.vue'
import NotifyWaitlistModal from '../../../components/holds/NotifyWaitlistModal.vue'
import { formatHoldRemaining, holdTypePill, waitlistRowStatus } from '../../../components/requests/requestHelpers'
import { firstApiMessage } from '../../../utils/apiForm'

const POLL_MS = 5 * 60 * 1000

type HoldsPayload = {
  data: Array<HoldListItem>
  meta: {
    rules: HoldListRules
  }
}

const { can } = useAuth()
const { t } = useI18n()
const { useFetch, request } = useApi()
const { format } = useDates()
const toast = useToast()

const canCreate = computed(() => can('bookings.create'))

const panelOpen = ref(false)
const selected = ref<Booking | null>(null)
const addOpen = ref(false)
const notifyOpen = ref(false)
const notifyTarget = ref<WaitlistEntry | null>(null)
const notifySubmitting = ref(false)
const notifyError = ref('')
const removeOpen = ref(false)
const removeTarget = ref<WaitlistEntry | null>(null)
const removeSubmitting = ref(false)
const removeError = ref('')
const options = ref<BookingFormOptions | null>(null)

const holdsUrl = '/api/rms/holds'
const waitlistUrl = '/api/rms/waitlist'

const { data: holdsPayload, refresh: refreshHolds } = useFetch<HoldsPayload>(holdsUrl)
const { data: waitlistPayload, refresh: refreshWaitlist } = useFetch<{ data: Array<WaitlistEntry> }>(waitlistUrl)

const holds = computed(() => holdsPayload.value?.data ?? [])
const waitlist = computed(() => waitlistPayload.value?.data ?? [])
const dayMinutes = computed(() => holdsPayload.value?.meta.rules.business_day_minutes ?? 0)

function holdExpires(row: HoldListItem): string {
  return formatHoldRemaining(row.remaining_business_minutes, dayMinutes.value, row.remaining_business_minutes <= 0)
}

function stayLabel(row: WaitlistEntry): string {
  return `${format(row.stay.check_in, 'short')} – ${format(row.stay.check_out, 'short')}`
}

function notifiedLine(row: WaitlistEntry): string {
  if (row.notified === null || row.notified.at === null) {
    return ''
  }

  const date = format(row.notified.at, 'short')

  if (row.auto_notified) {
    return t('holds.notifiedSystem', { date })
  }

  return t('holds.notifiedLine', {
    date,
    channel: row.notified.channel ?? '',
    name: row.notified.by
  })
}

async function openHold(row: HoldListItem): Promise<void> {
  if (row.booking_id === null) {
    return
  }

  selected.value = await request(`/api/rms/bookings/${String(row.booking_id)}`) as Booking
  panelOpen.value = true
}

async function startNotify(row: WaitlistEntry): Promise<void> {
  notifyError.value = ''
  notifyTarget.value = row

  if (options.value === null) {
    options.value = await request('/api/rms/bookings/form-options') as BookingFormOptions
  }

  notifyOpen.value = true
}

function startRemove(row: WaitlistEntry): void {
  removeError.value = ''
  removeTarget.value = row
  removeOpen.value = true
}

async function onNotify(channel: PreferredChannel): Promise<void> {
  if (notifyTarget.value === null) {
    return
  }

  notifySubmitting.value = true
  notifyError.value = ''

  try {
    await request(`/api/rms/waitlist/${String(notifyTarget.value.id)}/notify`, {
      method: 'POST',
      body: { channel }
    })
    toast.add({ title: t('holds.notifiedToast') })
    notifyOpen.value = false
    await refreshWaitlist()
  } catch (error: unknown) {
    notifyError.value = firstApiMessage(error) ?? (error instanceof Error ? error.message : '')
  } finally {
    notifySubmitting.value = false
  }
}

async function onRemove(reason: string): Promise<void> {
  if (removeTarget.value === null) {
    return
  }

  removeSubmitting.value = true
  removeError.value = ''

  try {
    await request(`/api/rms/waitlist/${String(removeTarget.value.id)}/remove`, {
      method: 'POST',
      body: { reason }
    })
    toast.add({ title: t('holds.removedToast') })
    removeOpen.value = false
    await refreshWaitlist()
  } catch (error: unknown) {
    removeError.value = firstApiMessage(error) ?? (error instanceof Error ? error.message : '')
  } finally {
    removeSubmitting.value = false
  }
}

onMounted(() => {
  const timer = window.setInterval(() => {
    void refreshHolds()
    void refreshWaitlist()
  }, POLL_MS)

  onUnmounted(() => {
    window.clearInterval(timer)
  })
})
</script>

<template>
  <div>
    <div class="panel">
      <h3>{{ t('holds.holdsTitle') }}</h3>
      <div class="bk-table-wrap">
        <table class="list">
          <thead>
            <tr>
              <th>{{ t('holds.colType') }}</th>
              <th>{{ t('holds.colClient') }}</th>
              <th>{{ t('holds.colStay') }}</th>
              <th>{{ t('bookings.colRoom') }}</th>
              <th>{{ t('holds.colExpires') }}</th>
              <th>{{ t('holds.colRule') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-if="holds.length === 0"
              class="dr-empty"
            >
              <td colspan="6">
                {{ t('holds.holdsEmpty') }}
              </td>
            </tr>
            <tr
              v-for="row in holds"
              :key="`${row.type}-${row.reference ?? row.client}`"
              class="bk-row"
              @click="openHold(row)"
            >
              <td>
                <span class="pill p-hold">{{ holdTypePill(row.type) }}</span>
              </td>
              <td>{{ row.client }}</td>
              <td>{{ format(row.stay.check_in, 'short') }} · {{ row.stay.property.name }}</td>
              <td>{{ row.room }}</td>
              <td class="hold-expires">
                {{ holdExpires(row) }}
              </td>
              <td>{{ row.rule }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <div class="panel">
      <div class="bk-toolbar">
        <h3>{{ t('holds.waitlistTitle') }}</h3>
        <UButton
          v-if="canCreate"
          @click="addOpen = true"
        >
          {{ t('holds.add') }}
        </UButton>
      </div>
      <div class="bk-table-wrap">
        <table class="list">
          <thead>
            <tr>
              <th>{{ t('holds.colWaitContact') }}</th>
              <th>{{ t('holds.colStay') }}</th>
              <th>{{ t('bookings.roomType') }}</th>
              <th>{{ t('holds.colPosition') }}</th>
              <th>{{ t('holds.colSince') }}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            <tr
              v-if="waitlist.length === 0"
              class="dr-empty"
            >
              <td colspan="6">
                {{ t('holds.waitlistEmpty') }}
              </td>
            </tr>
            <tr
              v-for="row in waitlist"
              :key="row.id"
            >
              <td>{{ row.contact.email ?? row.contact.name }}</td>
              <td>{{ stayLabel(row) }}</td>
              <td>{{ row.stay.room_type.name }}</td>
              <td>{{ row.position ?? '—' }}</td>
              <td>{{ format(row.since, 'short') }}</td>
              <td>
                <div
                  v-if="waitlistRowStatus(row) === 'room_free'"
                  class="wl-free"
                >
                  {{ t('holds.roomFree') }}
                </div>
                <div
                  v-if="waitlistRowStatus(row) === 'notified'"
                  class="wl-notified"
                >
                  {{ notifiedLine(row) }}
                </div>
                <div
                  v-if="canCreate"
                  class="list-actions"
                >
                  <UButton
                    v-if="waitlistRowStatus(row) !== 'notified'"
                    variant="outline"
                    @click="startNotify(row)"
                  >
                    {{ t('holds.markNotified') }}
                  </UButton>
                  <UButton
                    variant="outline"
                    @click="startRemove(row)"
                  >
                    {{ t('holds.remove') }}
                  </UButton>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <p class="mono">
        {{ t('holds.waitlistRule') }}
      </p>
    </div>

    <BookingPanel
      v-model:open="panelOpen"
      :booking="selected"
      :business-day-minutes="dayMinutes"
    />

    <AddWaitlistModal
      v-model:open="addOpen"
      @created="() => { void refreshWaitlist() }"
    />

    <NotifyWaitlistModal
      v-model:open="notifyOpen"
      :options="options"
      :submitting="notifySubmitting"
      :error="notifyError"
      @submit="onNotify"
    />

    <ReasonModal
      v-model:open="removeOpen"
      :title="t('holds.removeTitle')"
      hint="required"
      :submitting="removeSubmitting"
      :error="removeError"
      @submit="onRemove"
    />
  </div>
</template>
