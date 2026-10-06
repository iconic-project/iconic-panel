import type { ComputedRef, InjectionKey } from 'vue'
import type { EngineSettingsDocument } from '../../types/api'

export type EngineSettingsDraft = {
  guests: {
    max_per_cabin: number | null
    max_per_yacht: number | null
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
    tct_pp: number | null
    png: {
      foreign_over_12: number | null
      foreign_12_and_under: number | null
      can_adult: number | null
      can_minor: number | null
      national_or_resident: number | null
      exempt_under_age: number | null
    }
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
    'guests.max_per_cabin': 'Max guests per cabin',
    'guests.max_per_yacht': 'Max guests per yacht',
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
    'fees.tct_pp': 'TCT transit card',
    'fees.png.foreign_over_12': 'PNG fee — foreign visitor over 12',
    'fees.png.foreign_12_and_under': 'PNG fee — foreign visitor 12 and under',
    'fees.png.can_adult': 'PNG fee — CAN adult',
    'fees.png.can_minor': 'PNG fee — CAN minor',
    'fees.png.national_or_resident': 'PNG fee — national or resident',
    'fees.png.exempt_under_age': 'PNG fee — exempt under age',
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
