import type { BlockReason } from '../../types/api'

export const ALL_CABIN_CODES = ['S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'S7', 'S8', 'OWNER'] as const

export const BLOCK_REASONS: Array<BlockReason> = [
  'FAM_TRIP',
  'MAINTENANCE',
  'NEGOTIATION_HOLD',
  'COURTESY'
]

export const MAX_DEPARTURES = 20

export type BlockListStatus = 'active' | 'released' | 'all'

export const STATUS_LABEL_KEYS: Record<BlockListStatus, string> = {
  active: 'blocks.statusActive',
  released: 'blocks.statusReleased',
  all: 'blocks.statusAll'
}

export type StoreInternalBlockBody = {
  reason: BlockReason
  notes?: string | null
  departures: Array<{
    departure_id: number
    cabin_codes: 'ALL' | Array<string>
  }>
}

export function applyFullYacht(checked: boolean): Array<string> {
  return checked ? [...ALL_CABIN_CODES] : []
}

export function isFullYacht(selected: Array<string>): boolean {
  return ALL_CABIN_CODES.every(code => selected.includes(code))
}

export function toggleCabin(selected: Array<string>, code: string): Array<string> {
  if (selected.includes(code)) {
    return selected.filter(item => item !== code)
  }

  return [...selected, code]
}

export function departureOptionLabel(dateLabel: string, itineraryName: string): string {
  return `${dateLabel} · ${itineraryName}`
}

export function blockToOpen<T extends { reference: string }>(
  open: string | Array<string> | null | undefined,
  blocks: Array<T>
): T | null {
  const reference = Array.isArray(open) ? open[0] : open

  if (typeof reference !== 'string' || reference === '') {
    return null
  }

  return blocks.find(block => block.reference === reference) ?? null
}

export function reasonLabelKey(reason: BlockReason): string {
  return `blocks.reasons.${reason}`
}

export function cabinsLabel(codes: Array<string>): string {
  const unique = Array.from(new Set(codes))

  if (ALL_CABIN_CODES.every(code => unique.includes(code))) {
    return 'Full yacht'
  }

  const suites: Array<number> = []
  let owner = false

  for (const code of unique) {
    if (code === 'OWNER') {
      owner = true
      continue
    }

    const match = /^S(\d+)$/.exec(code)

    if (match?.[1] !== undefined) {
      suites.push(Number(match[1]))
    }
  }

  suites.sort((left, right) => left - right)

  const parts = suiteRanges(suites)

  if (owner) {
    parts.push('Owner\'s Suite')
  }

  return parts.join(', ')
}

export function scopeLines(
  claims: Array<{
    cabin: { code: string }
    departure: {
      id: number
      date: string
      property?: { code: string }
      yacht?: { code: string }
    }
  }>,
  formatDate: (iso: string) => string
): Array<string> {
  const groups = new Map<number, {
    date: string
    yacht: string
    codes: Array<string>
  }>()

  for (const claim of claims) {
    const existing = groups.get(claim.departure.id)
    const code = claim.departure.property?.code ?? claim.departure.yacht?.code ?? ''

    if (existing === undefined) {
      groups.set(claim.departure.id, {
        date: claim.departure.date,
        yacht: code,
        codes: [claim.cabin.code]
      })
      continue
    }

    existing.codes.push(claim.cabin.code)
  }

  return Array.from(groups.values())
    .sort((left, right) => {
      if (left.date !== right.date) {
        return left.date < right.date ? -1 : 1
      }

      return left.yacht.localeCompare(right.yacht)
    })
    .map(group => `${formatDate(group.date)} · ${group.yacht} · ${cabinsLabel(group.codes)}`)
}

export function futureDepartures<T extends { date: string }>(
  departures: Array<T>,
  today: string
): Array<T> {
  return departures.filter(departure => departure.date >= today)
}

export function cabinCodesPayload(selected: Array<string>): 'ALL' | Array<string> {
  return isFullYacht(selected) ? 'ALL' : selected
}

export type RangeBlockRoom = {
  id: number
  code: string
  label: string
}

/** Mirrors the current InternalBlockResource. The generated schema still has claims. */
export type RangeBlock = {
  id: number
  reference: string
  property: {
    id: number
    code: string
    name: string
  }
  starts_on: string
  ends_on: string
  nights: number
  reason: BlockReason
  reason_label: string
  notes: string | null
  scope_summary: string
  rooms: Array<RangeBlockRoom>
  created_by: {
    id: number
    name: string
  } | null
  created_at: string | null
  released_at: string | null
  released_by: {
    id: number
    name: string
  } | null
  release_note: string | null
}

export type StoreRangeBlockBody = {
  starts_on: string
  ends_on: string
  reason: BlockReason
  notes?: string | null
  rooms?: Array<number>
  room_type_id?: number
  count?: number
}

export function storeRangeBlockBody(input: {
  startsOn: string
  endsOn: string
  reason: BlockReason
  notes: string
  roomIds: Array<number>
  roomTypeId: number | null
  count: number | null
  byType: boolean
}): StoreRangeBlockBody {
  const body: StoreRangeBlockBody = {
    starts_on: input.startsOn,
    ends_on: input.endsOn,
    reason: input.reason,
    notes: input.notes.trim() === '' ? null : input.notes.trim()
  }

  if (input.byType && input.roomTypeId !== null && input.count !== null) {
    body.room_type_id = input.roomTypeId
    body.count = input.count

    return body
  }

  body.rooms = input.roomIds

  return body
}

export type StayBounds = {
  minNights: number
  maxNights: number
  horizonDays: number
}

export function readStayBounds(document: unknown): StayBounds | null {
  if (typeof document !== 'object' || document === null || !('stay' in document)) {
    return null
  }

  const stay = document.stay

  if (typeof stay !== 'object' || stay === null) {
    return null
  }

  const minNights = numberField(stay, 'min_nights')
  const maxNights = numberField(stay, 'max_nights')
  const horizonDays = numberField(stay, 'booking_horizon_days')

  if (minNights === null || maxNights === null || horizonDays === null || minNights < 1 || maxNights < minNights || horizonDays < 1) {
    return null
  }

  return { minNights, maxNights, horizonDays }
}

function numberField(source: object, key: string): number | null {
  const value = (source as Record<string, unknown>)[key]

  return typeof value === 'number' && Number.isInteger(value) ? value : null
}

export type ShortenEdge = 'start' | 'end' | 'unchanged' | 'both'

export function shortenEdge(
  current: { starts_on: string, ends_on: string },
  next: { starts_on: string, ends_on: string }
): ShortenEdge {
  const startMoved = next.starts_on !== current.starts_on
  const endMoved = next.ends_on !== current.ends_on

  if (!startMoved && !endMoved) {
    return 'unchanged'
  }

  if (startMoved && next.starts_on > current.starts_on && next.ends_on === current.ends_on && next.starts_on < current.ends_on) {
    return 'start'
  }

  if (endMoved && next.starts_on === current.starts_on && next.ends_on < current.ends_on && next.ends_on > current.starts_on) {
    return 'end'
  }

  return 'both'
}

function suiteRanges(numbers: Array<number>): Array<string> {
  const ranges: Array<string> = []
  let start: number | null = null
  let end: number | null = null

  for (const number of numbers) {
    if (start === null || end === null) {
      start = end = number
      continue
    }

    if (number === end + 1) {
      end = number
      continue
    }

    ranges.push(rangeLabel(start, end))
    start = end = number
  }

  if (start !== null && end !== null) {
    ranges.push(rangeLabel(start, end))
  }

  return ranges
}

function rangeLabel(start: number, end: number): string {
  const from = `Suite ${String(start).padStart(2, '0')}`

  if (start === end) {
    return from
  }

  return `${from}–${String(end).padStart(2, '0')}`
}
