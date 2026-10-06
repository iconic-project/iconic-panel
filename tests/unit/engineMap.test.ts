import { describe, expect, it } from 'vitest'
import {
  engineMapCounts,
  engineMapDecisions,
  engineMapMissingIsGap,
  engineMapOpen,
  engineMapPillClass,
  engineMapPillKey,
  engineMapRows
} from '../../app/components/engine-map/catalogue'

describe('engine map catalogue', () => {
  it('maps every prototype element', () => {
    expect(engineMapRows).toHaveLength(27)
    expect(engineMapDecisions).toHaveLength(10)
    expect(engineMapOpen).toHaveLength(7)
  })

  it('counts sources the way the prototype does', () => {
    expect(engineMapCounts(engineMapRows)).toEqual({
      mapped: 27,
      fedByNew: 17,
      fedByExisting: 10,
      notYet: 0
    })
  })

  it('labels each source kind', () => {
    expect(engineMapPillClass('NEW')).toBe('p-conf')
    expect(engineMapPillKey('NEW')).toBe('engineMap.pillNew')
    expect(engineMapPillClass('NEW + EXISTING')).toBe('p-conf')
    expect(engineMapPillKey('NEW + EXISTING')).toBeNull()
    expect(engineMapPillClass('EXISTING')).toBe('p-pend')
    expect(engineMapPillKey('EXISTING')).toBe('engineMap.pillExisting')
    expect(engineMapPillClass('NOT YET')).toBe('p-canc')
    expect(engineMapPillKey('NOT YET')).toBe('engineMap.pillNotYet')
  })

  it('marks a missing element as a gap', () => {
    expect(engineMapMissingIsGap(0)).toBe(false)
    expect(engineMapMissingIsGap(1)).toBe(true)
  })
})
