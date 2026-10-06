import type {
  Offer,
  OfferChannel,
  OfferStatus,
  OfferType,
  StoreOfferRequest
} from '../../types/api'

export type OfferCodeOption = {
  code: string
  name: string
}

export type OfferForm = {
  code: string
  name: string
  type: OfferType
  value: number | null
  value_text: string
  channel: OfferChannel
  partner: string
  stay_from: string
  stay_to: string
  min_nights: number | null
  room_types: Array<string>
  rate_plans: Array<string>
  booking_from: string
  booking_to: string
  combinable: boolean
  is_promo_code: boolean
  badge: string
  show_on_card: boolean
  show_on_calendar: boolean
  price_line: string
  terms: string
}

export const OFFER_TYPES: Array<OfferType> = ['CREDIT', 'AMT', 'PCT', 'VALUE', 'COMM']
export const OFFER_CHANNELS: Array<OfferChannel> = ['D2C', 'B2B', 'ALL']

/**
 * Picker span for the offer stay window. Not a commercial rule.
 * Guest stay.max_nights is too short for a season window.
 */
export const OFFER_STAY_PICKER_MAX_NIGHTS = 366

export function offerStatusPillClass(status: OfferStatus | string): string {
  if (status === 'DRAFT') {
    return 'p-pend'
  }

  if (status === 'PENDING') {
    return 'p-hold'
  }

  if (status === 'LIVE') {
    return 'p-conf'
  }

  if (status === 'PAUSED') {
    return 'p-comp'
  }

  if (status === 'EXPIRED') {
    return 'p-wait'
  }

  return ''
}

function blankToNull(value: string): string | null {
  const trimmed = value.trim()

  return trimmed === '' ? null : trimmed
}

function codesOrNull(codes: Array<string>): Array<string> | null {
  return codes.length === 0 ? null : [...codes]
}

export function offerFormToPayload(form: OfferForm, asDraft: boolean): StoreOfferRequest {
  return {
    code: form.code.trim().toUpperCase(),
    name: form.name.trim(),
    type: form.type,
    value: form.value,
    value_text: blankToNull(form.value_text),
    channel: form.channel,
    partner: blankToNull(form.partner),
    stay_from: blankToNull(form.stay_from),
    stay_to: blankToNull(form.stay_to),
    min_nights: form.min_nights,
    applies_to_room_types: codesOrNull(form.room_types),
    applies_to_rate_plans: codesOrNull(form.rate_plans),
    booking_from: blankToNull(form.booking_from),
    booking_to: blankToNull(form.booking_to),
    combinable: form.combinable,
    is_promo_code: form.is_promo_code,
    badge: blankToNull(form.badge),
    show_on_card: form.show_on_card,
    show_on_calendar: form.show_on_calendar,
    price_line: blankToNull(form.price_line),
    terms: blankToNull(form.terms),
    as_draft: asDraft
  }
}

export function emptyOfferForm(): OfferForm {
  return {
    code: '',
    name: '',
    type: 'CREDIT',
    value: 0,
    value_text: '',
    channel: 'D2C',
    partner: '',
    stay_from: '',
    stay_to: '',
    min_nights: null,
    room_types: [],
    rate_plans: [],
    booking_from: '',
    booking_to: '',
    combinable: false,
    is_promo_code: false,
    badge: '',
    show_on_card: true,
    show_on_calendar: true,
    price_line: '',
    terms: ''
  }
}

export function formFromOffer(offer: Offer): OfferForm {
  return {
    code: offer.code,
    name: offer.name,
    type: offer.type,
    value: offer.value,
    value_text: offer.value_text ?? '',
    channel: offer.channel,
    partner: offer.partner ?? '',
    stay_from: offer.stay_from ?? '',
    stay_to: offer.stay_to ?? '',
    min_nights: offer.min_nights,
    room_types: [...(offer.applies_to_room_types ?? [])],
    rate_plans: [...(offer.applies_to_rate_plans ?? [])],
    booking_from: offer.booking_from ?? '',
    booking_to: offer.booking_to ?? '',
    combinable: offer.combinable,
    is_promo_code: offer.is_promo_code,
    badge: offer.badge ?? '',
    show_on_card: offer.show_on_card,
    show_on_calendar: offer.show_on_calendar,
    price_line: offer.price_line ?? '',
    terms: offer.terms ?? ''
  }
}

export function compactOfferWindow(offer: Offer): string {
  if (offer.stay_window_label !== 'Any') {
    return offer.stay_window_label
  }

  return offer.booking_window_label
}

export function addIsoDay(iso: string, days: number): string {
  const [year, month, day] = iso.split('-').map(Number)
  const date = new Date(Date.UTC(year ?? 1970, (month ?? 1) - 1, day ?? 1))
  date.setUTCDate(date.getUTCDate() + days)

  return date.toISOString().slice(0, 10)
}
