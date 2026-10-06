<script setup lang="ts">
import type { Booking, PaymentOptions, RefundRequest, RefundStatus, RefundsRules } from '../../../types/api'
import DateRangeFilter from '../../../components/lists/DateRangeFilter.vue'
import BookingPanel from '../../../components/bookings/BookingPanel.vue'
import ReasonModal from '../../../components/bookings/ReasonModal.vue'
import ExecuteRefundModal from '../../../components/refunds/ExecuteRefundModal.vue'
import { refundSlaDisplay } from '../../../components/refunds/refundHelpers'
import { firstApiMessage } from '../../../utils/apiForm'

type RefundsPayload = {
  data: Array<RefundRequest>
  meta: {
    rules: RefundsRules
  }
}

type StatusChip = 'ALL' | RefundStatus

const CHIPS: Array<StatusChip> = ['ALL', 'PENDING', 'APPROVED', 'EXECUTED', 'REJECTED']

const emptyRules: RefundsRules = {
  refund_business_days: 0
}

const { can } = useAuth()
const { t } = useI18n()
const { useFetch, request } = useApi()
const { format } = useDates()
const { format: money } = useMoney()
const toast = useToast()

const from = ref<string | null>(null)
const to = ref<string | null>(null)
const status = ref<StatusChip>('ALL')
const today = computed(() => format(new Date(), 'iso'))

const panelOpen = ref(false)
const selected = ref<Booking | null>(null)
const decideOpen = ref(false)
const decideKind = ref<'APPROVED' | 'REJECTED'>('APPROVED')
const decideTarget = ref<RefundRequest | null>(null)
const decideSubmitting = ref(false)
const decideError = ref('')
const executeOpen = ref(false)
const executeTarget = ref<RefundRequest | null>(null)
const executeSubmitting = ref(false)
const executeError = ref('')

const listUrl = computed(() => {
  const params = new URLSearchParams()

  if (from.value !== null) {
    params.set('from', from.value)
  }

  if (to.value !== null) {
    params.set('to', to.value)
  }

  if (status.value !== 'ALL') {
    params.set('status', status.value)
  }

  const query = params.toString()

  return query === '' ? '/api/rms/refunds' : `/api/rms/refunds?${query}`
})

const { data: listPayload, refresh } = useFetch<RefundsPayload>(listUrl)
const { data: optionsPayload } = useFetch<PaymentOptions>('/api/rms/payments/options')

const rows = computed(() => listPayload.value?.data ?? [])
const rules = computed(() => listPayload.value?.meta.rules ?? emptyRules)
const total = computed(() => rows.value.length)

function chipLabel(chip: StatusChip): string {
  if (chip === 'ALL') {
    return t('refunds.filterAll')
  }

  if (chip === 'PENDING') {
    return t('refunds.filterPending')
  }

  if (chip === 'APPROVED') {
    return t('refunds.filterApproved')
  }

  if (chip === 'EXECUTED') {
    return t('refunds.filterExecuted')
  }

  return t('refunds.filterRejected')
}

async function openBooking(id: number): Promise<void> {
  selected.value = await request(`/api/rms/bookings/${String(id)}`) as Booking
  panelOpen.value = true
}

function startDecide(row: RefundRequest, kind: 'APPROVED' | 'REJECTED', event: Event): void {
  event.stopPropagation()
  decideKind.value = kind
  decideTarget.value = row
  decideError.value = ''
  decideOpen.value = true
}

function startExecute(row: RefundRequest, event: Event): void {
  event.stopPropagation()
  executeTarget.value = row
  executeError.value = ''
  executeOpen.value = true
}

async function onDecide(reason: string): Promise<void> {
  if (decideTarget.value === null) {
    return
  }

  decideSubmitting.value = true
  decideError.value = ''

  try {
    await request(`/api/rms/refunds/${String(decideTarget.value.id)}/decide`, {
      method: 'POST',
      body: {
        decision: decideKind.value,
        reason
      }
    })
    toast.add({
      title: decideKind.value === 'APPROVED' ? t('refunds.approvedToast') : t('refunds.rejectedToast')
    })
    decideOpen.value = false
    await refresh()
  } catch (error: unknown) {
    decideError.value = firstApiMessage(error) ?? (error instanceof Error ? error.message : '')
  } finally {
    decideSubmitting.value = false
  }
}

async function onExecute(payload: { method: string, reference: string | null }): Promise<void> {
  if (executeTarget.value === null) {
    return
  }

  executeSubmitting.value = true
  executeError.value = ''

  try {
    await request(`/api/rms/refunds/${String(executeTarget.value.id)}/execute`, {
      method: 'POST',
      body: {
        method: payload.method,
        reference: payload.reference
      }
    })
    toast.add({ title: t('refunds.executedToast') })
    executeOpen.value = false
    await refresh()
  } catch (error: unknown) {
    executeError.value = firstApiMessage(error) ?? (error instanceof Error ? error.message : '')
  } finally {
    executeSubmitting.value = false
  }
}

async function onPanelUpdated(): Promise<void> {
  await refresh()
}
</script>

<template>
  <div>
    <DateRangeFilter
      v-model:from="from"
      v-model:to="to"
      :field-label="t('refunds.fieldLabel')"
      :noun="t('refunds.noun')"
      :total="total"
      :today="today"
    />

    <p class="notice refunds-notice">
      {{ t('refunds.notice', { days: String(rules.refund_business_days) }) }}
    </p>

    <div class="panel">
      <h3>{{ t('refunds.title') }}</h3>
      <div class="ebtool dep-toolbar">
        <div class="fchips">
          <button
            v-for="chip in CHIPS"
            :key="chip"
            type="button"
            class="fchip"
            :class="{ on: status === chip }"
            @click="status = chip"
          >
            {{ chipLabel(chip) }}
          </button>
        </div>
      </div>
      <div class="bk-table-wrap">
        <table class="list">
          <thead>
            <tr>
              <th>{{ t('refunds.colBooking') }}</th>
              <th>{{ t('refunds.colCancelled') }}</th>
              <th>{{ t('refunds.colDays') }}</th>
              <th>{{ t('refunds.colBand') }}</th>
              <th>{{ t('refunds.colPenalty') }}</th>
              <th>{{ t('refunds.colDue') }}</th>
              <th>{{ t('refunds.colSla') }}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            <tr
              v-if="rows.length === 0"
              class="dr-empty"
            >
              <td colspan="8">
                {{ t('refunds.empty') }}
              </td>
            </tr>
            <tr
              v-for="row in rows"
              :key="row.id"
              class="bk-row"
              @click="openBooking(row.booking.id)"
            >
              <td class="bk-ref">
                {{ row.booking.display_reference ?? row.booking.reference }}
              </td>
              <td>{{ row.cancelled_at === null ? '—' : format(row.cancelled_at, 'short') }}</td>
              <td>{{ row.days_before_arrival }}</td>
              <td>{{ t('refunds.band', { label: row.band_label, pct: String(row.penalty_pct) }) }}</td>
              <td>{{ money(row.penalty_amount) }}</td>
              <td>{{ t('refunds.dueOfPaid', { due: money(row.refund_due), paid: money(row.paid_at_cancellation) }) }}</td>
              <td>
                <span
                  class="slat"
                  :class="refundSlaDisplay(row.business_days_remaining, row.sla_breached).tone === 'bad' ? 'bad' : 'ok'"
                >{{ refundSlaDisplay(row.business_days_remaining, row.sla_breached).text }}</span>
              </td>
              <td
                class="list-actions"
                @click.stop
              >
                <template v-if="row.status === 'PENDING'">
                  <UButton
                    :disabled="!row.can_approve || !can('refunds.approve')"
                    @click="startDecide(row, 'APPROVED', $event)"
                  >
                    {{ t('refunds.approve') }}
                  </UButton>
                  <UButton
                    variant="outline"
                    :disabled="!row.can_approve || !can('refunds.approve')"
                    @click="startDecide(row, 'REJECTED', $event)"
                  >
                    {{ t('refunds.reject') }}
                  </UButton>
                </template>
                <UButton
                  v-else-if="row.status === 'APPROVED'"
                  :disabled="!row.can_execute || !can('refunds.execute')"
                  @click="startExecute(row, $event)"
                >
                  {{ t('refunds.execute') }}
                </UButton>
                <span
                  v-else-if="row.status === 'EXECUTED'"
                  class="pill p-canc"
                >{{ t('refunds.executed') }}</span>
                <span
                  v-else-if="row.decision_reason !== null"
                  class="bk-sub"
                >{{ t('refunds.rejectedReason', { reason: row.decision_reason }) }}</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <BookingPanel
      v-model:open="panelOpen"
      :booking="selected"
      initial-tab="payments"
      @updated="onPanelUpdated"
    />

    <ReasonModal
      v-model:open="decideOpen"
      :title="decideKind === 'APPROVED' ? t('refunds.approveTitle') : t('refunds.rejectTitle')"
      hint="required"
      :submitting="decideSubmitting"
      :error="decideError"
      @submit="onDecide"
    />

    <ExecuteRefundModal
      v-model:open="executeOpen"
      :amount="executeTarget?.refund_due ?? 0"
      :methods="optionsPayload?.methods ?? []"
      :submitting="executeSubmitting"
      :error="executeError"
      @submit="onExecute"
    />
  </div>
</template>
