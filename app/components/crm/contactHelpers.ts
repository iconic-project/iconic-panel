import type { AttributionTouch } from '#iconic-ui/app/types'
import type { ContactMerge, ContactSegment } from '../../types/api'

export function segmentPillClass(segment: ContactSegment): string {
  if (segment === 'HIGH') {
    return 'hi'
  }

  if (segment === 'MID') {
    return 'mid'
  }

  return 'new'
}

export function lifecyclePillClass(_lifecycle: string): string {
  return ''
}

export function consentPillLabel(marketing: boolean): string {
  return marketing ? 'MKT ✓' : 'TX ONLY'
}

export function parseEmailConflictContactId(message: string): number | null {
  const match = message.match(/contact #(\d+)/)

  if (match === null || match[1] === undefined) {
    return null
  }

  const id = Number(match[1])

  return Number.isFinite(id) ? id : null
}

export function emailConflictId(error: unknown, message: string): number | null {
  if (typeof error === 'object' && error !== null && 'conflictingContact' in error) {
    const contact = error.conflictingContact

    if (
      typeof contact === 'object'
      && contact !== null
      && 'id' in contact
      && typeof contact.id === 'number'
    ) {
      return contact.id
    }
  }

  return parseEmailConflictContactId(message)
}

export function instantsEqual(left: string | null | undefined, right: string | null | undefined): boolean {
  if (left == null || right == null || left === '' || right === '') {
    return false
  }

  const a = Date.parse(left)
  const b = Date.parse(right)

  if (Number.isNaN(a) || Number.isNaN(b)) {
    return false
  }

  return a === b
}

export type MergeMatch
  = { kind: 'none' }
    | { kind: 'one', merge: ContactMerge }
    | { kind: 'ambiguous' }

export function matchMergeForTimeline(
  at: string,
  survivorId: number | undefined,
  merges: Array<ContactMerge>
): MergeMatch {
  if (survivorId === undefined) {
    return { kind: 'none' }
  }

  const matches = merges.filter(merge =>
    merge.survivor_id === survivorId
    && merge.undone_at === null
    && instantsEqual(at, merge.merged_at)
  )

  if (matches.length === 0) {
    return { kind: 'none' }
  }

  const first = matches[0]

  if (matches.length === 1 && first !== undefined) {
    return { kind: 'one', merge: first }
  }

  return { kind: 'ambiguous' }
}

/**
 * Exclusive at 30 days, matching UndoContactMerge:
 * now()->greaterThanOrEqualTo(merged_at + 30 days) is a 422.
 * Undo is offered only while now < merged_at + 30 days (UTC).
 */
export function isUndoWindowOpen(mergedAt: string | null | undefined, now: Date = new Date()): boolean {
  if (mergedAt == null || mergedAt === '') {
    return false
  }

  const start = Date.parse(mergedAt)

  if (Number.isNaN(start)) {
    return false
  }

  const deadline = start + (30 * 24 * 60 * 60 * 1000)

  return now.getTime() < deadline
}

export function shouldLookupPartner(lifecycle: string, type: string): boolean {
  return lifecycle === 'AGENT' || type === 'TRAVEL_AGENT'
}

export function matchPartnerByEmail<T extends { email: string }>(
  agencies: Array<T>,
  email: string | null | undefined
): T | null {
  if (email == null || email.trim() === '') {
    return null
  }

  const needle = email.trim().toLowerCase()
  const matches = agencies.filter(agency => agency.email.trim().toLowerCase() === needle)

  if (matches.length !== 1) {
    return null
  }

  return matches[0] ?? null
}

export function duplicateReasonLabel(reason: string): string {
  if (reason === 'phone_e164') {
    return 'Same phone'
  }

  if (reason === 'name_country') {
    return 'Same name and country'
  }

  return reason
}

export function formatAttribution(touch: AttributionTouch | null): string {
  if (touch === null) {
    return '—'
  }

  const parts = [
    touch.source,
    touch.medium,
    touch.campaign,
    touch.content,
    touch.term,
    touch.landing_path
  ].filter((part): part is string => typeof part === 'string' && part !== '')

  return parts.length === 0 ? '—' : parts.join(' · ')
}

export function filterLabel(
  options: Array<{ value: string, label: string }> | undefined,
  value: string | null
): string {
  if (value === null || value === '') {
    return '—'
  }

  return options?.find(option => option.value === value)?.label ?? value
}
