import type { ComputedRef, InjectionKey } from 'vue'
import type {
  BusinessRulesDocument,
  RuleRegistryCounts,
  RuleRegistryRow,
  RuleStatus,
  RuleWhere
} from '../../types/api'
import { cloneDocument, documentsEqual } from '../../utils/documentsEqual'
import { parseRinValue } from '../../utils/parseRinValue'

export type BusinessRulesDraft = {
  commission: {
    cap_pct: number | null
    default_pct: number | null
    payable_days_after_cruise: number | null
  }
  modification_fee_usd: number | null
  payments: {
    extras_due_hours: number | null
    wire_window_hours: number | null
    balance_reminder_days: Array<number | null>
  }
  discounts: {
    online_deposit_discount_pct: number | null
    max_total_discount_pct: number | null
  }
  holds: {
    web_minutes: number | null
    web_extension_minutes: number | null
    near_term_business_hours: number | null
    long_lead_business_days: number | null
  }
  sla: {
    response_hours: number | null
    refund_business_days: number | null
    agency_approval_business_days: number | null
  }
  manifests: {
    dpng_fit_days: number | null
    dpng_charter_days: number | null
  }
  alerts: {
    low_occupancy_pct: number | null
    low_occupancy_days_before: number | null
  }
  retention: {
    passport_months_after_cruise: number | null
    medical_days_after_cruise: number | null
  }
  cancellation: {
    bands: Array<BandDraft>
  }
}

export type BandDraft = {
  min_days: number | null
  penalty_pct: number | null
}

export type RuleFieldMeta = {
  unit: string
  min: number
  max: number
  prefix?: 'USD'
}

export type RulePillTone = 'neutral' | 'ok' | 'warn' | 'coral' | 'sand'

export type RuleChip = 'ALL' | 'HERE' | 'TABS' | 'LOCK' | 'DIFF'

export type RuleChipState = {
  counts: RuleRegistryCounts
  visible: Array<RuleRegistryRow>
  groups: Array<{ label: string, rows: Array<RuleRegistryRow> }>
}

export const RULES_DRAFT_KEY: InjectionKey<ComputedRef<BusinessRulesDraft | null>> = Symbol('business-rules-draft')

export const DEFAULT_BAND: BandDraft = {
  min_days: 60,
  penalty_pct: 75
}

export const MAX_BANDS = 6

const PENDING_STATUSES: Array<RuleStatus> = [
  'PENDING_CLIENT',
  'PENDING_LEGAL',
  'TEXT_IN_DRAFTING'
]

const OTHER_PAGES: Array<RuleWhere> = [
  'rates',
  'engine_settings',
  'departures'
]

const FIELD_META: Record<string, RuleFieldMeta> = {
  'commission.cap_pct': { unit: '%', min: 0, max: 30 },
  'commission.default_pct': { unit: '%', min: 0, max: 30 },
  'commission.payable_days_after_cruise': { unit: 'days', min: 0, max: 120 },
  'modification_fee_usd': { unit: 'USD', min: 0, max: 10000, prefix: 'USD' },
  'payments.extras_due_hours': { unit: 'hours', min: 0, max: 2160 },
  'payments.wire_window_hours': { unit: 'hours', min: 12, max: 168 },
  'payments.balance_reminder_days': { unit: 'days', min: 1, max: 60 },
  'discounts.online_deposit_discount_pct': { unit: '%', min: 0, max: 100 },
  'discounts.max_total_discount_pct': { unit: '%', min: 0, max: 100 },
  'holds.web_minutes': { unit: 'min', min: 5, max: 60 },
  'holds.web_extension_minutes': { unit: 'min', min: 0, max: 60 },
  'holds.near_term_business_hours': { unit: 'business hours', min: 4, max: 120 },
  'holds.long_lead_business_days': { unit: 'business days', min: 1, max: 15 },
  'sla.response_hours': { unit: 'hours', min: 1, max: 72 },
  'sla.refund_business_days': { unit: 'business days', min: 1, max: 60 },
  'sla.agency_approval_business_days': { unit: 'business days', min: 1, max: 10 },
  'manifests.dpng_fit_days': { unit: 'days', min: 1, max: 90 },
  'manifests.dpng_charter_days': { unit: 'days', min: 1, max: 90 },
  'alerts.low_occupancy_pct': { unit: '%', min: 1, max: 100 },
  'alerts.low_occupancy_days_before': { unit: 'days', min: 1, max: 365 },
  'retention.passport_months_after_cruise': { unit: 'months', min: 1, max: 120 },
  'retention.medical_days_after_cruise': { unit: 'days', min: 1, max: 3650 },
  'cancellation.bands.min_days': { unit: 'days', min: 0, max: 999 },
  'cancellation.bands.penalty_pct': { unit: '%', min: 0, max: 100 }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isBandList(value: unknown): value is Array<BandDraft> {
  return Array.isArray(value)
    && value.every(item => isRecord(item) && 'min_days' in item && 'penalty_pct' in item)
}

export function getByPath(target: unknown, path: string): unknown {
  const parts = path.split('.')
  let current: unknown = target

  for (const part of parts) {
    if (Array.isArray(current)) {
      const index = Number(part)
      current = Number.isInteger(index) ? current[index] : undefined
      continue
    }

    if (!isRecord(current)) {
      return undefined
    }

    current = current[part]
  }

  return current
}

export function setByPath(target: object, path: string, value: unknown): void {
  const parts = path.split('.')
  const last = parts.pop()

  if (last === undefined) {
    return
  }

  let current: unknown = target

  for (const part of parts) {
    if (Array.isArray(current)) {
      const index = Number(part)
      current = Number.isInteger(index) ? current[index] : undefined
      continue
    }

    if (!isRecord(current)) {
      return
    }

    current = current[part]
  }

  if (Array.isArray(current)) {
    const index = Number(last)

    if (Number.isInteger(index)) {
      current[index] = value
    }

    return
  }

  if (isRecord(current)) {
    current[last] = value
  }
}

export function draftValueFor(row: RuleRegistryRow, draft: BusinessRulesDocument | BusinessRulesDraft): unknown {
  if (row.paths.length === 1) {
    const path = row.paths[0]

    return path === undefined ? undefined : getByPath(draft, path)
  }

  const values: Record<string, unknown> = {}

  for (const path of row.paths) {
    values[path] = getByPath(draft, path)
  }

  return values
}

function normaliseForCompare(value: unknown): unknown {
  if (isBandList(value)) {
    return sortBands(value)
  }

  return value
}

export function rowDiffers(
  row: RuleRegistryRow,
  draft: BusinessRulesDocument | BusinessRulesDraft
): boolean {
  if (row.where !== 'here') {
    return row.differs === true
  }

  return !documentsEqual(
    normaliseForCompare(draftValueFor(row, draft)),
    normaliseForCompare(row.source_value)
  )
}

export function isPendingStatus(status: RuleStatus): boolean {
  return PENDING_STATUSES.includes(status)
}

export function isFlagged(
  row: RuleRegistryRow,
  draft: BusinessRulesDocument | BusinessRulesDraft
): boolean {
  return rowDiffers(row, draft)
    || (row.note !== null && row.note !== '')
    || isPendingStatus(row.status)
}

function matchesChip(
  row: RuleRegistryRow,
  draft: BusinessRulesDocument | BusinessRulesDraft,
  chip: RuleChip
): boolean {
  if (chip === 'ALL') {
    return true
  }

  if (chip === 'HERE') {
    return row.where === 'here'
  }

  if (chip === 'TABS') {
    return OTHER_PAGES.includes(row.where)
  }

  if (chip === 'LOCK') {
    return row.where === 'locked'
  }

  return isFlagged(row, draft)
}

export function ruleChipState(
  rows: Array<RuleRegistryRow>,
  draft: BusinessRulesDocument | BusinessRulesDraft,
  chip: RuleChip = 'ALL'
): RuleChipState {
  let here = 0
  let otherPages = 0
  let locked = 0
  let flagged = 0

  for (const row of rows) {
    if (row.where === 'here') {
      here += 1
    } else if (row.where === 'locked') {
      locked += 1
    } else if (OTHER_PAGES.includes(row.where)) {
      otherPages += 1
    }

    if (isFlagged(row, draft)) {
      flagged += 1
    }
  }

  const visible = rows.filter(row => matchesChip(row, draft, chip))
  const groups: Array<{ label: string, rows: Array<RuleRegistryRow> }> = []

  for (const row of visible) {
    const existing = groups.find(group => group.label === row.group_label)

    if (existing) {
      existing.rows.push(row)
      continue
    }

    groups.push({ label: row.group_label, rows: [row] })
  }

  return {
    counts: {
      all: rows.length,
      here,
      other_pages: otherPages,
      locked,
      differs_or_flagged: flagged
    },
    visible,
    groups
  }
}

export function sortBands(bands: Array<BandDraft>): Array<BandDraft> {
  return [...bands].sort((left, right) => (right.min_days ?? -1) - (left.min_days ?? -1))
}

export function addBand(bands: Array<BandDraft>): Array<BandDraft> {
  if (bands.length >= MAX_BANDS) {
    return sortBands(bands)
  }

  return sortBands([...bands, { ...DEFAULT_BAND }])
}

export function removeBand(bands: Array<BandDraft>, index: number): Array<BandDraft> {
  if (bands.length <= 1) {
    return bands
  }

  return sortBands(bands.filter((_, itemIndex) => itemIndex !== index))
}

export function isNoCap(value: number | null): boolean {
  return value === null
}

export function setNoCap(): null {
  return null
}

export function typeCap(raw: string): number | null {
  return parseRinValue(raw)
}

export function resetRow(draft: BusinessRulesDraft, row: RuleRegistryRow): void {
  if (row.paths.length === 1) {
    const path = row.paths[0]

    if (path !== undefined) {
      setByPath(draft, path, cloneDocument(row.source_value))
    }

    return
  }

  if (!isRecord(row.source_value)) {
    return
  }

  for (const path of row.paths) {
    setByPath(draft, path, cloneDocument(row.source_value[path]))
  }
}

export function ruleFieldMeta(path: string): RuleFieldMeta | undefined {
  if (path.startsWith('cancellation.bands.') && path.endsWith('.min_days')) {
    return FIELD_META['cancellation.bands.min_days']
  }

  if (path.startsWith('cancellation.bands.') && path.endsWith('.penalty_pct')) {
    return FIELD_META['cancellation.bands.penalty_pct']
  }

  return FIELD_META[path]
}

export function ruleFieldLabels(): Record<string, string> {
  return {
    'commission.cap_pct': 'FIN-005 · Max agency commission',
    'commission.default_pct': 'RMS · Default agency commission',
    'commission.payable_days_after_cruise': '§10 · Commission payable after cruise',
    'modification_fee_usd': 'FIN-006 · Date-change / modification fee',
    'payments.extras_due_hours': 'Iconic · Extras & collected fees — due before departure',
    'payments.wire_window_hours': 'RMS · Wire transfer window before auto-release',
    'payments.balance_reminder_days': '§4.1.4 · Balance reminders — days before due',
    'discounts.online_deposit_discount_pct': '08 B2 · Online-deposit advantage',
    'discounts.max_total_discount_pct': '08 B2 · Max total discount',
    'holds.web_minutes': 'R-B2 · Web checkout hold (+ one silent extension)',
    'holds.web_extension_minutes': 'R-B2 · Web checkout hold (+ one silent extension)',
    'holds.near_term_business_hours': 'TEC-004 · Request / agency hold — near-term',
    'holds.long_lead_business_days': 'TEC-004 · Request / agency hold — long-lead',
    'sla.response_hours': 'OPS-009 · Quote / first-response SLA (FIT, groups, charter)',
    'sla.refund_business_days': 'RMS · Refund execution SLA',
    'sla.agency_approval_business_days': '§5.5 · Agency approval SLA',
    'manifests.dpng_fit_days': 'OPS-013 · DPNG manifest deadline — FIT / charter',
    'manifests.dpng_charter_days': 'OPS-013 · DPNG manifest deadline — FIT / charter',
    'alerts.low_occupancy_pct': '§10 · Low-occupancy alert',
    'alerts.low_occupancy_days_before': '§10 · Low-occupancy alert',
    'retention.passport_months_after_cruise': '§6.4 · Passport retention',
    'retention.medical_days_after_cruise': 'LEG-002 · Medical notes retention',
    'cancellation.bands': '§4.1.5 · Cabin cancellation penalty bands'
  }
}

export function statusPill(status: RuleStatus): { tone: RulePillTone, labelKey: string } {
  switch (status) {
    case 'CONFIRMED':
      return { tone: 'ok', labelKey: 'businessRules.statusConfirmed' }
    case 'TEXT_IN_DRAFTING':
      return { tone: 'warn', labelKey: 'businessRules.statusTextInDrafting' }
    case 'RMS_SPEC':
      return { tone: 'neutral', labelKey: 'businessRules.statusRmsSpec' }
    case 'PENDING_CLIENT':
      return { tone: 'sand', labelKey: 'businessRules.statusPendingClient' }
    case 'PENDING_LEGAL':
      return { tone: 'warn', labelKey: 'businessRules.statusPendingLegal' }
  }
}

export function ruleLinkKey(where: RuleWhere): 'linkRates' | 'linkEngine' | 'linkDepartures' | null {
  if (where === 'rates') {
    return 'linkRates'
  }

  if (where === 'engine_settings') {
    return 'linkEngine'
  }

  if (where === 'departures') {
    return 'linkDepartures'
  }

  return null
}

export function sharedUnit(row: RuleRegistryRow): string | null {
  if (row.paths.length !== 2) {
    return null
  }

  const first = row.paths[0] === undefined ? undefined : ruleFieldMeta(row.paths[0])
  const second = row.paths[1] === undefined ? undefined : ruleFieldMeta(row.paths[1])

  if (first === undefined || second === undefined) {
    return null
  }

  return first.unit === second.unit ? first.unit : null
}
