import { describe, expect, it } from 'vitest'
import { rateFieldLabels, type RatesDraft } from '../../app/components/rates/rateHelpers'

const draft = {
  currency: 'USD'
} as RatesDraft

describe('rateFieldLabels', () => {
  it('labels the currency field', () => {
    expect(rateFieldLabels(draft).currency).toBe('Currency')
  })
})
