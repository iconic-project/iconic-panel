import type { ComputedRef, InjectionKey } from 'vue'
import type { EngineSettingsDocument } from '../../types/api'

export type EngineSettingsDraft = {
  guests: {
    max_per_property: number | null
    child_min_age: number | null
    child_max_age: number | null
    adult_required_with_children: boolean
    under_age_message: string
  }
  calendar: {
    default_search_from: string
    default_search_to: string
    default_adults: number | null
    horizon_months: number | null
  }
  locale: EngineSettingsDocument['locale']
  fees: {
    show_in_price_panel: boolean
    footnote: string
  }
  copy: EngineSettingsDocument['copy']
}

export type EnginePanelAccess = {
  canEdit: (path: string) => boolean
  errorsFor: (path: string) => Array<string>
}

export const ENGINE_SETTINGS_DRAFT_KEY: InjectionKey<ComputedRef<EngineSettingsDraft | null>> = Symbol('engine-settings-draft')

export const COPY_CHAR_LIMIT = 320
export const UNDER_AGE_LIMIT = 60

export function engineFieldLabels(): Record<string, string> {
  return {
    'guests.max_per_property': 'Max guests per property',
    'guests.child_min_age': 'Child minimum age',
    'guests.child_max_age': 'Child maximum age',
    'guests.adult_required_with_children': 'Adult required with children',
    'guests.under_age_message': 'Under-age message',
    'calendar.default_search_from': 'Default search — from',
    'calendar.default_search_to': 'Default search — to',
    'calendar.default_adults': 'Default adults',
    'calendar.horizon_months': 'Booking horizon',
    'locale.default': 'Locale',
    'locale.live': 'Live locales',
    'locale.currency': 'Currency',
    'fees.show_in_price_panel': 'Show fees in price panel',
    'fees.footnote': 'Fee footnote',
    'copy.book_now_pay_later': 'Note — Book now, pay later',
    'copy.traveling_with_children': 'Note — Traveling with children',
    'copy.solo_and_triple': 'Note — Solo & triple',
    'copy.pay_today': 'Pay-today box',
    'copy.details_note': 'Details-page note',
    'copy.confirmation_steps': 'Confirmation steps'
  }
}

export function useEngineSettingsDraft(): ComputedRef<EngineSettingsDraft> {
  const injected = inject(ENGINE_SETTINGS_DRAFT_KEY)

  if (injected === undefined) {
    throw new Error('Engine settings panel requires a provided draft')
  }

  return computed(() => {
    const value = injected.value

    if (value === null) {
      throw new Error('Engine settings panel requires a draft')
    }

    return value
  })
}
