import { describe, expect, it } from 'vitest'
import {
  agencyOptionLabel,
  charterNoticeText,
  commissionWarning,
  createdToast,
  depositLineText,
  depositMethodOptions,
  existingContactSelected,
  heldCreatedToast,
  isTradeMain,
  quoteRequestPayload,
  showBackToBack,
  showGroupNameField,
  showGroupRow,
  tradeCreateFields
} from '../../app/components/bookings/newReservationHelpers'

const MAIN = [
  { value: 'D2C', label: 'D2C', trade: false },
  { value: 'B2B', label: 'B2B', trade: true },
  { value: 'Partners', label: 'Partners', trade: false }
]

describe('newReservationHelpers', () => {
  it('builds a charter payload as one party with no cabin code', () => {
    expect(quoteRequestPayload(12, 'CHARTER', [
      { cabinCode: 'S1', adults: 8, children: 1 }
    ], false)).toEqual({
      departure_id: 12,
      type: 'CHARTER',
      back_to_back: false,
      cabins: [{ adults: 8, children: 1 }]
    })

    expect(quoteRequestPayload(12, 'CHARTER', [
      { cabinCode: 'S1', adults: 8, children: 1 }
    ], false, 'B2B')).toEqual({
      departure_id: 12,
      type: 'CHARTER',
      back_to_back: false,
      cabins: [{ adults: 8, children: 1 }],
      main_channel: 'B2B'
    })
  })

  it('builds cabin rows only when every cabin is picked', () => {
    expect(quoteRequestPayload(12, 'CABIN', [
      { cabinCode: 'S1', adults: 2, children: 0 }
    ], true, 'B2B – Travel Advisor')).toEqual({
      departure_id: 12,
      type: 'CABIN',
      back_to_back: true,
      cabins: [{ cabin_code: 'S1', adults: 2, children: 0 }],
      main_channel: 'B2B – Travel Advisor'
    })

    expect(quoteRequestPayload(12, 'CABIN', [
      { cabinCode: 'S1', adults: 2, children: 0 },
      { cabinCode: '', adults: 2, children: 0 }
    ], false)).toBeNull()

    expect(quoteRequestPayload(null, 'CABIN', [
      { cabinCode: 'S1', adults: 2, children: 0 }
    ], false)).toBeNull()
  })

  it('shows the group row for two cabins or an existing group', () => {
    expect(showGroupRow(false, 1, null)).toBe(false)
    expect(showGroupRow(false, 2, null)).toBe(true)
    expect(showGroupRow(false, 1, 9)).toBe(true)
    expect(showGroupRow(true, 3, 9)).toBe(false)
    expect(showGroupNameField(null)).toBe(true)
    expect(showGroupNameField(4)).toBe(false)
  })

  it('hides back-to-back for charter and festive departures', () => {
    expect(showBackToBack(false, false)).toBe(true)
    expect(showBackToBack(true, false)).toBe(false)
    expect(showBackToBack(false, true)).toBe(false)
    expect(showBackToBack(true, true)).toBe(false)
  })

  it('reads trade from the API flag, not a local regex', () => {
    expect(isTradeMain('B2B', MAIN)).toBe(true)
    expect(isTradeMain('D2C', MAIN)).toBe(false)
    expect(isTradeMain('Partners', MAIN)).toBe(false)
  })

  it('wording for one cabin versus a group', () => {
    expect(createdToast([
      { reference: 'ANK-2026-0020', display_reference: 'ANK-2026-0020' }
    ], null)).toBe('Reservation ANK-2026-0020 created.')

    expect(createdToast([
      { reference: 'ANK-2026-0020', display_reference: 'ANK-2026-0020' },
      { reference: 'ANK-2026-0021', display_reference: 'ANK-2026-0021' },
      { reference: 'ANK-2026-0022', display_reference: 'ANK-2026-0022' }
    ], 'GRP-008')).toBe(
      '3 cabins created under GRP-008 (ANK-2026-0020, ANK-2026-0021, ANK-2026-0022). The coordinator receives all communications.'
    )
  })

  it('matches a selected contact only while the email still agrees', () => {
    expect(existingContactSelected('Ada@Iconic.test', 'ada@iconic.test')).toBe(true)
    expect(existingContactSelected('other@iconic.test', 'ada@iconic.test')).toBe(false)
    expect(existingContactSelected('ada@iconic.test', null)).toBe(false)
  })

  it('renders deposit and charter copy from quote terms', () => {
    expect(depositLineText(10, 'USD 2,660', 120)).toBe('Deposit 10% · USD 2,660 · balance at T−120')
    expect(charterNoticeText({
      deposit_pct: 20,
      deposit_business_days: 5,
      balance_days: 120,
      dpng_manifest_days: 30
    })).toBe(
      'CHARTER blocks the entire yacht for the departure. Deposit 20% within 5 business days of written confirmation; balance 80% at 120 days; DPNG manifest 30 days pre-departure.'
    )
  })

  it('warns only when the rate is above the cap', () => {
    expect(commissionWarning(10, 12)).toBeNull()
    expect(commissionWarning(12, 12)).toBeNull()
    expect(commissionWarning(15, 12)).toBe(
      'Commission above 12% is blocked (FIN-005). The booking is created and holds its cabin, but stays ON_HOLD_AGENCY and cannot be confirmed until someone with commissions.override_cap approves it.'
    )
  })

  it('wording for an over-cap create', () => {
    expect(heldCreatedToast(15, 12)).toBe(
      'Reservation created but HELD: commission 15% exceeds the 12% cap (FIN-005). It cannot reach CONFIRMED until the Commercial Director approves. Alert sent.'
    )
  })

  it('builds deposit method labels from the wire window', () => {
    expect(depositMethodOptions(72)).toEqual([
      { value: 'card', label: 'Card — payment link' },
      { value: 'wire', label: 'Wire transfer (72h · PENDING_PAYMENT)' }
    ])
  })

  it('labels an agency with its network and an over-cap marker', () => {
    expect(agencyOptionLabel({
      name: 'Blue Latitude',
      network: 'Virtuoso',
      commission_pct: 10
    }, 12)).toBe('Blue Latitude — Virtuoso')

    expect(agencyOptionLabel({
      name: 'Meridian Voyages',
      network: 'ILTM',
      commission_pct: 15
    }, 12)).toBe('Meridian Voyages — ILTM · >12%')

    expect(agencyOptionLabel({
      name: 'Andes Luxe',
      network: null,
      commission_pct: 10
    }, 12)).toBe('Andes Luxe')
  })

  it('omits agency and commission when the channel is not trade', () => {
    expect(tradeCreateFields(false, 3, 10)).toEqual({})
    expect(tradeCreateFields(true, null, 10)).toEqual({})
    expect(tradeCreateFields(true, 3, 15)).toEqual({
      agency_id: 3,
      commission_pct: 15
    })
  })
})
