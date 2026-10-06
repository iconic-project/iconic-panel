export type EngineMapSource = 'NEW' | 'EXISTING' | 'NEW + EXISTING' | 'NOT YET'

export type EngineMapRow = {
  id: string
  source: EngineMapSource
}

export type EngineMapNote = {
  id: string
  emphasis: boolean
}

export const engineMapRows: readonly EngineMapRow[] = [
  { id: 'salesCalendar', source: 'NEW' },
  { id: 'guestRules', source: 'NEW' },
  { id: 'searchWindow', source: 'NEW' },
  { id: 'locale', source: 'NEW' },
  { id: 'card', source: 'NEW' },
  { id: 'suitesFrom', source: 'EXISTING' },
  { id: 'overview', source: 'NEW' },
  { id: 'availability', source: 'NEW + EXISTING' },
  { id: 'waitlist', source: 'NEW + EXISTING' },
  { id: 'offerBadge', source: 'NEW' },
  { id: 'tripTitle', source: 'NEW' },
  { id: 'tabs', source: 'NEW' },
  { id: 'railFrom', source: 'EXISTING' },
  { id: 'sidebarNotes', source: 'NEW' },
  { id: 'deckPlan', source: 'EXISTING' },
  { id: 'priceLines', source: 'EXISTING' },
  { id: 'offerLine', source: 'NEW' },
  { id: 'deposit', source: 'EXISTING' },
  { id: 'feeEstimates', source: 'NEW' },
  { id: 'contact', source: 'EXISTING' },
  { id: 'payToday', source: 'NEW' },
  { id: 'hold', source: 'EXISTING' },
  { id: 'requestId', source: 'EXISTING' },
  { id: 'nextSteps', source: 'NEW' },
  { id: 'charterRate', source: 'EXISTING' },
  { id: 'charterCopy', source: 'NEW' },
  { id: 'charterEnquiry', source: 'EXISTING' }
]

export const engineMapDecisions: readonly EngineMapNote[] = [
  { id: 'parkFee', emphasis: false },
  { id: 'deposit', emphasis: true },
  { id: 'annualIncrease', emphasis: false },
  { id: 'pngFee', emphasis: false },
  { id: 'invoicing', emphasis: false },
  { id: 'season', emphasis: false },
  { id: 'dpng', emphasis: true },
  { id: 'payments', emphasis: false },
  { id: 'backToBack', emphasis: true },
  { id: 'rmsValues', emphasis: false }
]

export const engineMapOpen: readonly EngineMapNote[] = [
  { id: 'cancellation', emphasis: false },
  { id: 'privacy', emphasis: false },
  { id: 'bank', emphasis: false },
  { id: 'fleet', emphasis: false },
  { id: 'signature', emphasis: false },
  { id: 'onBoard', emphasis: false },
  { id: 'photography', emphasis: false }
]

export type EngineMapCounts = {
  mapped: number
  fedByNew: number
  fedByExisting: number
  notYet: number
}

export function engineMapCounts(rows: readonly EngineMapRow[]): EngineMapCounts {
  const count = (kind: EngineMapSource): number => rows.filter(row =>
    row.source === kind || (kind === 'NEW' && row.source === 'NEW + EXISTING')
  ).length

  return {
    mapped: rows.length,
    fedByNew: count('NEW'),
    fedByExisting: count('EXISTING'),
    notYet: count('NOT YET')
  }
}

export function engineMapPillClass(source: EngineMapSource): string {
  if (source === 'EXISTING') {
    return 'p-pend'
  }

  if (source === 'NOT YET') {
    return 'p-canc'
  }

  return 'p-conf'
}

export function engineMapPillKey(source: EngineMapSource): string | null {
  if (source === 'NEW') {
    return 'engineMap.pillNew'
  }

  if (source === 'EXISTING') {
    return 'engineMap.pillExisting'
  }

  if (source === 'NOT YET') {
    return 'engineMap.pillNotYet'
  }

  return null
}

export function engineMapMissingIsGap(count: number): boolean {
  return count > 0
}
