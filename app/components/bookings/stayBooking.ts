export type DeskAction = 'check_in' | 'check_out' | 'no_show' | 'modify_stay' | 'move_room'

export type DeskTab = 'arrivals' | 'in_house' | 'departures'

export type StayRoomDraft = {
  room_type: string
  adults: number
  child_ages: number[]
  rate_plan: string | null
  room_id: number | null
  check_in: string | null
  check_out: string | null
}

export type StayQuoteLine = {
  night: string
  total: number
}

export type StayTaxLine = {
  code: string
  label: string
  amount: number
  charged: boolean
}

export type StayQuote = {
  check_in: string
  check_out: string
  rooms: Array<{
    room_type: string
    quote: {
      night_lines: StayQuoteLine[]
      tax_lines: StayTaxLine[]
      total: number
      deposit: number
      deposit_pct: number
    } | null
    errors: string[]
    warnings: string[]
  }>
  total: number | null
  deposit: number | null
  total_including_charged_taxes: number | null
}

export type StayModifyPreview = {
  check_in: string
  check_out: string
  nights: number
  current_total: number
  new_total: number
  deposit?: number
  balance: number
  modification_fee: number
  penalty: number
  night_lines: StayQuoteLine[]
  tax_lines: StayTaxLine[]
}

export const NIGHT_AUDIT_KINDS = [
  'ARRIVAL_NOT_CHECKED_IN',
  'IN_HOUSE_PAST_CHECK_OUT',
  'DEPARTURE_NOT_CHECKED_OUT'
] as const

export const MAIN_CHANNELS = [
  'D2C',
  'B2B',
  'B2B – Travel Advisor',
  'B2B – Tour Operator',
  'B2B – Corporate',
  'Wholesale / Distribution',
  'Partners',
  'Other'
] as const

const DESK_ACTIONS: DeskAction[] = ['check_in', 'check_out', 'no_show', 'modify_stay', 'move_room']

export function stayRoomRow(room: StayRoomDraft): Record<string, unknown> {
  const row: Record<string, unknown> = {
    room_type: room.room_type,
    adults: room.adults,
    child_ages: room.child_ages
  }

  if (room.rate_plan) {
    row.rate_plan = room.rate_plan
  }

  if (room.room_id !== null) {
    row.room_id = room.room_id
  }

  if (room.check_in && room.check_out) {
    row.check_in = room.check_in
    row.check_out = room.check_out
  }

  return row
}

export function stayQuoteBody(checkIn: string, checkOut: string, rooms: StayRoomDraft[]): Record<string, unknown> {
  return {
    check_in: checkIn,
    check_out: checkOut,
    rooms: rooms.map(stayRoomRow)
  }
}

export function stayBookingBody(input: {
  checkIn: string
  checkOut: string
  rooms: StayRoomDraft[]
  clientName: string
  clientEmail: string
  clientPhone: string
  mainChannel: string
  channelOfOrigin: string
  expectedTotal: number
  override: boolean
  overrideReason: string
  groupName: string
  expectedArrivalTime: string
}): Record<string, unknown> {
  const body: Record<string, unknown> = {
    ...stayQuoteBody(input.checkIn, input.checkOut, input.rooms),
    client: {
      name: input.clientName,
      email: input.clientEmail || null,
      phone: input.clientPhone || null
    },
    main_channel: input.mainChannel,
    channel_of_origin: input.channelOfOrigin,
    expected_total: input.expectedTotal
  }

  if (input.expectedArrivalTime !== '') {
    body.expected_arrival_time = input.expectedArrivalTime
  }

  if (input.groupName.trim() !== '') {
    body.group = { name: input.groupName.trim() }
  }

  if (input.override) {
    body.override_restrictions = true
    body.override_reason = input.overrideReason
  }

  return body
}

export function deskActionsVisible(allowed: readonly string[]): Record<DeskAction, boolean> {
  const present = new Set(allowed)

  return {
    check_in: present.has('check_in'),
    check_out: present.has('check_out'),
    no_show: present.has('no_show'),
    modify_stay: present.has('modify_stay'),
    move_room: present.has('move_room')
  }
}

export function deskActionPath(id: number, action: 'check-in' | 'check-out' | 'no-show' | 'modify' | 'modify/preview' | 'move'): string {
  return `/api/rms/bookings/${id}/${action}`
}

export function frontDeskParams(tab: DeskTab, date: string): Record<string, string> {
  if (tab === 'arrivals') {
    return { arriving_from: date, arriving_to: date }
  }

  if (tab === 'departures') {
    return { departing_from: date, departing_to: date }
  }

  return { in_house_on: date }
}

export function nightAuditAlerts<T extends { kind: string }>(alerts: readonly T[]): T[] {
  const kinds = new Set<string>(NIGHT_AUDIT_KINDS)

  return alerts.filter(alert => kinds.has(alert.kind))
}

export function quoteFailures(quote: StayQuote | null): string[] {
  if (quote === null) {
    return []
  }

  return quote.rooms.flatMap(room => room.errors)
}

export function isDeskAction(value: string): value is DeskAction {
  return DESK_ACTIONS.includes(value as DeskAction)
}

export function addIsoDays(iso: string, days: number): string {
  const date = new Date(`${iso}T00:00:00.000Z`)
  date.setUTCDate(date.getUTCDate() + days)

  return date.toISOString().slice(0, 10)
}
