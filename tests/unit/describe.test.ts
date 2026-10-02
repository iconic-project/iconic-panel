import { describe, expect, it } from 'vitest'
import { describeHistory } from '../../app/components/history/describe'

const strings: Record<string, string> = {
  'history.events.userInvitedAs': 'Invited as {role}',
  'history.events.userInvited': 'Invited',
  'history.events.userActivated': 'Invitation accepted',
  'history.events.userInvitationResent': 'Invitation resent',
  'history.events.userUpdated': 'Name changed · {before} → {after}',
  'history.events.userRoleChanged': 'Role changed · {before} → {after}',
  'history.events.userDisabled': 'Disabled',
  'history.events.userEnabled': 'Enabled',
  'history.events.roleCreated': 'Role created',
  'history.events.roleUpdated': 'Role updated',
  'history.events.roleRenamed': 'Renamed · {before} → {after}',
  'history.events.roleDescriptionChanged': 'Description changed',
  'history.events.rolePermissionsChanged': 'Permissions changed · {parts}',
  'history.events.roleAdded': 'added: {added}',
  'history.events.roleRemoved': 'removed: {removed}',
  'history.events.roleDeleted': 'Role deleted',
  'history.events.itineraryCreated': 'Created',
  'history.events.itineraryDeleted': 'Deleted',
  'history.events.itineraryPublished': 'Published',
  'history.events.itineraryHidden': 'Hidden from engine',
  'history.events.itineraryImageReplaced': 'Hero photo replaced',
  'history.events.itineraryUpdated': 'Updated · {summary}',
  'history.events.itineraryUpdatedBare': 'Updated',
  'history.events.departureCreated': 'Created',
  'history.events.departureDeleted': 'Deleted',
  'history.events.departureUpdated': 'Updated · {summary}',
  'history.events.departureUpdatedBare': 'Updated',
  'history.events.departureStatusChanged': 'Status · {before} → {after}',
  'history.events.blockCreated': 'Created',
  'history.events.blockReleased': 'Released',
  'history.events.blockUpdated': 'Updated · {summary}',
  'history.events.blockUpdatedBare': 'Updated',
  'history.events.offerCreated': 'Created',
  'history.events.offerUpdated': 'Updated · {summary}',
  'history.events.offerUpdatedBare': 'Updated',
  'history.events.offerSubmitted': 'Submitted for Director approval',
  'history.events.offerApproved': 'Approved',
  'history.events.offerRejected': 'Rejected',
  'history.events.offerPaused': 'Paused',
  'history.events.offerResumed': 'Resumed',
  'history.events.bookingCreated': 'Created',
  'history.events.bookingRequested': 'Requested',
  'history.events.bookingStatusChanged': 'Status {before} → {after}',
  'history.events.bookingMoved': 'Moved · {fromDate} · {fromCabin} → {toDate} · {toCabin} · {fromTotal} → {toTotal}',
  'history.events.bookingUpdated': 'Updated',
  'history.events.bookingOwnerChanged': 'Owner changed · {before} → {after}',
  'history.events.bookingDeleted': 'Reservation deleted',
  'history.events.bookingReleased': 'Request released — hold returned to inventory',
  'history.events.bookingOverdueExtended': 'OPS-007 decision — extension granted · OVERDUE → CONFIRMED',
  'history.events.bookingOverdueFlagged': 'OVERDUE flag · {days} days · {balance}',
  'history.events.paymentRecorded': 'Payment recorded · {reference} · {amount} · {status}',
  'history.events.paymentSettled': 'Wire received · {reference} · {bank}',
  'history.events.refundNotDue': 'Nothing was paid, so nothing is owed.',
  'history.events.refundRequested': 'Refund requested · penalty {penalty} · refund due {refund}',
  'history.events.consentRecorded': 'Consent recorded · {document} · {version} · {source}',
  'history.documents.terms': 'Terms & Conditions',
  'history.documents.cancellation': 'Cancellation policy',
  'history.documents.privacy': 'Privacy policy',
  'history.documents.insurance': 'Travel insurance declaration',
  'history.documents.marketing': 'Marketing',
  'history.documents.charterProposal': 'Charter proposal',
  'history.sources.engine': 'Booking engine',
  'history.sources.paymentLink': 'Payment link',
  'history.sources.staff': 'Staff',
  'history.events.unknown': '{event} · {summary}'
}

function t(key: string, params?: Record<string, string>): string {
  let out = strings[key] ?? key

  if (params) {
    for (const [name, value] of Object.entries(params)) {
      out = out.replaceAll(`{${name}}`, value)
    }
  }

  return out
}

describe('describeHistory', () => {
  it('uses after.role for invited, and falls back when it is missing', () => {
    expect(describeHistory({
      event: 'user.invited',
      before: null,
      after: { role: 'Manager' }
    }, t)).toBe('Invited as Manager')

    expect(describeHistory({
      event: 'user.invited',
      before: null,
      after: null
    }, t)).toBe('Invited')
  })

  it('maps the known user and role events', () => {
    expect(describeHistory({ event: 'user.activated', before: null, after: null }, t)).toBe('Invitation accepted')
    expect(describeHistory({ event: 'user.invitation_resent', before: null, after: null }, t)).toBe('Invitation resent')
    expect(describeHistory({
      event: 'user.updated',
      before: { name: 'Ada' },
      after: { name: 'Ada Lovelace' }
    }, t)).toBe('Name changed · Ada → Ada Lovelace')
    expect(describeHistory({
      event: 'user.role_changed',
      before: { role: 'Sales Exec' },
      after: { role: 'Manager' }
    }, t)).toBe('Role changed · Sales Exec → Manager')
    expect(describeHistory({ event: 'user.disabled', before: null, after: null }, t)).toBe('Disabled')
    expect(describeHistory({ event: 'user.enabled', before: null, after: null }, t)).toBe('Enabled')
    expect(describeHistory({ event: 'role.created', before: null, after: null }, t)).toBe('Role created')
    expect(describeHistory({
      event: 'role.updated',
      before: { permissions: ['panel.rms'] },
      after: { added: ['users.manage'], removed: [] }
    }, t)).toBe('Permissions changed · added: users.manage')
    expect(describeHistory({ event: 'role.deleted', before: null, after: null }, t)).toBe('Role deleted')
  })

  it('maps permission values to labels and composes rename / description / permission parts', () => {
    const label = (value: string): string => value === 'bookings.delete' ? 'Delete bookings' : value

    expect(describeHistory({
      event: 'role.updated',
      before: { permissions: [] },
      after: { added: ['bookings.delete'], removed: [] }
    }, t, label)).toBe('Permissions changed · added: Delete bookings')

    expect(describeHistory({
      event: 'role.updated',
      before: { name: 'Ops', description: 'A' },
      after: { name: 'Operations', description: 'B', added: ['bookings.delete'], removed: ['users.manage'] }
    }, t, label)).toBe('Renamed · Ops → Operations · Description changed · Permissions changed · added: Delete bookings, removed: users.manage')
  })

  it('maps itinerary events', () => {
    expect(describeHistory({ event: 'itinerary.created', before: null, after: null }, t)).toBe('Created')
    expect(describeHistory({ event: 'itinerary.deleted', before: null, after: null }, t)).toBe('Deleted')
    expect(describeHistory({ event: 'itinerary.published', before: null, after: { status: 'PUBLISHED' } }, t)).toBe('Published')
    expect(describeHistory({ event: 'itinerary.hidden', before: null, after: { status: 'HIDDEN' } }, t)).toBe('Hidden from engine')
    expect(describeHistory({ event: 'itinerary.image_replaced', before: null, after: null }, t)).toBe('Hero photo replaced')
    expect(describeHistory({
      event: 'itinerary.updated',
      before: { name: 'West' },
      after: { name: 'Western Realm' }
    }, t)).toBe('Updated · name: West → Western Realm')
  })

  it('maps departure events', () => {
    expect(describeHistory({ event: 'departure.created', before: null, after: null }, t)).toBe('Created')
    expect(describeHistory({ event: 'departure.deleted', before: null, after: null }, t)).toBe('Deleted')
    expect(describeHistory({
      event: 'departure.status_changed',
      before: { status: 'ON_SALE' },
      after: { status: 'CLOSED' }
    }, t)).toBe('Status · ON_SALE → CLOSED')
    expect(describeHistory({
      event: 'departure.updated',
      before: { public_note: 'Launch' },
      after: { public_note: 'Inaugural sailing' }
    }, t)).toBe('Updated · public_note: Launch → Inaugural sailing')
  })

  it('maps block events', () => {
    expect(describeHistory({ event: 'block.created', before: null, after: { reason: 'FAM_TRIP' } }, t)).toBe('Created')
    expect(describeHistory({ event: 'block.released', before: null, after: { release_note: null } }, t)).toBe('Released')
    expect(describeHistory({
      event: 'block.updated',
      before: { reason: 'FAM_TRIP' },
      after: { reason: 'MAINTENANCE' }
    }, t)).toBe('Updated · reason: FAM_TRIP → MAINTENANCE')
    expect(describeHistory({ event: 'block.updated', before: null, after: null }, t)).toBe('Updated')
  })

  it('maps booking events', () => {
    expect(describeHistory({
      event: 'booking.created',
      before: null,
      after: { what: 'Reservation created in RMS — Suite 04 · 2 AD · USD 26,600' }
    }, t)).toBe('Reservation created in RMS — Suite 04 · 2 AD · USD 26,600')
    expect(describeHistory({ event: 'booking.requested', before: null, after: { status: 'REQUESTED' } }, t)).toBe('Requested')
    expect(describeHistory({
      event: 'booking.status_changed',
      before: { status: 'CONFIRMED' },
      after: { status: 'CANCELLED', what: 'Status CONFIRMED → CANCELLED' }
    }, t)).toBe('Status CONFIRMED → CANCELLED')
    expect(describeHistory({
      event: 'booking.moved',
      before: { departure: '7 Nov 2027 · ANAMARA', cabin: 'Suite 04', total: 26600 },
      after: { departure: '19 Dec 2027 · ANAMARA', cabin: 'Suite 02', total: 28100 }
    }, t)).toBe('Moved · 7 Nov 2027 · Suite 04 → 19 Dec 2027 · Suite 02 · USD 26,600 → USD 28,100')
    expect(describeHistory({ event: 'booking.updated', before: { internal_notes: null }, after: { internal_notes: 'Call back' } }, t)).toBe('Updated')
    expect(describeHistory({
      event: 'booking.owner_changed',
      before: { owner_name: 'Mateo R.' },
      after: { owner_name: 'Lucía B.' }
    }, t)).toBe('Owner changed · Mateo R. → Lucía B.')
    expect(describeHistory({ event: 'booking.deleted', before: null, after: { what: 'Reservation deleted' } }, t)).toBe('Reservation deleted')
    expect(describeHistory({ event: 'booking.released', before: null, after: { what: 'Request released — hold returned to inventory' } }, t)).toBe('Request released — hold returned to inventory')
    expect(describeHistory({
      event: 'booking.overdue_extended',
      before: null,
      after: { what: 'OPS-007 decision — extension granted · OVERDUE → CONFIRMED' }
    }, t)).toBe('OPS-007 decision — extension granted · OVERDUE → CONFIRMED')
    expect(describeHistory({
      event: 'booking.overdue_flagged',
      before: null,
      after: { overdue_days: 12, balance: 23940 }
    }, t)).toBe('OVERDUE flag · 12 days · USD 23,940')
    expect(describeHistory({
      event: 'payment.recorded',
      before: null,
      after: { reference: 'ANK-2026-0014-D01', amount: 2660, status: 'AWAITING_WIRE' }
    }, t)).toBe('Payment recorded · ANK-2026-0014-D01 · USD 2,660 · AWAITING WIRE')
    expect(describeHistory({
      event: 'payment.settled',
      before: null,
      after: { reference: 'ANK-2026-0014-D01', bank_reference: 'WIRE-991' }
    }, t)).toBe('Wire received · ANK-2026-0014-D01 · WIRE-991')
    expect(describeHistory({
      event: 'booking.nps_recorded',
      before: null,
      after: { what: 'Post-trip survey recorded — score 6 · alert sent to guest experience' }
    }, t)).toBe('Post-trip survey recorded — score 6 · alert sent to guest experience')
    expect(describeHistory({
      event: 'refund.not_due',
      before: null,
      after: { what: 'Nothing was paid, so nothing is owed.' }
    }, t)).toBe('Nothing was paid, so nothing is owed.')
    expect(describeHistory({
      event: 'refund.requested',
      before: null,
      after: { penalty_amount: 1330, refund_due: 1330 }
    }, t)).toBe('Refund requested · penalty USD 1,330 · refund due USD 1,330')
    expect(describeHistory({
      event: 'guest.added',
      before: null,
      after: { what: 'Guest slot added (3 guests)' }
    }, t)).toBe('Guest slot added (3 guests)')
    expect(describeHistory({
      event: 'guest.updated',
      before: null,
      after: { what: 'Passenger updated — Julia Brandt: passport number, medical note' }
    }, t)).toBe('Passenger updated — Julia Brandt: passport number, medical note')
    expect(describeHistory({
      event: 'guest.removed',
      before: null,
      after: { what: 'Empty guest slot removed (2 guests)' }
    }, t)).toBe('Empty guest slot removed (2 guests)')
    expect(describeHistory({
      event: 'guest.guardian_consented',
      before: null,
      after: { what: 'Guardian consent recorded' }
    }, t)).toBe('Guardian consent recorded')
    expect(describeHistory({
      event: 'consent.recorded',
      before: null,
      after: { document: 'PRIVACY', version: 'v2026.1', source: 'ENGINE' }
    }, t)).toBe('Consent recorded · Privacy policy · v2026.1 · Booking engine')
    expect(describeHistory({
      event: 'consent.recorded',
      before: null,
      after: { what: 'Consent recorded — Privacy policy' }
    }, t)).toBe('Consent recorded — Privacy policy')
    expect(describeHistory({
      event: 'extra.added',
      before: null,
      after: { what: 'Extra added — Domestic flights GYE/UIO ↔ SCY (round-trip) × 2 @ USD 420' }
    }, t)).toBe('Extra added — Domestic flights GYE/UIO ↔ SCY (round-trip) × 2 @ USD 420')
    expect(describeHistory({
      event: 'extra.removed',
      before: null,
      after: { what: 'Extra removed — Spa treatment × 1' }
    }, t)).toBe('Extra removed — Spa treatment × 1')
    expect(describeHistory({
      event: 'booking.fees_changed',
      before: null,
      after: { what: 'PNG park entry fee — collected by Iconic (invoiced, due with the balance)' }
    }, t)).toBe('PNG park entry fee — collected by Iconic (invoiced, due with the balance)')
    expect(describeHistory({
      event: 'document.issued',
      before: null,
      after: { what: 'Invoice issued · v1' }
    }, t)).toBe('Invoice issued · v1')
    expect(describeHistory({
      event: 'document.sent',
      before: null,
      after: { what: 'Invoice sent' }
    }, t)).toBe('Invoice sent')
    expect(describeHistory({
      event: 'document.send_failed',
      before: null,
      after: { what: 'Invoice send failed' }
    }, t)).toBe('Invoice send failed')
    expect(describeHistory({
      event: 'booking.billing_changed',
      before: null,
      after: { what: 'Billing details updated' }
    }, t)).toBe('Billing details updated')
    expect(describeHistory({
      event: 'payment_request.sent',
      before: null,
      after: { what: 'Payment link sent' }
    }, t)).toBe('Payment link sent')
    expect(describeHistory({
      event: 'payment_request.send_failed',
      before: null,
      after: { what: 'Payment link send failed' }
    }, t)).toBe('Payment link send failed')
    expect(describeHistory({ event: 'offer.created', before: null, after: null }, t)).toBe('Created')
    expect(describeHistory({ event: 'offer.submitted', before: null, after: null }, t)).toBe('Submitted for Director approval')
    expect(describeHistory({ event: 'offer.approved', before: null, after: null }, t)).toBe('Approved')
    expect(describeHistory({ event: 'offer.rejected', before: null, after: null }, t)).toBe('Rejected')
    expect(describeHistory({ event: 'offer.paused', before: null, after: null }, t)).toBe('Paused')
    expect(describeHistory({ event: 'offer.resumed', before: null, after: null }, t)).toBe('Resumed')
    expect(describeHistory({
      event: 'offer.updated',
      before: { name: 'Old' },
      after: { name: 'New' }
    }, t)).toBe('Updated · name: Old → New')
    expect(describeHistory({ event: 'offer.updated', before: null, after: null }, t)).toBe('Updated')
  })

  it('never renders raw JSON for an unknown event', () => {
    expect(describeHistory({
      event: 'something.else',
      before: { cabin: 'S1' },
      after: { cabin: 'S2' }
    }, t)).toBe('something.else · cabin: S1 → S2')
  })
})
