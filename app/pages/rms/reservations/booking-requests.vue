<script setup lang="ts">
import type { Booking, RequestQueueItem, RequestQueueRules } from '../../../types/api'
import DateRangeFilter from '../../../components/lists/DateRangeFilter.vue'
import BookingPanel from '../../../components/bookings/BookingPanel.vue'
import ReasonModal from '../../../components/bookings/ReasonModal.vue'
import ConfirmRequestModal from '../../../components/requests/ConfirmRequestModal.vue'
import CharterEnquiriesPanel from '../../../components/requests/CharterEnquiriesPanel.vue'
import { confirmRequest, releaseRequest } from '../../../components/bookings/requestActions'
import {
  formatHoldRemaining,
  formatSla,
  slaRemainingMinutes,
  viaChannel
} from '../../../components/requests/requestHelpers'
import { firstApiMessage } from '../../../utils/apiForm'

const POLL_MS = 5 * 60 * 1000

type QueuePayload = {
  data: Array<RequestQueueItem>
  meta: {
    rules: RequestQueueRules
  }
}

const { can } = useAuth()
const { t } = useI18n()
const { useFetch, request } = useApi()
const { format } = useDates()
const { format: money } = useMoney()
const toast = useToast()
const { count: openCount, rules: sharedRules, refresh: refreshBadge } = useOpenRequests()
const { now, start: startSlaTick } = useSlaNow()

const from = ref<string | null>(null)
const to = ref<string | null>(null)
const today = computed(() => format(new Date(), 'iso'))

const panelOpen = ref(false)
const selected = ref<Booking | null>(null)
const confirmOpen = ref(false)
const confirmTarget = ref<RequestQueueItem | null>(null)
const confirmBooking = ref<Booking | null>(null)
const confirmSubmitting = ref(false)
const confirmError = ref('')
const releaseOpen = ref(false)
const releaseTarget = ref<RequestQueueItem | null>(null)
const releaseSubmitting = ref(false)
const releaseError = ref('')

const listUrl = computed(() => {
  const params = new URLSearchParams()

  if (from.value !== null) {
    params.set('from', from.value)
  }

  if (to.value !== null) {
    params.set('to', to.value)
  }

  const query = params.toString()

  return query === '' ? '/api/rms/requests' : `/api/rms/requests?${query}`
})

const { data: listPayload, refresh } = useFetch<QueuePayload>(listUrl)

const rows = computed(() => listPayload.value?.data ?? [])
const rules = computed(() => listPayload.value?.meta.rules ?? sharedRules.value)
const dayMinutes = computed(() => rules.value?.business_day_minutes ?? 0)
const total = computed(() => rows.value.length)

function slaOf(row: RequestQueueItem) {
  return formatSla(slaRemainingMinutes(row.sla.due_at, now.value))
}

function holdOf(row: RequestQueueItem): string {
  return formatHoldRemaining(
    row.hold.remaining_business_minutes,
    dayMinutes.value,
    row.hold.expired
  )
}

function canConfirmRow(row: RequestQueueItem): boolean {
  return row.can_act && can('requests.confirm')
}

function canReleaseRow(row: RequestQueueItem): boolean {
  return row.can_act && can('requests.release')
}

async function openBooking(id: number): Promise<void> {
  selected.value = await request(`/api/rms/bookings/${String(id)}`) as Booking
  panelOpen.value = true
}

async function startConfirm(row: RequestQueueItem, event: Event): Promise<void> {
  event.stopPropagation()
  confirmError.value = ''
  confirmTarget.value = row
  confirmBooking.value = await request(`/api/rms/bookings/${String(row.id)}`) as Booking
  confirmOpen.value = true
}

function startRelease(row: RequestQueueItem, event: Event): void {
  event.stopPropagation()
  releaseError.value = ''
  releaseTarget.value = row
  releaseOpen.value = true
}

async function onConfirm(): Promise<void> {
  if (confirmTarget.value === null) {
    return
  }

  confirmSubmitting.value = true
  confirmError.value = ''

  try {
    await confirmRequest(request, confirmTarget.value.id)
    toast.add({ title: t('bookings.confirmedToast') })
    confirmOpen.value = false
    await Promise.all([refresh(), refreshBadge()])
  } catch (error: unknown) {
    confirmError.value = firstApiMessage(error) ?? (error instanceof Error ? error.message : '')
  } finally {
    confirmSubmitting.value = false
  }
}

async function onRelease(reason: string): Promise<void> {
  if (releaseTarget.value === null) {
    return
  }

  releaseSubmitting.value = true
  releaseError.value = ''

  try {
    await releaseRequest(request, releaseTarget.value.id, reason)
    toast.add({ title: t('requests.releasedToast') })
    releaseOpen.value = false
    await Promise.all([refresh(), refreshBadge()])
  } catch (error: unknown) {
    releaseError.value = firstApiMessage(error) ?? (error instanceof Error ? error.message : '')
  } finally {
    releaseSubmitting.value = false
  }
}

async function onPanelUpdated(): Promise<void> {
  await Promise.all([refresh(), refreshBadge()])
}

onMounted(() => {
  startSlaTick()
  void refreshBadge()
  const timer = window.setInterval(() => {
    void refresh()
  }, POLL_MS)

  onUnmounted(() => {
    window.clearInterval(timer)
  })
})
</script>

<template>
  <div>
    <DateRangeFilter
      v-model:from="from"
      v-model:to="to"
      :field-label="t('requests.fieldLabel')"
      :noun="t('requests.noun')"
      :total="total"
      :today="today"
    />

    <i18n-t
      v-if="rules"
      keypath="requests.notice"
      tag="p"
      class="notice req-notice"
    >
      <template #status>
        <b>REQUESTED</b>
      </template>
      <template #near>
        {{ rules.near_term_business_hours }}
      </template>
      <template #long>
        {{ rules.long_lead_business_days }}
      </template>
      <template #sla>
        <b>{{ t('requests.noticeSla', { hours: String(rules.response_hours) }) }}</b>
      </template>
      <template #pct>
        {{ rules.cabin_deposit_pct }}
      </template>
    </i18n-t>

    <div class="panel">
      <h3>{{ t('requests.panelTitle') }}</h3>
      <div class="bk-table-wrap">
        <table class="list">
          <thead>
            <tr>
              <th>{{ t('requests.colRequest') }}</th>
              <th>{{ t('requests.colContact') }}</th>
              <th>{{ t('requests.colParty') }}</th>
              <th>{{ t('requests.colStay') }}</th>
              <th>{{ t('requests.colValue') }}</th>
              <th>{{ t('requests.colHold') }}</th>
              <th>{{ t('requests.colSla') }}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            <tr
              v-if="rows.length === 0"
              class="dr-empty"
            >
              <td colspan="8">
                {{ openCount > 0 ? t('requests.emptyRange') : t('requests.emptyAll') }}
              </td>
            </tr>
            <tr
              v-for="row in rows"
              :key="row.id"
              class="bk-row"
              @click="openBooking(row.id)"
            >
              <td class="req-ref">
                {{ row.display_reference }}
              </td>
              <td>
                {{ row.contact.name }}
                <span
                  v-if="row.travel_advisor"
                  class="pill"
                >{{ t('requests.advisor') }}</span>
                <div class="bk-sub via">
                  {{ viaChannel(row.contact.preferred_channel) }}
                </div>
                <div
                  v-if="row.source === 'portal'"
                  class="bk-sub via"
                >
                  {{ row.agency_name
                    ? t('requests.sourcePortal', { agency: row.agency_name })
                    : t('requests.sourcePortalOnly') }}
                </div>
              </td>
              <td>{{ row.party }}</td>
              <td>{{ row.copy }}</td>
              <td>{{ money(row.estimated_value) }}</td>
              <td :class="row.hold.expired ? 'req-expired' : ''">
                {{ holdOf(row) }}
              </td>
              <td>
                <span
                  class="slat"
                  :class="slaOf(row).tone === 'bad' ? 'bad' : 'ok'"
                >{{ slaOf(row).text }}</span>
              </td>
              <td class="list-actions">
                <UButton
                  :disabled="!canConfirmRow(row)"
                  @click="startConfirm(row, $event)"
                >
                  {{ t('requests.confirm') }}
                </UButton>
                <UButton
                  variant="outline"
                  :disabled="!canReleaseRow(row)"
                  @click="startRelease(row, $event)"
                >
                  {{ t('requests.release') }}
                </UButton>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <CharterEnquiriesPanel />

    <BookingPanel
      v-model:open="panelOpen"
      :booking="selected"
      :business-day-minutes="dayMinutes"
      @updated="onPanelUpdated"
      @deleted="onPanelUpdated"
    />

    <ConfirmRequestModal
      v-model:open="confirmOpen"
      :deposit-pct="confirmBooking?.deposit_pct ?? 0"
      :channel="confirmTarget?.contact.preferred_channel ?? ''"
      :submitting="confirmSubmitting"
      :error="confirmError"
      @confirm="onConfirm"
    />

    <ReasonModal
      v-model:open="releaseOpen"
      :title="t('bookings.releaseTitle')"
      hint="required"
      :submitting="releaseSubmitting"
      :error="releaseError"
      @submit="onRelease"
    />
  </div>
</template>
