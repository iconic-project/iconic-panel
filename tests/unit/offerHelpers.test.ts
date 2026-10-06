import { describe, expect, it } from 'vitest'
import type { Offer } from '../../app/types/api'
import {
  addIsoDay,
  compactOfferWindow,
  emptyOfferForm,
  formFromOffer,
  offerFormToPayload,
  offerStatusPillClass
} from '../../app/components/offers/offerHelpers'

function sampleOffer(overrides: Partial<Offer> = {}): Offer {
  return {
    id: 1,
    reference: 'OF-001',
    code: 'OPENING-27',
    name: 'Opening season credit',
    type: 'CREDIT',
    value: 500,
    value_text: null,
    channel: 'D2C',
    partner: null,
    booking_from: null,
    booking_to: null,
    stay_from: '2027-11-01',
    stay_to: '2027-12-30',
    min_nights: 3,
    applies_to_room_types: ['STD'],
    applies_to_rate_plans: null,
    combinable: false,
    is_promo_code: false,
    badge: 'OPENING OFFER',
    show_on_card: true,
    show_on_calendar: true,
    price_line: 'Opening season credit',
    terms: 'Terms.',
    status: 'LIVE',
    stored_status: 'LIVE',
    approved_by: null,
    approved_at: null,
    approval_reason: null,
    benefit_label: 'USD 500 ancillary credit',
    scope_label: 'D2C · STD · All rate plans · min 3 nights',
    booking_window_label: 'Any',
    travel_window_label: '1 Nov 2027 → 31 Dec 2027',
    stay_window_label: '1 Nov 2027 → 30 Dec 2027',
    engine_placement: 'badge',
    ...overrides
  }
}

describe('offerHelpers', () => {
  it('maps offer status to prototype pill classes', () => {
    expect(offerStatusPillClass('DRAFT')).toBe('p-pend')
    expect(offerStatusPillClass('PENDING')).toBe('p-hold')
    expect(offerStatusPillClass('LIVE')).toBe('p-conf')
    expect(offerStatusPillClass('PAUSED')).toBe('p-comp')
    expect(offerStatusPillClass('EXPIRED')).toBe('p-wait')
    expect(offerStatusPillClass('UNKNOWN')).toBe('')
  })

  it('uppercases the code and turns empty optionals into null', () => {
    const form = emptyOfferForm()
    form.code = ' opening-27 '
    form.name = ' Opening '
    form.partner = '  '
    form.badge = 'OPENING'
    form.value = 500
    form.booking_from = ''
    form.stay_from = '2027-11-01'
    form.stay_to = '2027-12-30'
    form.min_nights = 3
    form.room_types = ['STD']

    expect(offerFormToPayload(form, true)).toEqual({
      code: 'OPENING-27',
      name: 'Opening',
      type: 'CREDIT',
      value: 500,
      value_text: null,
      channel: 'D2C',
      partner: null,
      stay_from: '2027-11-01',
      stay_to: '2027-12-30',
      min_nights: 3,
      applies_to_room_types: ['STD'],
      applies_to_rate_plans: null,
      booking_from: null,
      booking_to: null,
      combinable: false,
      is_promo_code: false,
      badge: 'OPENING',
      show_on_card: true,
      show_on_calendar: true,
      price_line: null,
      terms: null,
      as_draft: true
    })
  })

  it('round-trips an offer into the save payload without changing shape rules', () => {
    const payload = offerFormToPayload(formFromOffer(sampleOffer()), false)

    expect(payload.code).toBe('OPENING-27')
    expect(payload.as_draft).toBe(false)
    expect(payload.stay_from).toBe('2027-11-01')
    expect(payload.stay_to).toBe('2027-12-30')
    expect(payload.min_nights).toBe(3)
    expect(payload.applies_to_room_types).toEqual(['STD'])
    expect(payload.applies_to_rate_plans).toBeNull()
    expect(payload.booking_from).toBeNull()
  })

  it('uses the API stay window label when it is not Any', () => {
    expect(compactOfferWindow(sampleOffer())).toBe('1 Nov 2027 → 30 Dec 2027')
    expect(compactOfferWindow(sampleOffer({
      stay_window_label: 'Any',
      booking_window_label: '1 Jan 2027 → 31 Mar 2027'
    }))).toBe('1 Jan 2027 → 31 Mar 2027')
  })

  it('maps a stay window onto check-out as the day after the last night', () => {
    expect(addIsoDay('2027-12-30', 1)).toBe('2027-12-31')
    expect(addIsoDay('2027-12-31', -1)).toBe('2027-12-30')
  })
})
