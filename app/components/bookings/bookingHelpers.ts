import type { Booking, BookingSegment, BookingStatus, PriceLine } from '../../types/api'
import { addDays } from '../lists/dateRange'

const GALAPAGOS_TZ = 'Pacific/Galapagos'

const WEEKDAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const

const STATUS_PILL: Record<BookingStatus, string> = {
  REQUESTED: 'p-req',
  CONFIRMED: 'p-conf',
  FULLY_PAID: 'p-full',
  PENDING_PAYMENT: 'p-pend',
  OVERDUE: 'p-over',
  COMPLETED: 'p-comp',
  CANCELLED: 'p-canc',
  CANCELLED_POSTPAID: 'p-canc',
  ON_BOARD: 'p-full',
  WAITLISTED: 'p-wait',
  RELEASED: 'p-canc',
  ON_HOLD_AGENCY: 'p-hold',
  IN_HOUSE: 'p-full',
  CHECKED_OUT: 'p-comp',
  NO_SHOW: 'p-over'
}

const MOVABLE: Array<BookingStatus> = [
  'REQUESTED',
  'PENDING_PAYMENT',
  'CONFIRMED',
  'FULLY_PAID'
]

export type BookingTabId = 'overview' | 'guests' | 'extras' | 'payments' | 'documents' | 'history'

export type BookingTab = {
  id: BookingTabId
  labelKey: string
  disabled: boolean
  arrivesSprint: number | null
}

export const BOOKING_TABS: Array<BookingTab> = [
  { id: 'overview', labelKey: 'bookings.tabOverview', disabled: false, arrivesSprint: null },
  { id: 'guests', labelKey: 'bookings.tabGuests', disabled: false, arrivesSprint: null },
  { id: 'extras', labelKey: 'bookings.tabExtras', disabled: false, arrivesSprint: null },
  { id: 'payments', labelKey: 'bookings.tabPayments', disabled: false, arrivesSprint: null },
  { id: 'documents', labelKey: 'bookings.tabDocuments', disabled: false, arrivesSprint: null },
  { id: 'history', labelKey: 'bookings.tabHistory', disabled: false, arrivesSprint: null }
]

export type MoveDifferenceTone = 'same' | 'up' | 'down'

export function segmentPillClass(segment: BookingSegment): string {
  if (segment === 'D2C') {
    return 'sg-d2c'
  }

  if (segment === 'B2B') {
    return 'sg-b2b'
  }

  return 'sg-ch'
}

export function statusPillClass(status: BookingStatus): string {
  return STATUS_PILL[status] ?? ''
}

export function statusLabel(status: string): string {
  if (status === 'IN_HOUSE') {
    return 'In house'
  }

  if (status === 'CHECKED_OUT') {
    return 'Checked out'
  }

  if (status === 'NO_SHOW') {
    return 'No-show'
  }

  return status.replaceAll('_', ' ')
}

export function statusText(status: string, translate: (key: string) => string): string {
  if (status === 'IN_HOUSE') {
    return translate('bookings.statusInHouse')
  }

  if (status === 'CHECKED_OUT') {
    return translate('bookings.statusCheckedOut')
  }

  if (status === 'NO_SHOW') {
    return translate('bookings.statusNoShow')
  }

  return statusLabel(status)
}

export function reasonModalTitle(from: string, to: string): string {
  return `Status ${statusLabel(from)} → ${statusLabel(to)}`
}

export function reasonHint(required: boolean): 'required' | 'optional' {
  return required ? 'required' : 'optional'
}

export function formatMoveDifference(
  difference: number,
  formatMoney: (usd: number) => string
): { text: string, tone: MoveDifferenceTone } {
  if (difference === 0) {
    return { text: formatMoney(0), tone: 'same' }
  }

  const sign = difference > 0 ? '+' : '−'

  return {
    text: `${sign}${formatMoney(Math.abs(difference))}`,
    tone: difference > 0 ? 'up' : 'down'
  }
}

export function tabAvailability(id: BookingTabId): BookingTab {
  return BOOKING_TABS.find(tab => tab.id === id) ?? {
    id: 'overview',
    labelKey: 'bookings.tabOverview',
    disabled: false,
    arrivesSprint: null
  }
}

export function canMoveStatus(status: BookingStatus): boolean {
  return MOVABLE.includes(status)
}

export function weekdayShort(iso: string): string {
  return WEEKDAYS_SHORT[new Date(`${iso}T00:00:00.000Z`).getUTCDay()] ?? ''
}

export function nightsBetween(from: string, to: string): number {
  const start = Date.parse(`${from}T00:00:00.000Z`)
  const end = Date.parse(`${to}T00:00:00.000Z`)

  return Math.round((end - start) / 86_400_000)
}

export function departureOverviewLabel(
  date: string,
  returnDate: string,
  embark: string,
  formatShort: (iso: string) => string
): string {
  const nights = nightsBetween(date, returnDate)

  return `${formatShort(date)} · ${nights} nights · ${weekdayShort(date)}→${weekdayShort(returnDate)} · ${embark}`
}

export function galapagosTodayIso(
  now: Date,
  formatIso: (value: Date, style: 'iso', options: { timeZone: string }) => string
): string {
  return formatIso(now, 'iso', { timeZone: GALAPAGOS_TZ })
}

export function galapagosTomorrowIso(
  now: Date,
  formatIso: (value: Date, style: 'iso', options: { timeZone: string }) => string
): string {
  return addDays(galapagosTodayIso(now, formatIso), 1)
}

export function displayReferenceMatch(open: string, reference: string | null): boolean {
  return reference !== null && open === reference
}

export function bookingToOpen(
  open: string | Array<string> | undefined,
  bookings: Array<Booking>
): Booking | null {
  const value = Array.isArray(open) ? open[0] : open

  if (typeof value !== 'string' || value === '') {
    return null
  }

  return bookings.find(booking => displayReferenceMatch(value, booking.display_reference)) ?? null
}

export function hasModificationFee(lines: Array<PriceLine>): boolean {
  return lines.some(line => line.code === 'modification_fee')
}

export function departureOptionLabel(
  date: string,
  yachtName: string,
  itineraryName: string,
  festive: boolean,
  formatShort: (iso: string) => string
): string {
  const base = `${formatShort(date)} · ${yachtName} · ${itineraryName}`

  return festive ? `${base} · FESTIVE (+supplement, discounts blocked)` : base
}
