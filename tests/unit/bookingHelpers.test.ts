import { describe, expect, it } from 'vitest'
import { useDates } from '#iconic-ui/app/composables/useDates'
import {
  BOOKING_TABS,
  bookingToOpen,
  displayReferenceMatch,
  formatMoveDifference,
  galapagosTomorrowIso,
  hasModificationFee,
  nightsBetween,
  reasonHint,
  reasonModalTitle,
  segmentPillClass,
  statusLabel,
  statusPillClass,
  tabAvailability,
  weekdayShort
} from '../../app/components/bookings/bookingHelpers'
import type { Booking } from '../../app/types/api'

const { format } = useDates()

function money(usd: number): string {
  return `USD ${usd.toLocaleString('en-US')}`
}

describe('bookingHelpers', () => {
  it('maps segment pills', () => {
    expect(segmentPillClass('D2C')).toBe('sg-d2c')
    expect(segmentPillClass('B2B')).toBe('sg-b2b')
    expect(segmentPillClass('CHARTER')).toBe('sg-ch')
  })

  it('maps status pills and labels', () => {
    expect(statusPillClass('REQUESTED')).toBe('p-req')
    expect(statusPillClass('FULLY_PAID')).toBe('p-full')
    expect(statusPillClass('OVERDUE')).toBe('p-over')
    expect(statusLabel('PENDING_PAYMENT')).toBe('PENDING PAYMENT')
    expect(statusLabel('IN_HOUSE')).toBe('In house')
    expect(statusLabel('CHECKED_OUT')).toBe('Checked out')
    expect(statusLabel('NO_SHOW')).toBe('No-show')
  })

  it('builds the reason-modal title and required hint', () => {
    expect(reasonModalTitle('CONFIRMED', 'CANCELLED')).toBe('Status CONFIRMED → CANCELLED')
    expect(reasonHint(true)).toBe('required')
    expect(reasonHint(false)).toBe('optional')
  })

  it('formats the move difference with a tone', () => {
    expect(formatMoveDifference(1500, money)).toEqual({ text: '+USD 1,500', tone: 'up' })
    expect(formatMoveDifference(-400, money)).toEqual({ text: '−USD 400', tone: 'down' })
    expect(formatMoveDifference(0, money)).toEqual({ text: 'USD 0', tone: 'same' })
  })

  it('marks which tabs are disabled this sprint', () => {
    expect(tabAvailability('overview').disabled).toBe(false)
    expect(tabAvailability('history').disabled).toBe(false)
    expect(tabAvailability('guests').disabled).toBe(false)
    expect(tabAvailability('extras').disabled).toBe(false)
    expect(tabAvailability('payments').disabled).toBe(false)
    expect(tabAvailability('documents').disabled).toBe(false)
    expect(tabAvailability('documents').arrivesSprint).toBeNull()
    expect(BOOKING_TABS.filter(tab => tab.disabled).map(tab => tab.id)).toEqual([])
  })

  it('derives weekdays and nights from two dates', () => {
    expect(weekdayShort('2027-11-07')).toBe('Sun')
    expect(weekdayShort('2027-11-14')).toBe('Sun')
    expect(nightsBetween('2027-11-07', '2027-11-14')).toBe(7)
  })

  it('uses the next Galápagos date after 23:30 GALT', () => {
    const now = new Date('2026-09-21T05:30:00.000Z')

    expect(galapagosTomorrowIso(now, (value, style, options) => format(value, style, options))).toBe('2026-09-21')
  })

  it('opens only on an exact display_reference', () => {
    const booking = { display_reference: 'ANK-2026-0003' } as Booking

    expect(displayReferenceMatch('ANK-2026-0003', 'ANK-2026-0003')).toBe(true)
    expect(displayReferenceMatch('ANK-2026-000', 'ANK-2026-0003')).toBe(false)
    expect(bookingToOpen('ANK-2026-0003', [booking])?.display_reference).toBe('ANK-2026-0003')
    expect(bookingToOpen('ANK-NOPE', [booking])).toBeNull()
  })

  it('detects a modification fee line', () => {
    expect(hasModificationFee([{ code: 'room', label: 'Room', amount: 26600 }])).toBe(false)
    expect(hasModificationFee([{ code: 'modification_fee', label: 'Modification fee (FIN-006)', amount: 0 }])).toBe(true)
  })
})
