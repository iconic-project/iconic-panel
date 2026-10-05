import { mountSuspended } from '@nuxt/test-utils/runtime'
import { computed } from 'vue'
import { describe, expect, it } from 'vitest'
import { RATES_DRAFT_KEY, type RatesDraft } from '../../app/components/rates/rateHelpers'
import RatesSeasonsPanel from '../../app/components/rates/RatesSeasonsPanel.vue'

const draft = computed(() => ({
  seasons: [
    { code: 'LOW', name: 'Low', from: '2026-01-01', to: '2026-03-31' },
    { code: 'SHOULDER', name: 'Shoulder', from: '2026-04-01', to: '2026-06-30' },
    { code: 'HIGH', name: 'High', from: '2026-07-01', to: '2026-09-30' },
    { code: 'PEAK', name: 'Peak', from: '2026-12-20', to: '2026-12-31' }
  ]
}) as RatesDraft)

describe('RatesSeasonsPanel', () => {
  it('shows October and November as gaps and December as partial', async () => {
    const wrapper = await mountSuspended(RatesSeasonsPanel, {
      props: {
        canPublish: false,
        errorsFor: () => [],
        warningsFor: () => []
      },
      global: {
        provide: {
          [RATES_DRAFT_KEY as symbol]: draft
        },
        stubs: {
          USelect: true
        }
      }
    })

    const months = wrapper.findAll('.season-month')

    expect(months).toHaveLength(12)
    expect(months[9]?.classes()).toContain('is-gap')
    expect(months[10]?.classes()).toContain('is-gap')
    expect(months[11]?.classes()).toContain('is-partial')
    expect(months[0]?.classes()).not.toContain('is-gap')
  })
})
