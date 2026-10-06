import { describe, expect, it } from 'vitest'
import {
  addBand,
  DEFAULT_BAND,
  draftValueFor,
  isNoCap,
  MAX_BANDS,
  removeBand,
  resetRow,
  rowDiffers,
  ruleChipState,
  setNoCap,
  sortBands,
  typeCap,
  type BusinessRulesDraft
} from '../../app/components/rules/rulesHelpers'
import type { RuleRegistryRow } from '../../app/types/api'

function row(overrides: Partial<RuleRegistryRow> & Pick<RuleRegistryRow, 'key' | 'where'>): RuleRegistryRow {
  return {
    group: 'pricing_payments',
    group_label: 'Pricing & payments',
    source_code: 'FIN-005',
    name: 'Max agency commission',
    status: 'CONFIRMED',
    paths: ['commission.cap_pct'],
    source_display: '12%',
    source_value: 12,
    current_display: '12%',
    differs: false,
    used_in: 'New reservation',
    lock_reason: null,
    note: null,
    link: null,
    ...overrides
  }
}

function seedDraft(): BusinessRulesDraft {
  return {
    commission: {
      cap_pct: 12,
      default_pct: 10,
      payable_days_after_check_out: 30
    },
    modification_fee_usd: 0,
    payments: {
      extras_due_hours: 72,
      wire_window_hours: 72,
      balance_reminder_days: [21, 7]
    },
    discounts: {
      online_deposit_discount_pct: 5,
      max_total_discount_pct: null
    },
    holds: {
      web_minutes: 20,
      web_extension_minutes: 10,
      near_term_business_hours: 48,
      long_lead_business_days: 5
    },
    sla: {
      response_hours: 24,
      refund_business_days: 15,
      agency_approval_business_days: 2
    },
    alerts: {
      low_occupancy_pct: 40,
      low_occupancy_days_before: 90
    },
    retention: {
      passport_months_after_check_out: 24,
      medical_days_after_check_out: 90
    },
    cancellation: {
      bands: [
        { min_days: 120, penalty_pct: 5 },
        { min_days: 90, penalty_pct: 50 },
        { min_days: 0, penalty_pct: 100 }
      ]
    }
  }
}

describe('rowDiffers', () => {
  it('compares a here leaf with source_value', () => {
    const cap = row({ key: 'fin-005-commission-cap', where: 'here' })
    const draft = seedDraft()

    expect(rowDiffers(cap, draft)).toBe(false)

    draft.commission.cap_pct = 15

    expect(rowDiffers(cap, draft)).toBe(true)
  })

  it('compares a two-path here row as an object keyed by path', () => {
    const hold = row({
      key: 'web-checkout-hold',
      where: 'here',
      group: 'holds_service_levels',
      group_label: 'Holds & service levels',
      paths: ['holds.web_minutes', 'holds.web_extension_minutes'],
      source_value: {
        'holds.web_minutes': 20,
        'holds.web_extension_minutes': 10
      }
    })
    const draft = seedDraft()

    expect(draftValueFor(hold, draft)).toEqual({
      'holds.web_minutes': 20,
      'holds.web_extension_minutes': 10
    })
    expect(rowDiffers(hold, draft)).toBe(false)

    draft.holds.web_minutes = 25

    expect(rowDiffers(hold, draft)).toBe(true)
  })

  it('treats cancellation bands as equal when only the order differs', () => {
    const bands = row({
      key: 'cancellation-bands',
      where: 'here',
      group: 'cancellation',
      group_label: 'Cancellation',
      paths: ['cancellation.bands'],
      source_value: [
        { min_days: 120, penalty_pct: 5 },
        { min_days: 90, penalty_pct: 50 },
        { min_days: 0, penalty_pct: 100 }
      ]
    })
    const draft = seedDraft()
    draft.cancellation.bands = [
      { min_days: 0, penalty_pct: 100 },
      { min_days: 120, penalty_pct: 5 },
      { min_days: 90, penalty_pct: 50 }
    ]

    expect(rowDiffers(bands, draft)).toBe(false)

    draft.cancellation.bands = [
      { min_days: 60, penalty_pct: 75 },
      { min_days: 120, penalty_pct: 5 },
      { min_days: 90, penalty_pct: 50 },
      { min_days: 0, penalty_pct: 100 }
    ]

    expect(rowDiffers(bands, draft)).toBe(true)
  })

  it('treats a null max total discount as matching a null source', () => {
    const cap = row({
      key: 'max-total-discount',
      where: 'here',
      paths: ['discounts.max_total_discount_pct'],
      source_value: null
    })
    const draft = seedDraft()

    expect(rowDiffers(cap, draft)).toBe(false)

    draft.discounts.max_total_discount_pct = 25

    expect(rowDiffers(cap, draft)).toBe(true)
  })

  it('uses the server differs flag for rows not set here', () => {
    const rates = row({
      key: 'fin-001-base-rates',
      where: 'rates',
      paths: [],
      source_value: null,
      differs: false
    })
    const draft = seedDraft()

    expect(rowDiffers(rates, draft)).toBe(false)

    rates.differs = true

    expect(rowDiffers(rates, draft)).toBe(true)
  })
})

describe('ruleChipState', () => {
  const draft = seedDraft()

  const rows: Array<RuleRegistryRow> = [
    row({ key: 'fin-005-commission-cap', where: 'here' }),
    row({
      key: 'fin-001-base-rates',
      where: 'rates',
      paths: [],
      source_value: null,
      link: '/rms/commercial/rates'
    }),
    row({
      key: 'ops-001-duration',
      where: 'locked',
      group: 'structural_locked',
      group_label: 'Structural — locked',
      paths: [],
      source_value: null,
      lock_reason: 'A rebuild, not a setting.'
    }),
    row({
      key: 'online-deposit-discount',
      where: 'here',
      paths: ['discounts.online_deposit_discount_pct'],
      source_value: 5,
      status: 'PENDING_CLIENT'
    }),
    row({
      key: 'ops-006-sales-open',
      where: 'engine_settings',
      group: 'guests_capacity',
      group_label: 'Guests & capacity',
      paths: [],
      source_value: null,
      note: 'PRO-001 still pending.',
      link: '/rms/booking-engine/settings'
    })
  ]

  it('counts ALL / HERE / TABS / LOCK / DIFF from the registry and the draft', () => {
    const state = ruleChipState(rows, draft)

    expect(state.counts).toEqual({
      all: 5,
      here: 2,
      other_pages: 2,
      locked: 1,
      differs_or_flagged: 2
    })
    expect(state.groups.map(group => group.label)).toEqual([
      'Pricing & payments',
      'Structural — locked',
      'Guests & capacity'
    ])
  })

  it('filters each chip and keeps registry group order', () => {
    expect(ruleChipState(rows, draft, 'HERE').visible.map(item => item.key)).toEqual([
      'fin-005-commission-cap',
      'online-deposit-discount'
    ])
    expect(ruleChipState(rows, draft, 'TABS').visible.map(item => item.key)).toEqual([
      'fin-001-base-rates',
      'ops-006-sales-open'
    ])
    expect(ruleChipState(rows, draft, 'LOCK').visible.map(item => item.key)).toEqual([
      'ops-001-duration'
    ])
    expect(ruleChipState(rows, draft, 'DIFF').visible.map(item => item.key)).toEqual([
      'online-deposit-discount',
      'ops-006-sales-open'
    ])
  })

  it('bumps DIFF when a here value is edited away from source', () => {
    const edited = seedDraft()
    edited.commission.cap_pct = 15

    const state = ruleChipState(rows, edited, 'DIFF')

    expect(state.counts.differs_or_flagged).toBe(3)
    expect(state.visible.map(item => item.key)).toEqual([
      'fin-005-commission-cap',
      'online-deposit-discount',
      'ops-006-sales-open'
    ])
  })
})

describe('bands', () => {
  const seed = [
    { min_days: 120, penalty_pct: 5 },
    { min_days: 90, penalty_pct: 50 },
    { min_days: 0, penalty_pct: 100 }
  ]

  it('adds the prototype 60 / 75 band and sorts descending', () => {
    expect(addBand(seed)).toEqual([
      { min_days: 120, penalty_pct: 5 },
      { min_days: 90, penalty_pct: 50 },
      { min_days: 60, penalty_pct: 75 },
      { min_days: 0, penalty_pct: 100 }
    ])
  })

  it('refuses to remove the last band', () => {
    const only = [{ min_days: 0, penalty_pct: 100 }]

    expect(removeBand(only, 0)).toEqual(only)
  })

  it('removes a band and re-sorts', () => {
    expect(removeBand(seed, 1)).toEqual([
      { min_days: 120, penalty_pct: 5 },
      { min_days: 0, penalty_pct: 100 }
    ])
  })

  it('sorts by min_days descending', () => {
    expect(sortBands([
      { min_days: 0, penalty_pct: 100 },
      { min_days: 120, penalty_pct: 5 }
    ])).toEqual([
      { min_days: 120, penalty_pct: 5 },
      { min_days: 0, penalty_pct: 100 }
    ])
  })

  it('refuses a seventh band', () => {
    const six = [
      { min_days: 200, penalty_pct: 1 },
      { min_days: 160, penalty_pct: 2 },
      { min_days: 120, penalty_pct: 5 },
      { min_days: 90, penalty_pct: 50 },
      { min_days: 60, penalty_pct: 75 },
      { min_days: 0, penalty_pct: 100 }
    ]

    expect(six).toHaveLength(MAX_BANDS)
    expect(addBand(six)).toEqual(six)
    expect(DEFAULT_BAND).toEqual({ min_days: 60, penalty_pct: 75 })
  })
})

describe('maxTotalDiscountCap', () => {
  it('treats null as no cap', () => {
    expect(isNoCap(null)).toBe(true)
    expect(isNoCap(25)).toBe(false)
    expect(isNoCap(0)).toBe(false)
  })

  it('keeps null when the user unticks without typing', () => {
    let value: number | null = setNoCap()

    expect(value).toBeNull()

    value = typeCap('')

    expect(value).toBeNull()
  })

  it('writes the typed number after untick', () => {
    expect(typeCap('25')).toBe(25)
  })

  it('ticks back to null and never writes 0 on untick', () => {
    expect(setNoCap()).toBeNull()
    expect(typeCap('')).toBeNull()
    expect(typeCap('')).not.toBe(0)
  })
})

describe('resetRow', () => {
  it('writes source_value back onto a leaf and a two-path row', () => {
    const draft = seedDraft()
    draft.commission.cap_pct = 15
    draft.holds.web_minutes = 40

    resetRow(draft, row({ key: 'fin-005-commission-cap', where: 'here' }))
    resetRow(draft, row({
      key: 'web-checkout-hold',
      where: 'here',
      paths: ['holds.web_minutes', 'holds.web_extension_minutes'],
      source_value: {
        'holds.web_minutes': 20,
        'holds.web_extension_minutes': 10
      }
    }))

    expect(draft.commission.cap_pct).toBe(12)
    expect(draft.holds.web_minutes).toBe(20)
    expect(draft.holds.web_extension_minutes).toBe(10)
  })
})
