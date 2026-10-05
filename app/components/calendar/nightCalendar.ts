import type { NightCell, NightClaim, NightCounts, NightState } from '../../types/api'
import { addDays } from '../lists/dateRange'

export type BarState = Exclude<NightState, 'FREE'>

export type ClaimSpan = {
  claimGroup: string
  state: BarState
  firstNight: string
  lastNight: string
  reference: string | null
  guestSurname: string | null
  holderType: string
  holderId: number
}

export type NightBar = {
  claimGroup: string
  state: BarState
  startIndex: number
  span: number
  clippedStart: boolean
  clippedEnd: boolean
  reference: string | null
  guestSurname: string | null
  holderType: string
  holderId: number
  label: string
}

export function barLabel(reference: string | null, surname: string | null): string {
  const parts = [reference, surname].filter((part): part is string => part !== null && part !== '')

  return parts.join(' · ')
}

export function nightWindow(from: string, nights: number): { from: string, to: string } {
  return {
    from,
    to: addDays(from, nights)
  }
}

export function spansFromCells(cells: Array<NightCell>): Array<ClaimSpan> {
  const spans: Array<ClaimSpan> = []
  let current: ClaimSpan | null = null

  for (const cell of cells) {
    const claim = cell.claim

    if (claim === null || cell.state === 'FREE') {
      current = null
      continue
    }

    if (current !== null && current.claimGroup === claim.claim_group && current.lastNight === previousNight(cell.night)) {
      current.lastNight = cell.night
      continue
    }

    current = spanFrom(cell.night, cell.state, claim)
    spans.push(current)
  }

  return spans
}

export function placeBars(spans: Array<ClaimSpan>, nights: Array<string>): Array<NightBar> {
  if (nights.length === 0) {
    return []
  }

  const first = nights[0] ?? ''
  const last = nights[nights.length - 1] ?? ''
  const index = new Map(nights.map((night, position) => [night, position]))
  const bars: Array<NightBar> = []

  for (const span of spans) {
    const visible = nights.filter(night => night >= span.firstNight && night <= span.lastNight)

    if (visible.length === 0) {
      continue
    }

    const startNight = visible[0] ?? ''
    const startIndex = index.get(startNight)

    if (startIndex === undefined) {
      continue
    }

    bars.push({
      claimGroup: span.claimGroup,
      state: span.state,
      startIndex,
      span: visible.length,
      clippedStart: span.firstNight < first,
      clippedEnd: span.lastNight > last,
      reference: span.reference,
      guestSurname: span.guestSurname,
      holderType: span.holderType,
      holderId: span.holderId,
      label: barLabel(span.reference, span.guestSurname)
    })
  }

  return bars
}

export function nightOccupancyPct(rows: Array<Pick<NightCounts, 'free' | 'held' | 'sold'>>): number {
  let free = 0
  let held = 0
  let sold = 0

  for (const row of rows) {
    free += row.free
    held += row.held
    sold += row.sold
  }

  const available = free + held + sold

  if (available === 0) {
    return 0
  }

  return Math.floor((sold * 100) / available)
}

export function freeNightsBetween(cells: Array<NightCell>, from: string, to: string): boolean {
  const span = cells.filter(cell => cell.night >= from && cell.night <= to)

  return span.length > 0 && span.every(cell => cell.state === 'FREE')
}

function spanFrom(night: string, state: NightState, claim: NightClaim): ClaimSpan {
  return {
    claimGroup: claim.claim_group,
    state: state === 'FREE' ? 'SOLD' : state,
    firstNight: night,
    lastNight: night,
    reference: claim.reference,
    guestSurname: claim.guest_surname,
    holderType: claim.holder_type,
    holderId: claim.holder_id
  }
}

function previousNight(night: string): string {
  return addDays(night, -1)
}
