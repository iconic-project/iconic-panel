import { describe, expect, it } from 'vitest'
import {
  chargesRows,
  extraAddDefaults,
  extrasWritable,
  feeLabel,
  type ChargesBooking
} from '../../app/components/extras/extraHelpers'

function booking(partial: Partial<ChargesBooking> = {}): ChargesBooking {
  return {
    total: 26600,
    extras_total: 0,
    fees_collected_total: 0,
    png_pending_count: 0,
    charges_total: 26600,
    paid: 26600,
    pledged: 0,
    wire_window_ends_at: null,
    balance: 0,
    balance_due_date: '2026-01-15',
    deposit_pct: 10,
    deposit_amount: 2660,
    extras_due_at: '2028-03-02T12:00:00.000000Z',
    ...partial
  }
}

describe('extraHelpers', () => {
  it('builds the PNG and TCT checkbox sentences from API amounts', () => {
    expect(feeLabel('png', {
      pngKnownTotal: 400,
      pngPendingCount: 0,
      tctPp: 20,
      tctCount: 2
    })).toBe('Guest pays the PNG park entry fee to Iconic (USD 400 — by nationality, see Guests). Unchecked = paid directly at SCY airport on arrival.')

    expect(feeLabel('png', {
      pngKnownTotal: 200,
      pngPendingCount: 1,
      tctPp: 20,
      tctCount: 3
    })).toBe('Guest pays the PNG park entry fee to Iconic (USD 200 — by nationality, see Guests). Unchecked = paid directly at SCY airport on arrival. 1 guests pending data')

    expect(feeLabel('tct', {
      pngKnownTotal: 0,
      pngPendingCount: 0,
      tctPp: 20,
      tctCount: 3
    })).toBe('Iconic manages the TCT transit card (USD 20 × 3). Unchecked = guest pre-registers or pays at the origin airport.')
  })

  it('defaults quantity to the guest count and rate to the catalogue price', () => {
    expect(extraAddDefaults({ price_usd: 420 }, 2)).toEqual({ qty: 2, rateUsd: 420 })
    expect(extraAddDefaults({ price_usd: null }, 0)).toEqual({ qty: 1, rateUsd: null })
  })

  it('hides extras writes on cancelled or released bookings', () => {
    expect(extrasWritable('CONFIRMED', true)).toBe(true)
    expect(extrasWritable('CANCELLED', true)).toBe(false)
    expect(extrasWritable('CANCELLED_POSTPAID', true)).toBe(false)
    expect(extrasWritable('RELEASED', true)).toBe(false)
    expect(extrasWritable('CONFIRMED', false)).toBe(false)
  })

  it('shapes Overview rows from API fields and does not total them', () => {
    const ids = chargesRows(booking({
      extras_total: 840,
      fees_collected_total: 400,
      png_pending_count: 1,
      charges_total: 27840,
      paid: 26600,
      balance: 1240,
      pledged: 500,
      wire_window_ends_at: '2026-09-22T18:00:00.000000Z'
    })).map(row => row.id)

    expect(ids).toEqual([
      'stay',
      'extras',
      'fees',
      'rule',
      'charges',
      'paid',
      'pledged',
      'balance',
      'deposit',
      'extrasDue'
    ])
  })

  it('omits the extras-due line when the balance is settled or there are no extras or fees', () => {
    expect(chargesRows(booking({ extras_total: 840, charges_total: 27440, balance: 0 }))
      .some(row => row.id === 'extrasDue')).toBe(false)

    expect(chargesRows(booking({ extras_total: 0, fees_collected_total: 0, balance: 1000 }))
      .some(row => row.id === 'extrasDue')).toBe(false)

    expect(chargesRows(booking({ extras_total: 0, fees_collected_total: 400, charges_total: 27000, paid: 26600, balance: 400 }))
      .some(row => row.id === 'extrasDue')).toBe(true)
  })

  it('passes through the fees pending count without changing the amount', () => {
    const fees = chargesRows(booking({
      fees_collected_total: 400,
      png_pending_count: 2
    })).find(row => row.id === 'fees')

    expect(fees).toEqual({ id: 'fees', amount: 400, pendingCount: 2 })
  })
})
