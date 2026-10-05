<script setup lang="ts">
import type {
  AllowedTransition,
  Booking,
  BookingOwner,
  BookingStatus,
  ChangeHistoryEntry,
  Paginated
} from '../../types/api'
import { firstApiMessage } from '../../utils/apiForm'
import { confirmUnsaved } from '../../composables/useUnsavedGuard'
import HistoryTimeline from '../history/HistoryTimeline.vue'
import ReasonModal from './ReasonModal.vue'
import MoveBookingModal from './MoveBookingModal.vue'
import ConfirmRequestModal from '../requests/ConfirmRequestModal.vue'
import { formatHoldRemaining } from '../requests/requestHelpers'
import {
  BOOKING_TABS,
  canMoveStatus,
  departureOverviewLabel,
  galapagosTomorrowIso,
  reasonHint,
  reasonModalTitle,
  statusLabel,
  statusPillClass,
  statusText,
  type BookingTab,
  type BookingTabId
} from './bookingHelpers'
import { confirmRequest, releaseRequest } from './requestActions'
import { overdueNotice } from '../payments/paymentHelpers'
import BookingPaymentsTab from '../payments/BookingPaymentsTab.vue'
import BookingGuestsTab from '../guests/BookingGuestsTab.vue'
import BookingExtrasTab from '../extras/BookingExtrasTab.vue'
import BookingDocumentsTab from '../documents/BookingDocumentsTab.vue'
import PostTripSurveyModal from '../guest-experience/PostTripSurveyModal.vue'
import BookingBillingBlock from './BookingBillingBlock.vue'
import StayDeskActions from './StayDeskActions.vue'
import { chargesRows } from '../extras/extraHelpers'

const open = defineModel<boolean>('open', { required: true })

const props = defineProps<{
  booking: Booking | null
  businessDayMinutes?: number
  initialTab?: BookingTabId
}>()

const emit = defineEmits<{
  updated: [booking: Booking]
  deleted: []
  openGroup: [groupId: number]
}>()

type ReasonKind = 'transition' | 'delete' | 'release' | 'overdue-extend' | 'overdue-cancel' | 'commission-approve' | 'commission-reject'

const { t } = useI18n()
const { can } = useAuth()
const { request } = useApi()
const { format } = useDates()
const { format: money } = useMoney()
const toast = useToast()

const current = ref<Booking | null>(null)
const tab = ref<BookingTabId>('overview')
const notes = ref('')
const ownerId = ref<number | null>(null)
const snapshot = ref('')
const warn = ref('')
const saving = ref(false)
const owners = ref<Array<BookingOwner>>([])
const history = ref<Array<ChangeHistoryEntry>>([])
const historyPage = ref(1)
const historyLast = ref(1)
const historyLoading = ref(false)

const reasonOpen = ref(false)
const reasonKind = ref<ReasonKind>('transition')
const reasonTo = ref<BookingStatus | null>(null)
const reasonRequired = ref(true)
const reasonError = ref('')
const reasonSubmitting = ref(false)
const moveOpen = ref(false)

const canReassign = computed(() => can('records.act_on_any'))
const canDelete = computed(() => can('bookings.delete'))
const canChangeStatus = computed(() => can('bookings.change_status'))
const canMove = computed(() => can('bookings.move'))
const canConfirm = computed(() => can('requests.confirm'))
const canRelease = computed(() => can('requests.release'))
const canOverdueDecision = computed(() => can('bookings.overdue_decision'))
const canOverrideCap = computed(() => can('commissions.override_cap'))
const canRecordSurvey = computed(() => can('guest_experience.manage'))
const surveyOpen = ref(false)
const extendDate = ref<string | null>(null)
const { rules } = useOpenRequests()
const confirmOpen = ref(false)
const confirmSubmitting = ref(false)
const confirmError = ref('')

const holdDayMinutes = computed(() => {
  return props.businessDayMinutes ?? rules.value?.business_day_minutes ?? 0
})

const source = computed(() => current.value ?? props.booking)

const holdRemainingText = computed(() => {
  if (source.value?.request === null || source.value?.request === undefined) {
    return ''
  }

  return formatHoldRemaining(
    source.value.request.hold.remaining_business_minutes,
    holdDayMinutes.value,
    source.value.request.hold.expired
  )
})

const dirty = computed(() => {
  if (source.value === null || !source.value.can_act) {
    return false
  }

  return `${notes.value}\0${ownerId.value ?? ''}` !== snapshot.value
})

const reasonTitle = computed(() => {
  if (reasonKind.value === 'delete') {
    return t('bookings.deleteTitle', { reference: source.value?.display_reference ?? '' })
  }

  if (reasonKind.value === 'release') {
    return t('bookings.releaseTitle')
  }

  if (reasonKind.value === 'overdue-extend') {
    return t('bookings.overdueExtendTitle')
  }

  if (reasonKind.value === 'overdue-cancel') {
    return t('bookings.overdueCancelTitle')
  }

  if (reasonKind.value === 'commission-approve') {
    return t('bookings.commissionApproveTitle')
  }

  if (reasonKind.value === 'commission-reject') {
    return t('bookings.commissionRejectTitle')
  }

  return reasonModalTitle(source.value?.status ?? '', reasonTo.value ?? '')
})

const balanceTone = computed(() => {
  if (source.value === null || source.value.balance === 0) {
    return 'bk-balance--zero'
  }

  if (source.value.overdue) {
    return 'bk-balance'
  }

  return ''
})

const commissionHold = computed(() => {
  return source.value !== null
    && source.value.status === 'ON_HOLD_AGENCY'
    && !source.value.commission_approved
})

const overdueText = computed(() => {
  if (source.value === null || !source.value.overdue || source.value.overdue_days === null) {
    return ''
  }

  return overdueNotice(source.value.overdue_days, source.value.balance, money)
})

const overviewCharges = computed(() => {
  return source.value === null ? [] : chargesRows(source.value)
})

const cancelRefundHint = computed(() => {
  if (source.value === null || source.value.paid <= 0) {
    return t('bookings.overdueCancelNothingPaid')
  }

  return t('bookings.overdueCancelRefundQueued')
})

const extendMin = computed(() => galapagosTomorrowIso(new Date(), (value, style, options) => format(value, style, options)))
const extendMax = computed(() => source.value?.departure.date ?? '')
const extendValid = computed(() => extendDate.value !== null && extendDate.value !== '')

const ownerItems = computed(() => owners.value.map(item => ({
  label: item.name,
  value: item.id
})))

function onOwnerUpdate(value: number | string | null | undefined): void {
  if (typeof value === 'number') {
    ownerId.value = value
  }
}

useUnsavedGuard(dirty, () => t('bookings.leaveUnsaved'))

watch(
  () => [open.value, props.booking?.id] as const,
  async ([isOpen, id]) => {
    if (!isOpen || id === undefined) {
      return
    }

    tab.value = props.initialTab ?? 'overview'
    warn.value = ''
    reasonOpen.value = false
    moveOpen.value = false
    history.value = []
    await refreshBooking(id)

    if (canReassign.value && owners.value.length === 0) {
      try {
        const result = await request('/api/rms/bookings/owners') as { data: Array<BookingOwner> }
        owners.value = result.data
      } catch {
        owners.value = []
      }
    }
  }
)

watch(tab, (id) => {
  if (id === 'history' && source.value !== null && history.value.length === 0) {
    void loadHistory(true)
  }
})

function onDeskUpdated(booking: Booking): void {
  current.value = booking
  notes.value = booking.internal_notes ?? ''
  ownerId.value = booking.owner.id
  snapshot.value = `${notes.value}\0${ownerId.value}`
  emit('updated', booking)
}

async function refreshBooking(id: number): Promise<void> {
  const booking = await request(`/api/rms/bookings/${id}`) as Booking
  current.value = booking
  notes.value = booking.internal_notes ?? ''
  ownerId.value = booking.owner.id
  snapshot.value = `${notes.value}\0${ownerId.value}`
}

function onUpdateOpen(next: boolean): void {
  if (!next && dirty.value && !confirmUnsaved(t('bookings.leaveUnsaved'))) {
    return
  }

  open.value = next
}

function selectTab(item: BookingTab): void {
  if (item.disabled) {
    return
  }

  tab.value = item.id
}

function openBilling(): void {
  tab.value = 'overview'
  void nextTick(() => {
    document.getElementById('booking-billing')?.scrollIntoView({ block: 'start' })
  })
}

function tabTooltip(item: BookingTab): string {
  return item.arrivesSprint === null ? '' : t('bookings.arrivesSprint', { n: String(item.arrivesSprint) })
}

function shortDate(iso: string): string {
  return format(iso, 'short')
}

function openGroup(): void {
  const group = source.value?.group

  if (group === undefined || group === null) {
    return
  }

  emit('openGroup', group.id)
}

async function save(): Promise<void> {
  if (source.value === null || !source.value.can_act) {
    return
  }

  saving.value = true
  warn.value = ''

  try {
    const body: { internal_notes?: string | null, owner_id?: number } = {}

    if (notes.value !== (source.value.internal_notes ?? '')) {
      body.internal_notes = notes.value === '' ? null : notes.value
    }

    if (canReassign.value && ownerId.value !== null && ownerId.value !== source.value.owner.id) {
      body.owner_id = ownerId.value
    }

    const updated = await request(`/api/rms/bookings/${source.value.id}`, {
      method: 'PATCH',
      body
    }) as Booking

    current.value = updated
    notes.value = updated.internal_notes ?? ''
    ownerId.value = updated.owner.id
    snapshot.value = `${notes.value}\0${ownerId.value}`
    toast.add({ title: t('bookings.savedToast') })
    emit('updated', updated)
  } catch (error: unknown) {
    warn.value = firstApiMessage(error) ?? (error instanceof Error ? error.message : '')
  } finally {
    saving.value = false
  }
}

function onConfirmRequest(): void {
  confirmError.value = ''
  confirmOpen.value = true
}

async function submitConfirm(): Promise<void> {
  if (source.value === null) {
    return
  }

  confirmSubmitting.value = true
  confirmError.value = ''

  try {
    const updated = await confirmRequest(request, source.value.id)
    current.value = updated
    toast.add({ title: t('bookings.confirmedToast') })
    confirmOpen.value = false
    emit('updated', updated)
  } catch (error: unknown) {
    confirmError.value = firstApiMessage(error) ?? (error instanceof Error ? error.message : '')
  } finally {
    confirmSubmitting.value = false
  }
}

function startRelease(): void {
  reasonKind.value = 'release'
  reasonTo.value = 'RELEASED'
  reasonRequired.value = true
  reasonError.value = ''
  reasonOpen.value = true
}

function startTransition(item: AllowedTransition): void {
  reasonKind.value = 'transition'
  reasonTo.value = item.to
  reasonRequired.value = item.reason_required
  reasonError.value = ''
  reasonOpen.value = true
}

function startDelete(): void {
  reasonKind.value = 'delete'
  reasonTo.value = null
  reasonRequired.value = true
  reasonError.value = ''
  reasonOpen.value = true
}

async function onReason(reason: string): Promise<void> {
  if (source.value === null) {
    return
  }

  reasonSubmitting.value = true
  reasonError.value = ''

  try {
    if (reasonKind.value === 'delete') {
      await request(`/api/rms/bookings/${source.value.id}`, {
        method: 'DELETE',
        body: { reason }
      })
      toast.add({ title: t('bookings.deletedToast') })
      reasonOpen.value = false
      open.value = false
      emit('deleted')
      return
    }

    if (reasonKind.value === 'release') {
      const updated = await releaseRequest(request, source.value.id, reason)
      current.value = updated
      toast.add({ title: t('requests.releasedToast') })
      reasonOpen.value = false
      emit('updated', updated)
      return
    }

    if (reasonKind.value === 'commission-approve' || reasonKind.value === 'commission-reject') {
      const updated = await request(`/api/rms/bookings/${source.value.id}/commission-approval`, {
        method: 'POST',
        body: {
          approve: reasonKind.value === 'commission-approve',
          reason
        }
      }) as Booking

      current.value = updated
      toast.add({
        title: reasonKind.value === 'commission-approve'
          ? t('bookings.commissionApprovedToast')
          : t('bookings.commissionRejectedToast')
      })
      reasonOpen.value = false
      emit('updated', updated)
      history.value = []
      return
    }

    if (reasonKind.value === 'overdue-extend' || reasonKind.value === 'overdue-cancel') {
      const updated = await request(`/api/rms/bookings/${source.value.id}/overdue-decision`, {
        method: 'POST',
        body: {
          decision: reasonKind.value === 'overdue-extend' ? 'EXTEND' : 'CANCEL',
          reason,
          new_due_date: reasonKind.value === 'overdue-extend' ? (extendDate.value ?? undefined) : undefined
        }
      }) as Booking

      current.value = updated
      toast.add({ title: t('bookings.overdueDecidedToast') })
      reasonOpen.value = false
      emit('updated', updated)
      history.value = []
      return
    }

    if (reasonTo.value === null) {
      return
    }

    const updated = await request(`/api/rms/bookings/${source.value.id}/transition`, {
      method: 'POST',
      body: {
        to: reasonTo.value,
        reason: reason === '' ? null : reason
      }
    }) as Booking

    current.value = updated
    toast.add({ title: t('bookings.transitionedToast') })
    reasonOpen.value = false
    emit('updated', updated)
    history.value = []
  } catch (error: unknown) {
    reasonError.value = firstApiMessage(error) ?? (error instanceof Error ? error.message : '')
  } finally {
    reasonSubmitting.value = false
  }
}

async function onMoved(booking: Booking): Promise<void> {
  current.value = booking
  emit('updated', booking)
  history.value = []
}

async function loadHistory(reset: boolean): Promise<void> {
  if (source.value === null) {
    return
  }

  if (reset) {
    historyPage.value = 1
    history.value = []
  }

  historyLoading.value = true

  try {
    const result = await request(
      `/api/rms/bookings/${source.value.id}/history?page=${historyPage.value}`
    ) as Paginated<ChangeHistoryEntry>
    history.value = reset ? result.data : [...history.value, ...result.data]
    historyLast.value = result.meta.last_page
  } finally {
    historyLoading.value = false
  }
}

async function loadOlder(): Promise<void> {
  historyPage.value += 1
  await loadHistory(false)
}

function canActOn(booking: Booking): boolean {
  return booking.can_act
}

function startOverdue(kind: 'overdue-extend' | 'overdue-cancel'): void {
  reasonKind.value = kind
  reasonTo.value = null
  reasonRequired.value = true
  reasonError.value = ''
  extendDate.value = null
  reasonOpen.value = true
}

function startCommission(kind: 'commission-approve' | 'commission-reject'): void {
  reasonKind.value = kind
  reasonTo.value = null
  reasonRequired.value = true
  reasonError.value = ''
  reasonOpen.value = true
}

async function onPaymentsUpdated(booking?: Booking): Promise<void> {
  if (booking !== undefined) {
    current.value = booking
    emit('updated', booking)
  } else if (source.value !== null) {
    await refreshBooking(source.value.id)
    if (current.value !== null) {
      emit('updated', current.value)
    }
  }

  history.value = []
}
</script>

<template>
  <USlideover
    :open="open"
    class="history-drawer"
    @update:open="onUpdateOpen"
  >
    <template #header>
      <div v-if="source">
        <h2>{{ source.contact.name }}</h2>
        <div class="bid">
          {{ source.display_reference }}
          ·
          <span
            class="pill"
            :class="statusPillClass(source.status)"
          >{{ statusText(source.status, key => t(key)) }}</span>
          <span
            v-if="source.overdue"
            class="pill p-over"
          >{{ t('bookings.overduePill') }}</span>
          <template v-if="source.group">
            ·
            <button
              type="button"
              class="lnk"
              @click="openGroup"
            >
              {{ source.group.reference }}
            </button>
          </template>
          <span
            v-if="!source.can_act"
            class="bk-bid-extra"
          >
            · {{ t('bookings.ownedBy', { name: source.owner.name.toUpperCase() }) }}
          </span>
        </div>
      </div>
    </template>

    <template #body>
      <template v-if="source">
        <div class="dtabs">
          <UTooltip
            v-for="item in BOOKING_TABS"
            :key="item.id"
            :text="tabTooltip(item)"
            :disabled="!item.disabled"
          >
            <span>
              <button
                type="button"
                class="dtab"
                :class="{ on: tab === item.id }"
                :disabled="item.disabled"
                @click="selectTab(item)"
              >
                {{ t(item.labelKey) }}
              </button>
            </span>
          </UTooltip>
        </div>

        <div
          v-if="warn"
          class="warnbox"
        >
          {{ warn }}
        </div>

        <template v-if="tab === 'overview'">
          <StayDeskActions
            v-if="source.stay"
            :booking="source"
            @updated="onDeskUpdated"
          />
          <div class="kv">
            <span>{{ t('bookings.kvType') }}</span>
            <span>{{ t('bookings.typeChannel', { type: source.type, channel: source.channel_of_origin }) }}</span>
          </div>
          <div class="kv">
            <span>{{ t('bookings.kvMain') }}</span>
            <span>{{ source.main_channel }}</span>
          </div>
          <div
            v-if="source.agency"
            class="kv"
          >
            <span>{{ t('bookings.kvAgency') }}</span>
            <span>{{ source.commission_approved
              ? t('bookings.agencyRow', { name: source.agency.name, pct: String(source.commission_pct ?? source.agency.commission_pct) })
              : t('bookings.agencyRowPending', { name: source.agency.name, pct: String(source.commission_pct ?? source.agency.commission_pct) }) }}</span>
          </div>
          <div class="kv">
            <span>{{ t('bookings.kvParty') }}</span>
            <span>{{ t('bookings.partyWithGuests', {
              party: source.party_label,
              complete: String(source.guests_summary.complete),
              total: String(source.guests_summary.total)
            }) }}</span>
          </div>
          <template v-if="source.departure">
            <div class="kv">
              <span>{{ t('bookings.kvDeparture') }}</span>
              <span>{{ departureOverviewLabel(source.departure.date, source.departure.return_date, source.departure.embark, shortDate) }}</span>
            </div>
            <div class="kv">
              <span>{{ t('bookings.kvItinerary') }}</span>
              <span>{{ source.departure.itinerary_name }}</span>
            </div>
            <div class="kv">
              <span>{{ t('bookings.kvCabin') }}</span>
              <span>{{ source.cabin_label }}</span>
            </div>
          </template>
          <div
            v-if="source.group"
            class="kv"
          >
            <span>{{ t('bookings.kvGroup') }}</span>
            <span>
              <button
                type="button"
                class="lnk"
                @click="openGroup"
              >
                {{ t('bookings.groupValue', { reference: source.group.reference, name: source.group.name }) }}
              </button>
              · {{ t('bookings.groupCoordinatorLine', { name: source.group.coordinator.name }) }}
            </span>
          </div>
          <template v-if="source.status === 'REQUESTED' && source.request">
            <div class="kv">
              <span>{{ t('bookings.kvPreferred') }}</span>
              <span>
                {{ source.request.preferred_channel }}{{ source.request.travel_advisor ? t('bookings.travelAdvisor') : '' }}
              </span>
            </div>
            <div class="kv">
              <span>{{ t('bookings.kvHold') }}</span>
              <span :class="source.request.hold.expired ? 'req-expired' : ''">
                {{ holdRemainingText }}
              </span>
            </div>
            <div
              v-if="source.request.notes"
              class="kv"
            >
              <span>{{ t('bookings.kvNotes') }}</span>
              <span>{{ source.request.notes }}</span>
            </div>
          </template>
          <template
            v-for="row in overviewCharges"
            :key="row.id"
          >
            <div
              v-if="row.id === 'cruise'"
              class="kv"
            >
              <span>{{ t('bookings.kvCruise') }}</span>
              <span>{{ money(row.amount) }}</span>
            </div>
            <div
              v-else-if="row.id === 'extras'"
              class="kv"
            >
              <span>{{ t('bookings.kvExtras') }}</span>
              <span>{{ money(row.amount) }}</span>
            </div>
            <div
              v-else-if="row.id === 'fees'"
              class="kv"
            >
              <span>
                {{ t('bookings.kvFeesCollected') }}
                <span
                  v-if="row.pendingCount > 0"
                  class="gmeta"
                >{{ t('bookings.feesPendingData') }}</span>
              </span>
              <span>{{ money(row.amount) }}</span>
            </div>
            <div
              v-else-if="row.id === 'rule'"
              class="charges-rule"
            />
            <div
              v-else-if="row.id === 'charges'"
              class="kv"
            >
              <span>{{ t('bookings.kvChargesTotal') }}</span>
              <span>{{ money(row.amount) }}</span>
            </div>
            <div
              v-else-if="row.id === 'paid'"
              class="kv"
            >
              <span>{{ t('bookings.kvPaid') }}</span>
              <span>{{ money(row.amount) }}</span>
            </div>
            <p
              v-else-if="row.id === 'pledged'"
              class="note pay-pledged"
            >
              {{ t('bookings.pledgedWire', {
                amount: money(row.amount),
                when: row.endsAt === null ? '—' : format(row.endsAt, 'dateTime')
              }) }}
            </p>
            <div
              v-else-if="row.id === 'balance'"
              class="kv"
            >
              <span>{{ t('bookings.kvBalance') }}</span>
              <span :class="balanceTone">
                {{ t('bookings.balanceDue', { amount: money(row.amount), date: format(row.dueDate, 'short') }) }}
              </span>
            </div>
            <div
              v-else-if="row.id === 'deposit'"
              class="kv"
            >
              <span>{{ t('bookings.depositOfCruise', { pct: String(row.pct) }) }}</span>
              <span>
                {{ money(row.amount) }}
                <span
                  v-if="source.paid >= row.amount"
                  class="pay-tick"
                >✓</span>
              </span>
            </div>
            <p
              v-else-if="row.id === 'extrasDue'"
              class="note extras-due"
            >
              {{ t('bookings.extrasDueBy', {
                date: row.dueAt === null ? '—' : format(row.dueAt, 'dateTime')
              }) }}
            </p>
          </template>

          <div
            v-if="commissionHold"
            class="warnbox"
          >
            <h4>{{ t('bookings.commissionHoldTitle') }}</h4>
            <p>
              {{ t('bookings.commissionHoldNotice', {
                rate: String(source.commission_pct ?? 0),
                cap: String(source.commission_cap_pct)
              }) }}
            </p>
            <div
              v-if="canOverrideCap"
              class="transbtns"
            >
              <UButton
                :disabled="!canActOn(source)"
                @click="startCommission('commission-approve')"
              >
                {{ t('bookings.commissionApprove') }}
              </UButton>
              <UButton
                variant="outline"
                :disabled="!canActOn(source)"
                @click="startCommission('commission-reject')"
              >
                {{ t('bookings.commissionReject') }}
              </UButton>
            </div>
          </div>

          <div class="sec">
            <h4>{{ t('bookings.priceTitle') }}</h4>
            <p class="bk-sub">
              {{ t('bookings.ratesVersion', { version: String(source.rates_version.version) }) }}
            </p>
            <div
              v-for="line in source.price_lines"
              :key="line.code"
              class="pline"
            >
              <span>{{ line.label }}</span>
              <span>{{ money(line.amount) }}</span>
            </div>
            <div class="pline tot">
              <span>{{ t('bookings.kvCabinTotal') }}</span>
              <span>{{ money(source.total) }}</span>
            </div>
          </div>

          <div
            v-if="source.status === 'REQUESTED'"
            class="sec"
          >
            <h4>{{ t('bookings.requestActions') }}</h4>
            <div class="transbtns">
              <UButton
                :disabled="!canActOn(source) || !canConfirm"
                @click="onConfirmRequest"
              >
                {{ t('bookings.confirmRequest', { pct: String(source.deposit_pct) }) }}
              </UButton>
              <UButton
                variant="outline"
                :disabled="!canActOn(source) || !canRelease"
                @click="startRelease"
              >
                {{ t('bookings.releaseHold') }}
              </UButton>
            </div>
            <p
              v-if="rules?.response_hours"
              class="notice"
            >
              {{ t('bookings.requestSla', { hours: String(rules.response_hours) }) }}
            </p>
          </div>

          <div
            v-if="source.overdue"
            class="warnbox"
          >
            <p>{{ overdueText }}</p>
            <div class="transbtns">
              <UButton
                :disabled="!canActOn(source) || !canOverdueDecision"
                @click="startOverdue('overdue-extend')"
              >
                {{ t('bookings.overdueExtend') }}
              </UButton>
              <UButton
                variant="outline"
                :disabled="!canActOn(source) || !canOverdueDecision"
                @click="startOverdue('overdue-cancel')"
              >
                {{ t('bookings.overdueCancel') }}
              </UButton>
            </div>
          </div>

          <div
            v-if="source.status === 'COMPLETED' && canRecordSurvey"
            class="sec"
          >
            <h4>{{ t('guestExperience.surveyTitle') }}</h4>
            <div class="transbtns">
              <UButton
                variant="outline"
                @click="surveyOpen = true"
              >
                {{ t('guestExperience.recordSurvey') }}
              </UButton>
            </div>
          </div>

          <div class="sec">
            <h4>{{ t('bookings.transitions') }}</h4>
            <div class="transbtns">
              <template v-if="source.allowed_transitions.length > 0">
                <UButton
                  v-for="item in source.allowed_transitions"
                  :key="item.to"
                  variant="outline"
                  :disabled="!canActOn(source) || !canChangeStatus"
                  @click="startTransition(item)"
                >
                  {{ t('bookings.transitionTo', { status: statusLabel(item.to) }) }}
                </UButton>
              </template>
              <span
                v-else
                class="bk-terminal"
              >{{ t('bookings.terminal') }}</span>
              <UButton
                variant="outline"
                :disabled="!canDelete"
                @click="startDelete"
              >
                {{ t('bookings.delete') }}
              </UButton>
            </div>
            <p
              v-if="!source.can_act"
              class="notice"
            >
              {{ t('bookings.ownRecords') }}
            </p>
          </div>

          <div class="sec">
            <h4>{{ t('bookings.freeDate') }}</h4>
            <UButton
              variant="outline"
              :disabled="!canActOn(source) || !canMove || !canMoveStatus(source.status)"
              @click="moveOpen = true"
            >
              {{ t('bookings.move') }}
            </UButton>
          </div>

          <BookingBillingBlock
            :booking="source"
            @updated="onPaymentsUpdated"
          />

          <div class="sec">
            <h4>{{ t('bookings.notesTitle') }}</h4>
            <div class="field">
              <textarea
                v-model="notes"
                rows="3"
                :disabled="!source.can_act"
              />
            </div>
          </div>

          <div
            v-if="canReassign"
            class="sec"
          >
            <h4>{{ t('bookings.ownerTitle') }}</h4>
            <div class="field">
              <USelect
                :model-value="ownerId ?? undefined"
                class="w-full"
                :items="ownerItems"
                @update:model-value="onOwnerUpdate"
              />
            </div>
          </div>

          <div
            v-if="source.can_act"
            class="transbtns"
          >
            <UButton
              :disabled="saving || !dirty"
              :loading="saving"
              @click="save"
            >
              {{ t('bookings.save') }}
            </UButton>
            <UButton
              variant="outline"
              @click="onUpdateOpen(false)"
            >
              {{ t('bookings.cancel') }}
            </UButton>
          </div>
        </template>

        <template v-else-if="tab === 'guests'">
          <BookingGuestsTab
            :booking="source"
            @updated="onPaymentsUpdated"
          />
        </template>

        <template v-else-if="tab === 'extras'">
          <BookingExtrasTab
            :booking="source"
            @updated="onPaymentsUpdated"
          />
        </template>

        <template v-else-if="tab === 'payments'">
          <BookingPaymentsTab
            :booking="source"
            @updated="onPaymentsUpdated"
          />
        </template>

        <template v-else-if="tab === 'documents'">
          <BookingDocumentsTab
            :booking="source"
            @updated="onPaymentsUpdated"
            @open-billing="openBilling"
          />
        </template>

        <template v-else-if="tab === 'history'">
          <p class="history-note">
            {{ t('bookings.historyNote') }}
          </p>
          <HistoryTimeline :entries="history" />
          <button
            v-if="historyPage < historyLast"
            type="button"
            class="history-load"
            :disabled="historyLoading"
            @click="loadOlder"
          >
            {{ t('bookings.loadOlder') }}
          </button>
        </template>
      </template>
    </template>
  </USlideover>

  <ConfirmRequestModal
    v-model:open="confirmOpen"
    :deposit-pct="source?.deposit_pct ?? 0"
    :channel="source?.request?.preferred_channel ?? ''"
    :submitting="confirmSubmitting"
    :error="confirmError"
    @confirm="submitConfirm"
  />

  <ReasonModal
    v-model:open="reasonOpen"
    :title="reasonTitle"
    :hint="reasonHint(reasonRequired)"
    :submitting="reasonSubmitting"
    :error="reasonError"
    :extra-required="reasonKind === 'overdue-extend'"
    :extra-valid="extendValid"
    @submit="onReason"
  >
    <template
      v-if="reasonKind === 'overdue-extend'"
      #extra
    >
      <div class="field">
        <label for="overdue-due">
          {{ t('bookings.overdueNewDue') }}
          <span class="cnt">{{ t('bookings.reasonRequired') }}</span>
        </label>
        <AnkDateInput
          id="overdue-due"
          v-model="extendDate"
          :min="extendMin"
          :max="extendMax"
        />
      </div>
    </template>
    <template
      v-else-if="reasonKind === 'overdue-cancel'"
      #extra
    >
      <p class="note">
        {{ cancelRefundHint }}
      </p>
    </template>
  </ReasonModal>

  <PostTripSurveyModal
    v-model:open="surveyOpen"
    :booking-id="source?.id ?? null"
    @saved="history = []"
  />

  <MoveBookingModal
    v-model:open="moveOpen"
    :booking="source"
    @moved="onMoved"
  />
</template>
