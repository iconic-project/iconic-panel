import { describe, expect, it } from 'vitest'
import {
  blockToOpen
} from '../../app/components/blocks/blockHelpers'

describe('blockToOpen', () => {
  const blocks = [
    { reference: 'BLK-001' },
    { reference: 'BLK-002' }
  ]

  it('returns null when the query is missing, empty, or unknown', () => {
    expect(blockToOpen(undefined, blocks)).toBeNull()
    expect(blockToOpen(null, blocks)).toBeNull()
    expect(blockToOpen('', blocks)).toBeNull()
    expect(blockToOpen('BLK-999', blocks)).toBeNull()
  })

  it('matches a string or the first array value', () => {
    expect(blockToOpen('BLK-001', blocks)?.reference).toBe('BLK-001')
    expect(blockToOpen(['BLK-002', 'BLK-001'], blocks)?.reference).toBe('BLK-002')
  })
})
