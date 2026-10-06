import type { BlockReason } from '../../types/api'

export const BLOCK_REASONS: Array<BlockReason> = [
  'FAM_TRIP',
  'MAINTENANCE',
  'NEGOTIATION_HOLD',
  'COURTESY'
]

export type BlockListStatus = 'active' | 'released' | 'all'

export const STATUS_LABEL_KEYS: Record<BlockListStatus, string> = {
  active: 'blocks.statusActive',
  released: 'blocks.statusReleased',
  all: 'blocks.statusAll'
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
