import { describe, expect, it } from 'vitest'
import {
  formatHoldRemaining,
  formatSla,
  holdTypePill,
  slaRemainingMinutes,
  waitlistRowStatus
} from '../../app/components/requests/requestHelpers'

const DAY = 540

describe('formatHoldRemaining', () => {
  it('shows hours when under 72 business hours remain', () => {
    expect(formatHoldRemaining(46 * 60, DAY, false)).toBe('46 business hours')
  })

  it('shows days when 72 business hours or more remain', () => {
    expect(formatHoldRemaining(8 * DAY, DAY, false)).toBe('8 business days')
    expect(formatHoldRemaining(72 * 60, DAY, false)).toBe('8 business days')
  })

  it('stays on hours when the business-day length is missing', () => {
    expect(formatHoldRemaining(4 * DAY, 0, false)).toBe('36 business hours')
  })

  it('shows the expired string when the hold is expired or empty', () => {
    expect(formatHoldRemaining(200, DAY, true)).toBe('HOLD EXPIRED — ROOM NOT HELD')
    expect(formatHoldRemaining(0, DAY, false)).toBe('HOLD EXPIRED — ROOM NOT HELD')
  })
})

describe('slaRemainingMinutes and formatSla', () => {
  const due = '2026-09-20T15:00:00.000Z'

  it('formats remaining hours from due_at and now', () => {
    const remaining = slaRemainingMinutes(due, new Date('2026-09-19T20:00:00.000Z'))
    expect(remaining).toBe(19 * 60)
    expect(formatSla(remaining)).toEqual({ tone: 'ok', text: '19h' })
  })

  it('formats a breach from due_at and now', () => {
    const remaining = slaRemainingMinutes(due, new Date('2026-09-21T17:00:00.000Z'))
    expect(remaining).toBe(-26 * 60)
    expect(formatSla(remaining)).toEqual({ tone: 'bad', text: 'SLA BREACH — 26h' })
  })
})

describe('holdTypePill', () => {
  it('maps request, web minutes and agency', () => {
    expect(holdTypePill('REQUEST')).toBe('REQUEST')
    expect(holdTypePill('WEB', 20)).toBe('WEB 20-MIN')
    expect(holdTypePill('AGENCY')).toBe('AGENCY')
  })
})

describe('waitlistRowStatus', () => {
  it('classifies notified, room free and waiting', () => {
    expect(waitlistRowStatus({
      notified: { at: '2026-09-20T00:00:00Z', channel: 'EMAIL', by: 'Carolina' },
      room_available: true
    })).toBe('notified')
    expect(waitlistRowStatus({ notified: null, room_available: true })).toBe('room_free')
    expect(waitlistRowStatus({ notified: null, room_available: false })).toBe('waiting')
  })
})
