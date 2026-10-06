import type { Booking, PaymentOption, PaymentStatus, PaymentsKpis } from '../../types/api'

export type LabeledOption = {
  value: string
  label: string
}

export function labelFrom(options: Array<LabeledOption>, value: string): string {
  return options.find(item => item.value === value)?.label ?? value
}

export function recordableOptions(options: Array<PaymentOption>): Array<PaymentOption> {
  return options.filter(item => item.recordable)
}

export function paymentStatusPillClass(status: PaymentStatus | string): string {
  if (status === 'SETTLED') {
    return 'p-conf'
  }

  if (status === 'AWAITING_WIRE') {
    return 'p-pend'
  }

  if (status === 'REFUNDED') {
    return 'p-canc'
  }

  return ''
}

export function signedMoney(amount: number, format: (usd: number) => string): string {
  if (amount < 0) {
    return `−${format(Math.abs(amount))}`
  }

  return format(amount)
}

export function overdueNotice(
  overdueDays: number,
  balance: number,
  format: (usd: number) => string
): string {
  return `Balance overdue by ${String(overdueDays)} days — ${format(balance)}. OPS-007: the team decides; nothing is cancelled automatically.`
}

export function defaultPaymentAmount(booking: Pick<Booking, 'paid' | 'deposit_amount' | 'balance'>): number {
  return booking.paid === 0 ? booking.deposit_amount : booking.balance
}

export type PaymentsKpiTone = 'default' | 'coral'

export type PaymentsKpiCard = {
  id: 'collected' | 'deposits' | 'pending' | 'overdue' | 'commission'
  labelKey: string
  value: number
  subKey: string
  subParams: Record<string, string>
  tone: PaymentsKpiTone
}

export function paymentsKpiCards(meta: PaymentsKpis): Array<PaymentsKpiCard> {
  return [
    {
      id: 'collected',
      labelKey: 'payments.kpiCollected',
      value: meta.collected,
      subKey: 'payments.kpiCollectedSub',
      subParams: {},
      tone: 'default'
    },
    {
      id: 'deposits',
      labelKey: 'payments.kpiDeposits',
      value: meta.deposits,
      subKey: 'payments.kpiDepositsSub',
      subParams: {
        charter: String(meta.charter_deposit_pct)
      },
      tone: 'default'
    },
    {
      id: 'pending',
      labelKey: 'payments.kpiPending',
      value: meta.pending,
      subKey: 'payments.kpiPendingSub',
      subParams: {
        n: String(meta.pending_count)
      },
      tone: 'default'
    },
    {
      id: 'overdue',
      labelKey: 'payments.kpiOverdue',
      value: meta.overdue_amount,
      subKey: 'payments.kpiOverdueSub',
      subParams: {},
      tone: 'coral'
    },
    {
      id: 'commission',
      labelKey: 'payments.kpiCommission',
      value: meta.commission_accrued,
      subKey: 'payments.kpiCommissionSub',
      subParams: { days: String(meta.commission_payable_days) },
      tone: 'default'
    }
  ]
}

export function reconciliationTone(count: number): PaymentsKpiTone {
  return count !== 0 ? 'coral' : 'default'
}

export function pendingDueLabel(
  booking: Pick<Booking, 'status' | 'balance_due_date'>,
  wireWindowHours: number
): string {
  if (booking.status === 'PENDING_PAYMENT') {
    return `${String(wireWindowHours)}h wire window`
  }

  return booking.balance_due_date
}

export function galapagosMonthRange(todayIso: string): { from: string, to: string } {
  const year = todayIso.slice(0, 4)
  const month = todayIso.slice(5, 7)
  const last = new Date(Date.UTC(Number(year), Number(month), 0)).getUTCDate()

  return {
    from: `${year}-${month}-01`,
    to: `${year}-${month}-${String(last).padStart(2, '0')}`
  }
}
