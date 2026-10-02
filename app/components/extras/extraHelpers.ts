import type { Booking, BookingStatus, ExtrasCatalogueItem } from '../../types/api'
import { formatUsd } from '../../utils/formatConfigValue'

const TERMINAL: Array<BookingStatus> = ['CANCELLED', 'CANCELLED_POSTPAID', 'RELEASED']

export type FeeKind = 'png' | 'tct'

export type FeeAmounts = {
  pngKnownTotal: number
  pngPendingCount: number
  tctPp: number
  tctCount: number
}

export type ChargesBooking = Pick<
  Booking,
  | 'total'
  | 'extras_total'
  | 'fees_collected_total'
  | 'png_pending_count'
  | 'charges_total'
  | 'paid'
  | 'pledged'
  | 'wire_window_ends_at'
  | 'balance'
  | 'balance_due_date'
  | 'deposit_pct'
  | 'deposit_amount'
  | 'extras_due_at'
>

export type ChargeRow
  = | { id: 'cruise', amount: number }
    | { id: 'extras', amount: number }
    | { id: 'fees', amount: number, pendingCount: number }
    | { id: 'rule' }
    | { id: 'charges', amount: number }
    | { id: 'paid', amount: number }
    | { id: 'pledged', amount: number, endsAt: string | null }
    | { id: 'balance', amount: number, dueDate: string }
    | { id: 'deposit', amount: number, pct: number }
    | { id: 'extrasDue', dueAt: string | null }

export function extrasWritable(status: BookingStatus, canAct: boolean): boolean {
  return canAct && !TERMINAL.includes(status)
}

export function feeLabel(kind: FeeKind, amounts: FeeAmounts): string {
  if (kind === 'png') {
    let sentence = `Guest pays the PNG park entry fee to Iconic (${formatUsd(amounts.pngKnownTotal)} — by nationality, see Guests). Unchecked = paid directly at SCY airport on arrival.`

    if (amounts.pngPendingCount > 0) {
      sentence += ` ${String(amounts.pngPendingCount)} guests pending data`
    }

    return sentence
  }

  return `Iconic manages the TCT transit card (${formatUsd(amounts.tctPp)} × ${String(amounts.tctCount)}). Unchecked = guest pre-registers or pays at the origin airport.`
}

export function extraAddDefaults(
  item: Pick<ExtrasCatalogueItem, 'price_usd'>,
  guestCount: number
): { qty: number, rateUsd: number | null } {
  return {
    qty: guestCount > 0 ? guestCount : 1,
    rateUsd: item.price_usd
  }
}

export function chargesRows(booking: ChargesBooking): Array<ChargeRow> {
  const rows: Array<ChargeRow> = [
    { id: 'cruise', amount: booking.total },
    { id: 'extras', amount: booking.extras_total },
    { id: 'fees', amount: booking.fees_collected_total, pendingCount: booking.png_pending_count },
    { id: 'rule' },
    { id: 'charges', amount: booking.charges_total },
    { id: 'paid', amount: booking.paid }
  ]

  if (booking.pledged > 0) {
    rows.push({ id: 'pledged', amount: booking.pledged, endsAt: booking.wire_window_ends_at })
  }

  rows.push(
    { id: 'balance', amount: booking.balance, dueDate: booking.balance_due_date },
    { id: 'deposit', amount: booking.deposit_amount, pct: booking.deposit_pct }
  )

  if (
    booking.balance > 0
    && (booking.extras_total > 0 || booking.fees_collected_total > 0)
  ) {
    rows.push({ id: 'extrasDue', dueAt: booking.extras_due_at })
  }

  return rows
}
