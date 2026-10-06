import type { HoldType, WaitlistEntry } from '../../types/api'

export const HOLD_HOUR_THRESHOLD = 72

export type SlaTone = 'ok' | 'bad'

export type SlaDisplay = {
  tone: SlaTone
  text: string
}

export type WaitlistRowStatus = 'notified' | 'room_free' | 'waiting'

export function formatHoldRemaining(
  remainingBusinessMinutes: number,
  businessDayMinutes: number,
  expired: boolean
): string {
  if (expired || remainingBusinessMinutes <= 0) {
    return 'HOLD EXPIRED — ROOM NOT HELD'
  }

  const remainingHours = remainingBusinessMinutes / 60

  if (remainingHours < HOLD_HOUR_THRESHOLD || businessDayMinutes <= 0) {
    return `${String(Math.round(remainingHours))} business hours`
  }

  return `${String(Math.round(remainingBusinessMinutes / businessDayMinutes))} business days`
}

export function slaRemainingMinutes(dueAt: string, now: Date): number {
  return Math.round((Date.parse(dueAt) - now.getTime()) / 60_000)
}

export function formatSla(remainingMinutes: number): SlaDisplay {
  const hours = Math.round(Math.abs(remainingMinutes) / 60)

  if (remainingMinutes >= 0) {
    return { tone: 'ok', text: `${String(hours)}h` }
  }

  return { tone: 'bad', text: `SLA BREACH — ${String(hours)}h` }
}

export function holdTypePill(type: string, minutes?: number): string {
  if (type === 'WEB') {
    return minutes === undefined ? 'WEB' : `WEB ${String(minutes)}-MIN`
  }

  if (type === 'CHARTER_QUOTE') {
    return 'CHARTER QUOTE'
  }

  return type
}

export function waitlistRowStatus(entry: Pick<WaitlistEntry, 'notified' | 'room_available'>): WaitlistRowStatus {
  if (entry.notified !== null) {
    return 'notified'
  }

  if (entry.room_available) {
    return 'room_free'
  }

  return 'waiting'
}

export function viaChannel(channel: string): string {
  return `VIA ${channel}`
}

export function isHoldType(value: string): value is HoldType {
  return value === 'WEB' || value === 'REQUEST' || value === 'AGENCY' || value === 'CHARTER_QUOTE'
}
