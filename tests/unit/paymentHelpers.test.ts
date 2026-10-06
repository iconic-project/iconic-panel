import { describe, expect, it } from 'vitest'
import type { Booking, PaymentOption, PaymentsKpis } from '../../app/types/api'
import {
  defaultPaymentAmount,
  galapagosMonthRange,
  labelFrom,
  overdueNotice,
  paymentStatusPillClass,
  pendingDueLabel,
  paymentsKpiCards,
  reconciliationTone,
  recordableOptions,
  signedMoney
} from '../../app/components/payments/paymentHelpers'

function money(usd: number): string {
  return `USD ${usd.toLocaleString('en-US')}`
}

const kinds: Array<PaymentOption> = [
  { value: 'DEPOSIT', label: 'Deposit', recordable: true },
  { value: 'BALANCE', label: 'Balance', recordable: true },
  { value: 'REFUND', label: 'Refund', recordable: false }
]

describe('paymentHelpers', () => {
  it('looks up labels and falls back to the raw value', () => {
    expect(labelFrom(kinds, 'DEPOSIT')).toBe('Deposit')
    expect(labelFrom(kinds, 'REFUND')).toBe('Refund')
    expect(labelFrom([], 'DEPOSIT')).toBe('DEPOSIT')
  })

  it('keeps only recordable options for the form', () => {
    expect(recordableOptions(kinds).map(item => item.value)).toEqual(['DEPOSIT', 'BALANCE'])
  })

  it('maps status pills only', () => {
    expect(paymentStatusPillClass('SETTLED')).toBe('p-conf')
    expect(paymentStatusPillClass('AWAITING_WIRE')).toBe('p-pend')
    expect(paymentStatusPillClass('REFUNDED')).toBe('p-canc')
    expect(paymentStatusPillClass('OTHER')).toBe('')
  })

  it('formats refunds with a minus and leaves positives unchanged', () => {
    expect(signedMoney(-1330, money)).toBe('−USD 1,330')
    expect(signedMoney(2660, money)).toBe('USD 2,660')
  })

  it('builds the OPS-007 overdue sentence from API numbers', () => {
    expect(overdueNotice(12, 23940, money)).toBe(
      'Balance overdue by 12 days — USD 23,940. OPS-007: the team decides; nothing is cancelled automatically.'
    )
  })

  it('prefills deposit when nothing is paid, otherwise the balance', () => {
    const unpaid = { paid: 0, deposit_amount: 2660, balance: 26600 } as Booking
    const partial = { paid: 2660, deposit_amount: 2660, balance: 23940 } as Booking

    expect(defaultPaymentAmount(unpaid)).toBe(2660)
    expect(defaultPaymentAmount(partial)).toBe(23940)
  })

  it('shapes KPI cards from API meta without arithmetic', () => {
    const meta = {
      collected: 5000,
      deposits: 2660,
      pending: 23940,
      pending_count: 2,
      overdue_count: 1,
      overdue_amount: 12000,
      commission_accrued: 2660,
      charter_deposit_pct: 20,
      commission_payable_days: 30,
      commission_cap_pct: 12,
      wire_window_hours: 72
    } as PaymentsKpis

    const cards = paymentsKpiCards(meta)

    expect(cards.map(card => card.value)).toEqual([5000, 2660, 23940, 12000, 2660])
    expect(cards[1]?.subParams).toEqual({ charter: '20' })
    expect(cards[2]?.subParams).toEqual({ n: '2' })
    expect(cards[3]?.tone).toBe('coral')
    expect(cards[4]?.subParams).toEqual({ days: '30' })
  })

  it('marks a non-zero reconciliation count as coral', () => {
    expect(reconciliationTone(0)).toBe('default')
    expect(reconciliationTone(2)).toBe('coral')
  })

  it('uses the wire window for PENDING_PAYMENT and the due date otherwise', () => {
    expect(pendingDueLabel({ status: 'PENDING_PAYMENT', balance_due_date: '2027-08-14' } as Booking, 72))
      .toBe('72h wire window')
    expect(pendingDueLabel({ status: 'CONFIRMED', balance_due_date: '2027-08-14' } as Booking, 72))
      .toBe('2027-08-14')
  })

  it('returns the Galápagos calendar month that contains today', () => {
    expect(galapagosMonthRange('2026-09-21')).toEqual({ from: '2026-09-01', to: '2026-09-30' })
    expect(galapagosMonthRange('2026-02-03')).toEqual({ from: '2026-02-01', to: '2026-02-28' })
  })
})
