import { describe, expect, it } from 'vitest'
import type { NightCell } from '../../app/types/api'
import {
  nightOccupancyPct,
  nightWindow,
  placeBars,
  spansFromCells,
  type ClaimSpan
} from '../../app/components/calendar/nightCalendar'

const nights = ['2028-03-03', '2028-03-04', '2028-03-05', '2028-03-06']

function span(partial: Partial<ClaimSpan> & Pick<ClaimSpan, 'claimGroup' | 'firstNight' | 'lastNight'>): ClaimSpan {
  return {
    state: 'SOLD',
    reference: 'ANK-1',
    guestSurname: 'Lovelace',
    holderType: 'booking',
    holderId: 4,
    ...partial
  }
}

function cell(night: string, group: string | null, state: NightCell['state'] = 'SOLD'): NightCell {
  return {
    night,
    state,
    claim: group === null
      ? null
      : {
          claim_group: group,
          reference: group,
          guest_surname: 'Lovelace',
          owner: null,
          holder_type: 'booking',
          holder_id: 4
        }
  }
}

describe('placeBars', () => {
  it('clips a stay that starts before the window and ends after it', () => {
    const bars = placeBars([
      span({ claimGroup: 'long', firstNight: '2028-03-01', lastNight: '2028-03-08' })
    ], nights)

    expect(bars).toHaveLength(1)
    expect(bars[0]).toMatchObject({
      startIndex: 0,
      span: 4,
      clippedStart: true,
      clippedEnd: true,
      label: 'ANK-1 · Lovelace'
    })
  })

  it('keeps a one-night stay on its column', () => {
    const bars = placeBars([
      span({ claimGroup: 'one', firstNight: '2028-03-04', lastNight: '2028-03-04', reference: 'BLK-2', guestSurname: null, state: 'BLOCKED', holderType: 'internal_block' })
    ], nights)

    expect(bars[0]).toMatchObject({
      startIndex: 1,
      span: 1,
      clippedStart: false,
      clippedEnd: false,
      label: 'BLK-2'
    })
  })

  it('does not merge adjacent stays on one room', () => {
    const bars = placeBars([
      span({ claimGroup: 'a', firstNight: '2028-03-03', lastNight: '2028-03-04' }),
      span({ claimGroup: 'b', firstNight: '2028-03-05', lastNight: '2028-03-06', reference: 'ANK-2' })
    ], nights)

    expect(bars.map(bar => bar.claimGroup)).toEqual(['a', 'b'])
    expect(bars.map(bar => bar.span)).toEqual([2, 2])
    expect(bars.map(bar => bar.startIndex)).toEqual([0, 2])
  })
})

describe('spansFromCells', () => {
  it('splits on a free night and on a new claim group', () => {
    const spans = spansFromCells([
      cell('2028-03-03', 'a'),
      cell('2028-03-04', 'a'),
      cell('2028-03-05', null, 'FREE'),
      cell('2028-03-06', 'b', 'HELD')
    ])

    expect(spans.map(item => [item.claimGroup, item.firstNight, item.lastNight, item.state])).toEqual([
      ['a', '2028-03-03', '2028-03-04', 'SOLD'],
      ['b', '2028-03-06', '2028-03-06', 'HELD']
    ])
  })
})

describe('nightOccupancyPct', () => {
  it('uses sold over free plus held plus sold, and ignores blocked', () => {
    expect(nightOccupancyPct([
      { free: 1, held: 0, sold: 1, blocked: 4 },
      { free: 0, held: 0, sold: 0, blocked: 2 }
    ])).toBe(50)
    expect(nightOccupancyPct([{ free: 0, held: 0, sold: 0, blocked: 3 }])).toBe(0)
  })
})

describe('nightWindow', () => {
  it('treats the end as exclusive', () => {
    expect(nightWindow('2028-03-03', 14)).toEqual({
      from: '2028-03-03',
      to: '2028-03-17'
    })
  })
})
