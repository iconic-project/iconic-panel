import type { ChangeHistoryEntry } from '../../types/api'

export type HistoryTranslate = (key: string, params?: Record<string, string>) => string

function asRecord(value: { [key: string]: unknown } | null): Record<string, unknown> {
  return value ?? {}
}

function stringField(record: Record<string, unknown>, key: string): string | undefined {
  const value = record[key]

  return typeof value === 'string' && value !== '' ? value : undefined
}

function stringList(value: unknown): Array<string> {
  if (!Array.isArray(value)) {
    return []
  }

  return value.filter((item): item is string => typeof item === 'string')
}

function compactValue(value: unknown): string {
  if (value === null || value === undefined) {
    return '—'
  }

  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value)
  }

  if (Array.isArray(value)) {
    return value.map(item => compactValue(item)).join(', ')
  }

  if (typeof value === 'object') {
    const keys = Object.keys(value)

    return keys.length === 0 ? '—' : keys.join(', ')
  }

  return '—'
}

function moneyUsd(value: unknown): string {
  if (typeof value === 'number' && Number.isInteger(value)) {
    return `USD ${value.toLocaleString('en-US')}`
  }

  return compactValue(value)
}

function statusWords(value: string): string {
  return value.replaceAll('_', ' ')
}

const CONSENT_DOCUMENTS: Record<string, string> = {
  TERMS: 'history.documents.terms',
  CANCELLATION: 'history.documents.cancellation',
  PRIVACY: 'history.documents.privacy',
  INSURANCE: 'history.documents.insurance',
  MARKETING: 'history.documents.marketing',
  CHARTER_PROPOSAL: 'history.documents.charterProposal'
}

const CONSENT_SOURCES: Record<string, string> = {
  ENGINE: 'history.sources.engine',
  PAYMENT_LINK: 'history.sources.paymentLink',
  STAFF: 'history.sources.staff'
}

function labeled(map: Record<string, string>, value: string | undefined, t: HistoryTranslate): string {
  if (value === undefined) {
    return '—'
  }

  const key = map[value]

  return key === undefined ? value : t(key)
}

function storedDate(record: Record<string, unknown>): string {
  const raw = stringField(record, 'departure') ?? compactValue(record.departure)
  const date = raw.split(' · ')[0] ?? raw

  return date === '' ? raw : date
}

function compactDiff(before: Record<string, unknown>, after: Record<string, unknown>): string {
  const keys = Array.from(new Set([...Object.keys(before), ...Object.keys(after)]))
  const parts: Array<string> = []

  for (const key of keys) {
    const from = compactValue(before[key])
    const to = compactValue(after[key])

    if (from !== to) {
      parts.push(`${key}: ${from} → ${to}`)
    }
  }

  return parts.join(', ')
}

export type PermissionLabel = (value: string) => string

export function describeHistory(
  entry: Pick<ChangeHistoryEntry, 'event' | 'before' | 'after'>,
  t: HistoryTranslate,
  permissionLabel?: PermissionLabel
): string {
  const before = asRecord(entry.before)
  const after = asRecord(entry.after)

  switch (entry.event) {
    case 'user.invited': {
      const role = stringField(after, 'role')

      return role
        ? t('history.events.userInvitedAs', { role })
        : t('history.events.userInvited')
    }
    case 'user.activated':
      return t('history.events.userActivated')
    case 'user.invitation_resent':
      return t('history.events.userInvitationResent')
    case 'user.updated':
      return t('history.events.userUpdated', {
        before: stringField(before, 'name') ?? compactValue(before.name),
        after: stringField(after, 'name') ?? compactValue(after.name)
      })
    case 'user.role_changed':
      return t('history.events.userRoleChanged', {
        before: stringField(before, 'role') ?? compactValue(before.role),
        after: stringField(after, 'role') ?? compactValue(after.role)
      })
    case 'user.disabled':
      return t('history.events.userDisabled')
    case 'user.enabled':
      return t('history.events.userEnabled')
    case 'role.created':
      return t('history.events.roleCreated')
    case 'role.updated': {
      const labelOf = permissionLabel ?? ((value: string) => value)
      const parts: Array<string> = []
      const beforeName = stringField(before, 'name')
      const afterName = stringField(after, 'name')

      if (beforeName !== undefined && afterName !== undefined && beforeName !== afterName) {
        parts.push(t('history.events.roleRenamed', { before: beforeName, after: afterName }))
      }

      if ('description' in before || 'description' in after) {
        parts.push(t('history.events.roleDescriptionChanged'))
      }

      const added = stringList(after.added).map(labelOf)
      const removed = stringList(after.removed).map(labelOf)
      const permissionParts: Array<string> = []

      if (added.length > 0) {
        permissionParts.push(t('history.events.roleAdded', { added: added.join(', ') }))
      }

      if (removed.length > 0) {
        permissionParts.push(t('history.events.roleRemoved', { removed: removed.join(', ') }))
      }

      if (permissionParts.length > 0) {
        parts.push(t('history.events.rolePermissionsChanged', {
          parts: permissionParts.join(', ')
        }))
      }

      return parts.length > 0 ? parts.join(' · ') : t('history.events.roleUpdated')
    }
    case 'role.deleted':
      return t('history.events.roleDeleted')
    case 'itinerary.created':
      return t('history.events.itineraryCreated')
    case 'itinerary.deleted':
      return t('history.events.itineraryDeleted')
    case 'itinerary.published':
      return t('history.events.itineraryPublished')
    case 'itinerary.hidden':
      return t('history.events.itineraryHidden')
    case 'itinerary.image_replaced':
      return t('history.events.itineraryImageReplaced')
    case 'itinerary.updated': {
      const summary = compactDiff(before, after)

      return summary
        ? t('history.events.itineraryUpdated', { summary })
        : t('history.events.itineraryUpdatedBare')
    }
    case 'departure.created':
      return t('history.events.departureCreated')
    case 'departure.deleted':
      return t('history.events.departureDeleted')
    case 'departure.status_changed':
      return t('history.events.departureStatusChanged', {
        before: compactValue(before.status),
        after: compactValue(after.status)
      })
    case 'departure.updated': {
      const summary = compactDiff(before, after)

      return summary
        ? t('history.events.departureUpdated', { summary })
        : t('history.events.departureUpdatedBare')
    }
    case 'block.created':
      return t('history.events.blockCreated')
    case 'block.released':
      return t('history.events.blockReleased')
    case 'block.updated': {
      const summary = compactDiff(before, after)

      return summary
        ? t('history.events.blockUpdated', { summary })
        : t('history.events.blockUpdatedBare')
    }
    case 'offer.created':
      return t('history.events.offerCreated')
    case 'offer.submitted':
      return t('history.events.offerSubmitted')
    case 'offer.approved':
      return t('history.events.offerApproved')
    case 'offer.rejected':
      return t('history.events.offerRejected')
    case 'offer.paused':
      return t('history.events.offerPaused')
    case 'offer.resumed':
      return t('history.events.offerResumed')
    case 'offer.updated': {
      const summary = compactDiff(before, after)

      return summary
        ? t('history.events.offerUpdated', { summary })
        : t('history.events.offerUpdatedBare')
    }
    case 'booking.created':
      return stringField(after, 'what') ?? t('history.events.bookingCreated')
    case 'booking.requested':
      return t('history.events.bookingRequested')
    case 'booking.status_changed':
      return stringField(after, 'what') ?? t('history.events.bookingStatusChanged', {
        before: statusWords(stringField(before, 'status') ?? compactValue(before.status)),
        after: statusWords(stringField(after, 'status') ?? compactValue(after.status))
      })
    case 'booking.moved':
      return t('history.events.bookingMoved', {
        fromDate: storedDate(before),
        fromCabin: stringField(before, 'cabin') ?? '—',
        toDate: storedDate(after),
        toCabin: stringField(after, 'cabin') ?? '—',
        fromTotal: moneyUsd(before.total),
        toTotal: moneyUsd(after.total)
      })
    case 'booking.updated':
      return t('history.events.bookingUpdated')
    case 'booking.owner_changed':
      return t('history.events.bookingOwnerChanged', {
        before: stringField(before, 'owner_name') ?? compactValue(before.owner_name),
        after: stringField(after, 'owner_name') ?? compactValue(after.owner_name)
      })
    case 'booking.deleted':
      return stringField(after, 'what') ?? t('history.events.bookingDeleted')
    case 'booking.nps_recorded':
      return stringField(after, 'what') ?? entry.event
    case 'booking.released':
      return stringField(after, 'what') ?? t('history.events.bookingReleased')
    case 'booking.overdue_extended':
      return stringField(after, 'what') ?? t('history.events.bookingOverdueExtended')
    case 'booking.overdue_flagged':
      return t('history.events.bookingOverdueFlagged', {
        days: compactValue(after.overdue_days),
        balance: moneyUsd(after.balance)
      })
    case 'payment.recorded':
      return t('history.events.paymentRecorded', {
        reference: stringField(after, 'reference') ?? compactValue(after.reference),
        amount: moneyUsd(after.amount),
        status: statusWords(stringField(after, 'status') ?? compactValue(after.status))
      })
    case 'payment.settled':
      return t('history.events.paymentSettled', {
        reference: stringField(after, 'reference') ?? compactValue(after.reference),
        bank: stringField(after, 'bank_reference') ?? compactValue(after.bank_reference)
      })
    case 'refund.not_due':
      return stringField(after, 'what') ?? t('history.events.refundNotDue')
    case 'refund.requested':
      return t('history.events.refundRequested', {
        penalty: moneyUsd(after.penalty_amount),
        refund: moneyUsd(after.refund_due)
      })
    case 'consent.recorded': {
      const document = stringField(after, 'document')

      if (document !== undefined) {
        return t('history.events.consentRecorded', {
          document: labeled(CONSENT_DOCUMENTS, document, t),
          version: stringField(after, 'version') ?? '—',
          source: labeled(CONSENT_SOURCES, stringField(after, 'source'), t)
        })
      }

      return stringField(after, 'what') ?? entry.event
    }
    case 'guest.added':
    case 'guest.updated':
    case 'guest.removed':
    case 'guest.guardian_consented':
    case 'extra.added':
    case 'extra.removed':
    case 'booking.fees_changed':
    case 'document.issued':
    case 'document.sent':
    case 'document.send_failed':
    case 'booking.billing_changed':
    case 'payment_request.sent':
    case 'payment_request.send_failed': {
      const what = stringField(after, 'what')

      if (what !== undefined) {
        return what
      }

      const summary = compactDiff(before, after)

      return summary
        ? t('history.events.unknown', { event: entry.event, summary })
        : entry.event
    }
    default: {
      const summary = compactDiff(before, after)

      return summary
        ? t('history.events.unknown', { event: entry.event, summary })
        : entry.event
    }
  }
}
