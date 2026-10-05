export type RestrictionFlag = 'stop_sell' | 'closed_to_arrival' | 'closed_to_departure'

export type RestrictionRow = {
  night: string
  room_type_id: number | null
  stop_sell: boolean
  closed_to_arrival: boolean
  closed_to_departure: boolean
  min_stay: number | null
  max_stay: number | null
  note: string | null
}

export type RestrictionFieldKey = RestrictionFlag | 'min_stay' | 'max_stay' | 'note'

export type RestrictionDraft = {
  propertyId: number
  roomTypeIds: Array<number>
  from: string
  to: string
  weekdays: Array<number>
  stopSell: boolean | null
  closedToArrival: boolean | null
  closedToDeparture: boolean | null
  minStay: number | null | undefined
  maxStay: number | null | undefined
  note: string | null | undefined
  reason: string
}

const WEEKDAYS = [1, 2, 3, 4, 5, 6, 7]

export function restrictionPayload(draft: RestrictionDraft): Record<string, unknown> {
  const body: Record<string, unknown> = {
    property_id: draft.propertyId,
    room_type_ids: draft.roomTypeIds,
    from: draft.from,
    to: draft.to
  }

  const days = [...new Set(draft.weekdays)].sort((left, right) => left - right)

  if (days.length < WEEKDAYS.length) {
    body.weekdays = days
  }

  if (draft.stopSell !== null) {
    body.stop_sell = draft.stopSell
  }

  if (draft.closedToArrival !== null) {
    body.closed_to_arrival = draft.closedToArrival
  }

  if (draft.closedToDeparture !== null) {
    body.closed_to_departure = draft.closedToDeparture
  }

  if (draft.minStay !== undefined) {
    body.min_stay = draft.minStay
  }

  if (draft.maxStay !== undefined) {
    body.max_stay = draft.maxStay
  }

  if (draft.note !== undefined) {
    body.note = draft.note
  }

  const reason = draft.reason.trim()

  if (reason !== '') {
    body.reason = reason
  }

  return body
}

export function winningRestriction(
  rows: Array<RestrictionRow>,
  night: string,
  roomTypeId: number
): RestrictionRow | null {
  const onNight = rows.filter(row => row.night === night)
  const typed = onNight.find(row => row.room_type_id === roomTypeId)

  if (typed !== undefined) {
    return typed
  }

  return onNight.find(row => row.room_type_id === null) ?? null
}

export function restrictionMarks(row: RestrictionRow | null): string {
  if (row === null) {
    return ''
  }

  const marks: Array<string> = []

  if (row.stop_sell) {
    marks.push('SS')
  }

  if (row.closed_to_arrival) {
    marks.push('CTA')
  }

  if (row.closed_to_departure) {
    marks.push('CTD')
  }

  if (row.min_stay !== null || row.max_stay !== null) {
    marks.push(`${row.min_stay ?? '–'}–${row.max_stay ?? '–'}`)
  }

  return marks.join(' ')
}
