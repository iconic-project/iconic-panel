<script setup lang="ts">
import type {
  Booking,
  CommissionRow,
  CommissionStatus,
  Paginated,
  Payment,
  PaymentOptions,
  PaymentsKpis,
  ReconciliationReport,
  ReconciliationRow
} from '../../../types/api'
import BookingPanel from '../../../components/bookings/BookingPanel.vue'
import ApplyGatewayModal from '../../../components/payments/ApplyGatewayModal.vue'
import MarkWireModal from '../../../components/payments/MarkWireModal.vue'
import {
  galapagosMonthRange,
  labelFrom,
  paymentStatusPillClass,
  pendingDueLabel,
  paymentsKpiCards,
  reconciliationTone,
  signedMoney
} from '../../../components/payments/paymentHelpers'
import { segmentPillClass, statusLabel, statusPillClass } from '../../../components/bookings/bookingHelpers'
import { firstApiMessage } from '../../../utils/apiForm'

type PaymentsLedger = Paginated<Payment> & {
  meta: Paginated<Payment>['meta'] & { kpis: PaymentsKpis }
}

const emptyKpis: PaymentsKpis = {
  collected: 0,
  deposits: 0,
  pending: 0,
  pending_count: 0,
  overdue_count: 0,
  overdue_amount: 0,
  commission_accrued: 0,
  charter_deposit_pct: 0,
  commission_payable_days: 0,
  commission_cap_pct: 0,
  wire_window_hours: 0
}

const { can } = useAuth()
const { t } = useI18n()
const { useFetch, request } = useApi()
const { format } = useDates()
const { format: money } = useMoney()
const toast = useToast()

const page = ref(1)
const today = computed(() => format(new Date(), 'iso'))

const panelOpen = ref(false)
const selected = ref<Booking | null>(null)

const markOpen = ref(false)
const markPaymentId = ref<number | null>(null)
const markSubmitting = ref(false)
const markError = ref('')

const applyOpen = ref(false)
const applyRow = ref<ReconciliationRow | null>(null)
const applySubmitting = ref(false)
const applyError = ref('')

const ledgerUrl = computed(() => {
  const params = new URLSearchParams({
    page: String(page.value),
    per_page: '50'
  })

  return `/api/rms/payments?${params.toString()}`
})

const pendingUrl = computed(() => {
  const params = new URLSearchParams({
    pending_payment: '1',
    per_page: '100'
  })

  return `/api/rms/bookings?${params.toString()}`
})

const commissionsUrl = '/api/rms/commissions'

const reconRange = computed(() => galapagosMonthRange(today.value))

const reconUrl = computed(() => {
  return `/api/rms/payments/reconciliation?from=${reconRange.value.from}&to=${reconRange.value.to}`
})

const { data: ledgerPayload, refresh: refreshLedger } = useFetch<PaymentsLedger>(ledgerUrl)
const { data: pendingPayload, refresh: refreshPending } = useFetch<Paginated<Booking>>(pendingUrl)
const { data: commissionsPayload, refresh: refreshCommissions } = useFetch<{ data: Array<CommissionRow> }>(commissionsUrl)
const { data: reconPayload, refresh: refreshRecon } = useFetch<ReconciliationReport>(reconUrl)
const { data: optionsPayload } = useFetch<PaymentOptions>('/api/rms/payments/options')

const kpis = computed(() => ledgerPayload.value?.meta.kpis ?? emptyKpis)
const cards = computed(() => paymentsKpiCards(kpis.value))
const pending = computed(() => pendingPayload.value?.data ?? [])
const commissions = computed(() => commissionsPayload.value?.data ?? [])
const payments = computed(() => ledgerPayload.value?.data ?? [])
const ledgerMeta = computed(() => ledgerPayload.value?.meta)
const recon = computed(() => reconPayload.value)
const reviewRows = computed(() => [
  ...(recon.value?.in_gateway_not_rms ?? []),
  ...(recon.value?.to_review ?? [])
])
const canApply = computed(() => can('payments.record'))
const canRecordLabels = computed(() => optionsPayload.value)

function kindLabel(value: string): string {
  return labelFrom(canRecordLabels.value?.kinds ?? [], value)
}

function methodLabel(value: string): string {
  return labelFrom(canRecordLabels.value?.methods ?? [], value)
}

function dueLabel(booking: Booking): string {
  const label = pendingDueLabel(booking, kpis.value.wire_window_hours)

  if (booking.status === 'PENDING_PAYMENT') {
    return label
  }

  return format(label, 'short')
}

function commissionStatusText(status: CommissionStatus): string {
  if (status === 'BLOCKED') {
    return t('payments.commissionBlocked')
  }

  if (status === 'EARNED_ON_COMPLETION') {
    return t('payments.commissionAccrued')
  }

  if (status === 'PAYABLE') {
    return t('payments.commissionPayable')
  }

  if (status === 'PAID') {
    return t('payments.commissionPaid')
  }

  return t('payments.commissionCancelled')
}

function commissionPillClass(status: CommissionStatus): string {
  const value: string = status

  if (value === 'BLOCKED') {
    return 'p-over'
  }

  if (value === 'ACCRUED' || value === 'EARNED_ON_COMPLETION') {
    return 'p-pend'
  }

  if (value === 'PAYABLE') {
    return 'p-conf'
  }

  if (value === 'PAID') {
    return 'p-full'
  }

  return 'p-canc'
}

async function openBooking(id: number): Promise<void> {
  selected.value = await request(`/api/rms/bookings/${String(id)}`) as Booking
  panelOpen.value = true
}

function openPending(booking: Booking): void {
  selected.value = booking
  panelOpen.value = true
}

async function refreshMoney(): Promise<void> {
  await refreshLedger()
  await refreshPending()
  await refreshCommissions()
  await refreshRecon()
}

async function onBookingUpdated(): Promise<void> {
  await refreshMoney()

  if (selected.value !== null) {
    selected.value = await request(`/api/rms/bookings/${String(selected.value.id)}`) as Booking
  }
}

function startMark(event: Event, payment: Payment): void {
  event.stopPropagation()
  markPaymentId.value = payment.id
  markError.value = ''
  markOpen.value = true
}

async function submitMark(bankReference: string): Promise<void> {
  if (markPaymentId.value === null) {
    return
  }

  markSubmitting.value = true
  markError.value = ''

  try {
    await request(`/api/rms/payments/${markPaymentId.value}/mark-received`, {
      method: 'POST',
      body: { bank_reference: bankReference }
    })
    markOpen.value = false
    toast.add({ title: t('payments.markedToast') })
    await refreshMoney()
  } catch (error: unknown) {
    markError.value = firstApiMessage(error) ?? (error instanceof Error ? error.message : '')
  } finally {
    markSubmitting.value = false
  }
}

function startApply(row: ReconciliationRow): void {
  applyRow.value = row
  applyError.value = ''
  applyOpen.value = true
}

async function submitApply(payload: { bookingId: number, kind: string }): Promise<void> {
  if (applyRow.value === null) {
    return
  }

  applySubmitting.value = true
  applyError.value = ''

  try {
    await request('/api/rms/payments/reconciliation/apply', {
      method: 'POST',
      body: {
        stripe_id: applyRow.value.stripe_id,
        booking_id: payload.bookingId,
        kind: payload.kind
      }
    })
    applyOpen.value = false
    toast.add({ title: t('payments.appliedToast') })
    await refreshMoney()
  } catch (error: unknown) {
    applyError.value = firstApiMessage(error) ?? (error instanceof Error ? error.message : '')
  } finally {
    applySubmitting.value = false
  }
}
</script>

<template>
  <div>
    <div class="krow">
      <AnkKpi
        v-for="card in cards"
        :key="card.id"
        :label="t(card.labelKey)"
        :sub="t(card.subKey, card.subParams)"
      >
        <span :class="{ 'pay-kpi-coral': card.tone === 'coral' }">{{ money(card.value) }}</span>
      </AnkKpi>
    </div>

    <div class="panel">
      <h3>{{ t('payments.pendingTitle') }}</h3>
      <div class="bk-table-wrap">
        <table class="list">
          <thead>
            <tr>
              <th>{{ t('payments.colBooking') }}</th>
              <th>{{ t('payments.colClient') }}</th>
              <th>{{ t('payments.colSegment') }}</th>
              <th>{{ t('payments.colAmountDue') }}</th>
              <th>{{ t('payments.colDate') }}</th>
              <th>{{ t('payments.colStatus') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-if="pending.length === 0"
              class="dr-empty"
            >
              <td colspan="6">
                {{ t('payments.pendingEmpty') }}
              </td>
            </tr>
            <tr
              v-for="row in pending"
              :key="row.id"
              class="bk-row"
              @click="openPending(row)"
            >
              <td class="bk-ref">
                {{ row.display_reference }}
              </td>
              <td>{{ row.contact.name }}</td>
              <td>
                <span
                  class="sg"
                  :class="segmentPillClass(row.segment)"
                >{{ row.segment }}</span>
              </td>
              <td>{{ money(row.balance) }}</td>
              <td>{{ dueLabel(row) }}</td>
              <td>
                <span
                  class="pill"
                  :class="statusPillClass(row.status)"
                >{{ statusLabel(row.status) }}</span>
                <span
                  v-if="row.overdue"
                  class="pill p-over"
                >{{ t('bookings.overduePill') }}</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <div class="panel">
      <h3>{{ t('payments.commissionsTitle') }}</h3>
      <div class="bk-table-wrap">
        <table class="list">
          <thead>
            <tr>
              <th>{{ t('payments.colPartner') }}</th>
              <th>{{ t('payments.colBooking') }}</th>
              <th>{{ t('payments.colRate') }}</th>
              <th>{{ t('payments.colCommission') }}</th>
              <th>{{ t('payments.colPayable') }}</th>
              <th>{{ t('payments.colStatus') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-if="commissions.length === 0"
              class="dr-empty"
            >
              <td colspan="6">
                {{ t('payments.commissionsEmpty') }}
              </td>
            </tr>
            <tr
              v-for="row in commissions"
              :key="row.booking_id"
              class="bk-row"
              @click="openBooking(row.booking_id)"
            >
              <td>{{ row.agency.name ?? '—' }}</td>
              <td class="bk-ref">
                {{ row.reference }}
              </td>
              <td>{{ row.commission_pct === null ? '—' : t('payments.ratePct', { pct: String(row.commission_pct) }) }}</td>
              <td>{{ row.status === 'BLOCKED' ? '—' : money(row.commission_amount) }}</td>
              <td>{{ row.status === 'BLOCKED' ? '—' : format(row.payable_date, 'short') }}</td>
              <td>
                <span
                  class="pill"
                  :class="commissionPillClass(row.status)"
                >{{ commissionStatusText(row.status) }}</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <p class="note pay-recon-note">
        {{ t('payments.commissionsNote', {
          days: String(kpis.commission_payable_days),
          cap: String(kpis.commission_cap_pct)
        }) }}
      </p>
    </div>

    <div class="panel">
      <h3>{{ t('payments.ledgerTitle') }}</h3>
      <div class="bk-table-wrap">
        <table class="list">
          <thead>
            <tr>
              <th>{{ t('payments.colDate') }}</th>
              <th>{{ t('payments.colBooking') }}</th>
              <th>{{ t('payments.colClient') }}</th>
              <th>{{ t('payments.colType') }}</th>
              <th>{{ t('payments.colMethod') }}</th>
              <th>{{ t('payments.colReference') }}</th>
              <th>{{ t('payments.colAmount') }}</th>
              <th>{{ t('payments.colStatus') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-if="payments.length === 0"
              class="dr-empty"
            >
              <td colspan="8">
                {{ t('payments.ledgerEmpty') }}
              </td>
            </tr>
            <tr
              v-for="row in payments"
              :key="row.id"
            >
              <td class="nw">
                {{ format(row.date, 'short') }}
              </td>
              <td>
                <button
                  type="button"
                  class="lnk"
                  @click="openBooking(row.booking.id)"
                >
                  {{ row.booking.display_reference }}
                </button>
              </td>
              <td>{{ row.booking.client }}</td>
              <td>{{ kindLabel(row.kind) }}</td>
              <td>{{ methodLabel(row.method) }}</td>
              <td class="mono">
                {{ row.reference }}
              </td>
              <td
                class="nw"
                :class="{ 'pay-amt-refund': row.amount < 0 }"
              >
                {{ signedMoney(row.amount, money) }}
              </td>
              <td>
                <template v-if="row.status === 'AWAITING_WIRE'">
                  <button
                    v-if="row.can_mark_wire"
                    type="button"
                    class="mini"
                    @click="startMark($event, row)"
                  >
                    {{ t('payments.markReceived') }}
                  </button>
                  <span
                    v-else
                    class="pill p-pend"
                  >{{ t('payments.awaitingWire') }}</span>
                </template>
                <span
                  v-else
                  class="pill"
                  :class="paymentStatusPillClass(row.status)"
                >{{ row.status.replaceAll('_', ' ') }}</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div
        v-if="ledgerMeta && ledgerMeta.last_page > 1"
        class="list-pager"
      >
        <button
          type="button"
          :disabled="ledgerMeta.current_page <= 1"
          @click="page -= 1"
        >
          {{ t('bookings.previous') }}
        </button>
        <span>{{ t('bookings.pager', { from: String(ledgerMeta.from ?? 0), to: String(ledgerMeta.to ?? 0), total: String(ledgerMeta.total) }) }}</span>
        <button
          type="button"
          :disabled="ledgerMeta.current_page >= ledgerMeta.last_page"
          @click="page += 1"
        >
          {{ t('bookings.next') }}
        </button>
      </div>
    </div>

    <div class="panel">
      <h3>{{ t('payments.reconTitle') }}</h3>
      <p class="note pay-recon-note">
        {{ t('payments.reconMonthNote', { from: reconRange.from, to: reconRange.to }) }}
      </p>
      <div class="krow">
        <AnkKpi
          :label="t('payments.reconGateway')"
          :sub="t('payments.reconGatewaySub')"
        >
          {{ recon?.counts.gateway ?? 0 }}
        </AnkKpi>
        <AnkKpi
          :label="t('payments.reconMatched')"
          :sub="t('payments.reconMatchedSub')"
        >
          {{ recon?.counts.matched ?? 0 }}
        </AnkKpi>
        <AnkKpi
          :label="t('payments.reconDiscrepancies')"
          :sub="t('payments.reconDiscrepanciesSub')"
        >
          <span :class="{ 'pay-kpi-coral': reconciliationTone(recon?.counts.discrepancies ?? 0) === 'coral' }">
            {{ recon?.counts.discrepancies ?? 0 }}
          </span>
        </AnkKpi>
      </div>
      <div class="bk-table-wrap">
        <table class="list">
          <thead>
            <tr>
              <th>{{ t('payments.colGateway') }}</th>
              <th>{{ t('payments.colTransaction') }}</th>
              <th>{{ t('payments.colDate') }}</th>
              <th>{{ t('payments.colAmount') }}</th>
              <th>{{ t('payments.colReference') }}</th>
              <th>{{ t('payments.colDescription') }}</th>
              <th>{{ t('payments.colActions') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-if="reviewRows.length === 0"
              class="dr-empty"
            >
              <td colspan="7">
                {{ t('payments.reconEmpty') }}
              </td>
            </tr>
            <tr
              v-for="row in reviewRows"
              :key="row.stripe_id"
              class="rdiff"
            >
              <td>{{ row.gateway }}</td>
              <td class="mono">
                {{ row.stripe_id }}
              </td>
              <td class="nw">
                {{ format(row.date, 'short') }}
              </td>
              <td>{{ money(row.amount) }}</td>
              <td class="mono">
                {{ row.reference ?? '—' }}
              </td>
              <td>{{ row.description }}</td>
              <td>
                <button
                  v-if="canApply"
                  type="button"
                  class="mini"
                  @click="startApply(row)"
                >
                  {{ t('payments.applyToBooking') }}
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <p
        v-if="recon?.note"
        class="note pay-recon-note"
      >
        {{ recon.note }}
      </p>
      <p
        v-if="recon?.meta.mode === 'test'"
        class="note pay-recon-note"
      >
        {{ t('payments.stripeTestModePlain') }}
      </p>
    </div>

    <BookingPanel
      v-model:open="panelOpen"
      :booking="selected"
      initial-tab="payments"
      @updated="onBookingUpdated"
    />

    <MarkWireModal
      v-model:open="markOpen"
      :submitting="markSubmitting"
      :error="markError"
      @submit="submitMark"
    />

    <ApplyGatewayModal
      v-model:open="applyOpen"
      :stripe-id="applyRow?.stripe_id ?? ''"
      :kinds="optionsPayload?.kinds ?? []"
      :submitting="applySubmitting"
      :error="applyError"
      @submit="submitApply"
    />
  </div>
</template>
