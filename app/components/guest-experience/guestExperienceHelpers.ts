import type { PreferenceStatus } from '../../types/api'

export function prefStatusClass(status: PreferenceStatus): string {
  if (status === 'ANSWERED') {
    return 'p-conf'
  }

  if (status === 'SENT_NO_REPLY') {
    return 'p-hold'
  }

  if (status === 'SCHEDULED') {
    return 'p-pend'
  }

  return ''
}

export function npsScoreClass(score: number, alertBelow: number, reviewFrom: number): string {
  if (score < alertBelow) {
    return 'p-canc'
  }

  if (score >= reviewFrom) {
    return 'p-conf'
  }

  return 'p-pend'
}
