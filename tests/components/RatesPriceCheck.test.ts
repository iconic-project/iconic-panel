import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it } from 'vitest'
import RatesPriceCheck from '../../app/components/rates/RatesPriceCheck.vue'
import type { PriceCheckRow, StayQuote } from '../../app/types/api'

const quote: StayQuote = {
  night_lines: [{
    night: '2026-02-02',
    season: 'LOW',
    base: 100,
    extras: 0,
    single: 0,
    dow: 0,
    supplements: 0,
    plan_adjust: 0,
    total: 100
  }],
  lines: [{ code: 'room', label: 'Room', amount: 100 }],
  total: 100,
  deposit_pct: 30,
  deposit: 30,
  rates_version_id: 1,
  terms: { balance_days: 21, cancellation_set: 'standard' },
  tax_lines: [{
    code: 'CITY',
    label: 'City tax',
    amount: 5,
    charged: false,
    shown_in_price_panel: true
  }, {
    code: 'HIDE',
    label: 'Hidden fee',
    amount: 9,
    charged: true,
    shown_in_price_panel: false
  }],
  total_including_charged_taxes: 100
}

const row: PriceCheckRow = {
  key: 'Q1',
  label: 'STD · 2026-02-02 · 1 night',
  input: {
    room_type: 'STD',
    check_in: '2026-02-02',
    check_out: '2026-02-03',
    nights: 1,
    adults: 2,
    child_ages: [],
    rate_plan: 'BAR'
  },
  published: quote,
  draft: quote,
  difference: 0
}

describe('RatesPriceCheck', () => {
  it('renders the night line and a tax that is shown in the price panel', async () => {
    const wrapper = await mountSuspended(RatesPriceCheck, {
      props: {
        rows: [row],
        stays: [{
          key: 'Q1',
          room_type: 'STD',
          check_in: '2026-02-02',
          check_out: '2026-02-03',
          adults: 2,
          child_ages: '',
          rate_plan: 'BAR'
        }],
        stale: false,
        roomTypes: [{ code: 'STD', name: 'Standard' }],
        plans: [{ code: 'BAR', name: 'Best available' }]
      },
      global: {
        stubs: {
          AnkStayInput: true
        }
      }
    })

    expect(wrapper.text()).toContain('2026-02-02')
    expect(wrapper.text()).toContain('USD 100')
    expect(wrapper.text()).toContain('City tax')
    expect(wrapper.text()).not.toContain('Hidden fee')
    expect(wrapper.text()).toContain('Deposit 30% · USD 30')
    expect(wrapper.text()).toContain('Cancellation standard')
  })
})
