import { describe, expect, it } from 'vitest'
import {
  restrictionMarks,
  restrictionPayload,
  winningRestriction,
  type RestrictionRow
} from '../../app/components/restrictions/restrictionEditor'
import { shortenEdge, storeRangeBlockBody } from '../../app/components/blocks/blockHelpers'

function row(partial: Partial<RestrictionRow> & Pick<RestrictionRow, 'night' | 'room_type_id'>): RestrictionRow {
  return {
    stop_sell: false,
    closed_to_arrival: false,
    closed_to_departure: false,
    min_stay: null,
    max_stay: null,
    note: null,
    ...partial
  }
}

describe('restrictionPayload', () => {
  it('sends an inclusive range, an empty type list, and only the fields that were set', () => {
    expect(restrictionPayload({
      propertyId: 3,
      roomTypeIds: [],
      from: '2028-03-01',
      to: '2028-03-31',
      weekdays: [1, 2, 3, 4, 5, 6, 7],
      stopSell: true,
      closedToArrival: null,
      closedToDeparture: false,
      minStay: undefined,
      maxStay: 4,
      note: null,
      reason: '  Maintenance  '
    })).toEqual({
      property_id: 3,
      room_type_ids: [],
      from: '2028-03-01',
      to: '2028-03-31',
      stop_sell: true,
      closed_to_departure: false,
      max_stay: 4,
      note: null,
      reason: 'Maintenance'
    })
  })

  it('sends a weekday filter when the set is not the whole week', () => {
    const body = restrictionPayload({
      propertyId: 3,
      roomTypeIds: [8],
      from: '2028-03-03',
      to: '2028-03-03',
      weekdays: [5, 1],
      stopSell: null,
      closedToArrival: true,
      closedToDeparture: null,
      minStay: undefined,
      maxStay: undefined,
      note: undefined,
      reason: ''
    })

    expect(body.weekdays).toEqual([1, 5])
    expect(body.room_type_ids).toEqual([8])
    expect(body).not.toHaveProperty('stop_sell')
    expect(body).not.toHaveProperty('reason')
  })
})

describe('winningRestriction', () => {
  it('prefers the type row over the property-wide row', () => {
    const rows = [
      row({ night: '2028-03-03', room_type_id: null, stop_sell: true, min_stay: 5 }),
      row({ night: '2028-03-03', room_type_id: 8, stop_sell: false, note: 'suite' })
    ]

    expect(winningRestriction(rows, '2028-03-03', 8)?.note).toBe('suite')
    expect(winningRestriction(rows, '2028-03-03', 9)?.stop_sell).toBe(true)
    expect(restrictionMarks(winningRestriction(rows, '2028-03-03', 9))).toBe('SS 5––')
  })
})

describe('storeRangeBlockBody', () => {
  it('posts rooms or a type plus count, never both', () => {
    expect(storeRangeBlockBody({
      startsOn: '2028-03-03',
      endsOn: '2028-03-06',
      reason: 'MAINTENANCE',
      notes: '  lift  ',
      roomIds: [1, 2],
      roomTypeId: 8,
      count: 2,
      byType: false
    })).toEqual({
      starts_on: '2028-03-03',
      ends_on: '2028-03-06',
      reason: 'MAINTENANCE',
      notes: 'lift',
      rooms: [1, 2]
    })

    expect(storeRangeBlockBody({
      startsOn: '2028-03-03',
      endsOn: '2028-03-06',
      reason: 'FAM_TRIP',
      notes: '',
      roomIds: [1],
      roomTypeId: 8,
      count: 2,
      byType: true
    })).toEqual({
      starts_on: '2028-03-03',
      ends_on: '2028-03-06',
      reason: 'FAM_TRIP',
      notes: null,
      room_type_id: 8,
      count: 2
    })
  })
})

describe('shortenEdge', () => {
  const current = { starts_on: '2028-03-03', ends_on: '2028-03-10' }

  it('accepts one edge and refuses both', () => {
    expect(shortenEdge(current, { starts_on: '2028-03-05', ends_on: '2028-03-10' })).toBe('start')
    expect(shortenEdge(current, { starts_on: '2028-03-03', ends_on: '2028-03-08' })).toBe('end')
    expect(shortenEdge(current, current)).toBe('unchanged')
    expect(shortenEdge(current, { starts_on: '2028-03-04', ends_on: '2028-03-08' })).toBe('both')
  })
})
