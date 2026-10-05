import { describe, expect, it } from 'vitest'
import {
  deskActionsVisible,
  frontDeskParams,
  nightAuditAlerts,
  stayBookingBody,
  type StayRoomDraft
} from '../../app/components/bookings/stayBooking'

const rooms: StayRoomDraft[] = [
  {
    room_type: 'STD',
    adults: 2,
    child_ages: [],
    rate_plan: 'BAR',
    room_id: 11,
    check_in: null,
    check_out: null
  },
  {
    room_type: 'STD',
    adults: 2,
    child_ages: [8],
    rate_plan: 'BAR',
    room_id: null,
    check_in: '2026-03-06',
    check_out: '2026-03-09'
  },
  {
    room_type: 'DLX',
    adults: 1,
    child_ages: [6, 10],
    rate_plan: 'NRF',
    room_id: 14,
    check_in: '2026-03-07',
    check_out: '2026-03-10'
  }
]

describe('stay booking payload', () => {
  it('builds a three-room group with mixed dates', () => {
    expect(stayBookingBody({
      checkIn: '2026-03-05',
      checkOut: '2026-03-08',
      rooms,
      clientName: 'Ada Lovelace',
      clientEmail: 'ada@iconic.test',
      clientPhone: '',
      mainChannel: 'D2C',
      channelOfOrigin: 'Hotel Booking Engine',
      expectedTotal: 900,
      override: false,
      overrideReason: '',
      groupName: 'Lovelace party',
      expectedArrivalTime: '15:00'
    })).toEqual({
      check_in: '2026-03-05',
      check_out: '2026-03-08',
      rooms: [
        {
          room_type: 'STD',
          adults: 2,
          child_ages: [],
          rate_plan: 'BAR',
          room_id: 11
        },
        {
          room_type: 'STD',
          adults: 2,
          child_ages: [8],
          rate_plan: 'BAR',
          check_in: '2026-03-06',
          check_out: '2026-03-09'
        },
        {
          room_type: 'DLX',
          adults: 1,
          child_ages: [6, 10],
          rate_plan: 'NRF',
          room_id: 14,
          check_in: '2026-03-07',
          check_out: '2026-03-10'
        }
      ],
      client: {
        name: 'Ada Lovelace',
        email: 'ada@iconic.test',
        phone: null
      },
      main_channel: 'D2C',
      channel_of_origin: 'Hotel Booking Engine',
      expected_total: 900,
      expected_arrival_time: '15:00',
      group: { name: 'Lovelace party' }
    })
  })
})

describe('drawer actions', () => {
  it('shows only the actions the API allowed', () => {
    expect(deskActionsVisible(['check_in', 'modify_stay'])).toEqual({
      check_in: true,
      check_out: false,
      no_show: false,
      modify_stay: true,
      move_room: false
    })
    expect(deskActionsVisible([])).toEqual({
      check_in: false,
      check_out: false,
      no_show: false,
      modify_stay: false,
      move_room: false
    })
  })
})

describe('front desk tabs', () => {
  it('filters each tab by the stay date', () => {
    expect(frontDeskParams('arrivals', '2026-10-05')).toEqual({
      arriving_from: '2026-10-05',
      arriving_to: '2026-10-05'
    })
    expect(frontDeskParams('in_house', '2026-10-05')).toEqual({
      in_house_on: '2026-10-05'
    })
    expect(frontDeskParams('departures', '2026-10-05')).toEqual({
      departing_from: '2026-10-05',
      departing_to: '2026-10-05'
    })
  })

  it('keeps night-audit alerts', () => {
    expect(nightAuditAlerts([
      { kind: 'OVERDUE_BALANCE', title: 'Balance' },
      { kind: 'ARRIVAL_NOT_CHECKED_IN', title: 'Arrival' },
      { kind: 'DEPARTURE_NOT_CHECKED_OUT', title: 'Departure' }
    ])).toEqual([
      { kind: 'ARRIVAL_NOT_CHECKED_IN', title: 'Arrival' },
      { kind: 'DEPARTURE_NOT_CHECKED_OUT', title: 'Departure' }
    ])
  })
})
