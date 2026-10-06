import { describe, expect, it } from 'vitest'
import {
  npsScoreClass,
  prefStatusClass
} from '../../app/components/guest-experience/guestExperienceHelpers'

describe('guestExperienceHelpers', () => {
  it('maps preference status onto the prototype pills', () => {
    expect(prefStatusClass('ANSWERED')).toBe('p-conf')
    expect(prefStatusClass('SENT_NO_REPLY')).toBe('p-hold')
    expect(prefStatusClass('SCHEDULED')).toBe('p-pend')
  })

  it('colours a score from the API thresholds', () => {
    expect(npsScoreClass(6, 7, 8)).toBe('p-canc')
    expect(npsScoreClass(7, 7, 8)).toBe('p-pend')
    expect(npsScoreClass(8, 7, 8)).toBe('p-conf')
    expect(npsScoreClass(9, 7, 8)).toBe('p-conf')
    expect(npsScoreClass(5, 6, 9)).toBe('p-canc')
    expect(npsScoreClass(6, 6, 9)).toBe('p-pend')
  })
})
