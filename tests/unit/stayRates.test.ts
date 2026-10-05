import { describe, expect, it } from 'vitest'
import { monthCoverage, withNightly } from '../../app/components/rates/stayRates'

const seasons2026 = [
  { from: '2026-01-01', to: '2026-03-31' },
  { from: '2026-04-01', to: '2026-06-30' },
  { from: '2026-07-01', to: '2026-09-30' },
  { from: '2026-12-20', to: '2026-12-31' }
]

describe('monthCoverage', () => {
  it('marks uncovered months as gaps and a partial December', () => {
    const months = monthCoverage(seasons2026, 2026)
    const byLabel = Object.fromEntries(months.map(month => [month.label, month]))

    expect(byLabel.Jan?.gap).toBe(false)
    expect(byLabel.Jan?.covered).toBe(31)
    expect(byLabel.Sep?.covered).toBe(30)
    expect(byLabel.Oct?.gap).toBe(true)
    expect(byLabel.Oct?.covered).toBe(0)
    expect(byLabel.Nov?.gap).toBe(true)
    expect(byLabel.Dec?.gap).toBe(false)
    expect(byLabel.Dec?.covered).toBe(12)
    expect(byLabel.Dec?.nights).toBe(31)
  })
})

describe('withNightly', () => {
  const rates = [
    { room_type: 'STD', season: 'LOW', nightly: 100 }
  ]

  it('updates a cell, appends a missing pair, and removes a cleared cell', () => {
    const updated = withNightly(rates, 'STD', 'LOW', 120)

    expect(updated).toEqual([
      { room_type: 'STD', season: 'LOW', nightly: 120 }
    ])

    const appended = withNightly(updated, 'FAM', 'LOW', 160)

    expect(appended).toEqual([
      { room_type: 'STD', season: 'LOW', nightly: 120 },
      { room_type: 'FAM', season: 'LOW', nightly: 160 }
    ])

    expect(withNightly(appended, 'FAM', 'LOW', null)).toEqual([
      { room_type: 'STD', season: 'LOW', nightly: 120 }
    ])
    expect(rates).toEqual([
      { room_type: 'STD', season: 'LOW', nightly: 100 }
    ])
  })
})
