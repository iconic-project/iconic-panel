import { computed, inject, type ComputedRef, type InjectionKey } from 'vue'

export type SeasonDraft = {
  code: string
  name: string
  from: string
  to: string
}

export type RoomRateDraft = {
  room_type: string
  season: string
  nightly: number
}

export type OccupancyDraft = {
  extra_adult_nightly: number | null
  extra_child_nightly: number | null
  single_occupancy_pct: number | null
}

export type WeekdayKey = '1' | '2' | '3' | '4' | '5' | '6' | '7'

export type LengthDraft = {
  min_nights: number | null
  discount_pct: number | null
}

export type SupplementBasis = 'ROOM' | 'PERSON'

export type SupplementDraft = {
  code: string
  label: string
  from: string
  to: string
  per_night: number | null
  basis: SupplementBasis
}

export type MealPlanCode = 'RO' | 'BB' | 'HB' | 'FB'

export type PlanDraft = {
  code: string
  name: string
  default: boolean
  adjust_pct: number | null
  refundable: boolean
  deposit_pct: number | null
  balance_days: number | null
  cancellation: string
  meal_plan: MealPlanCode
}

export type RatesDraft = {
  currency: string
  seasons: Array<SeasonDraft>
  room_rates: Array<RoomRateDraft>
  occupancy: OccupancyDraft
  day_of_week: Record<WeekdayKey, number | null>
  length_of_stay: Array<LengthDraft>
  supplements: Array<SupplementDraft>
  rate_plans: Array<PlanDraft>
}

export const RATES_DRAFT_KEY: InjectionKey<ComputedRef<RatesDraft | null>> = Symbol('ratesDraft')

export function useRatesDraft(caller: string): ComputedRef<RatesDraft> {
  const injected = inject(RATES_DRAFT_KEY)

  if (injected === undefined) {
    throw new Error(`${caller} requires a provided rates draft`)
  }

  return computed(() => {
    const value = injected.value

    if (value === null) {
      throw new Error(`${caller} requires a rates draft`)
    }

    return value
  })
}

export const RATE_FIELD_LABELS: Record<string, string> = {
  currency: 'Currency'
}

export function rateFieldLabels(_draft: RatesDraft): Record<string, string> {
  return { ...RATE_FIELD_LABELS }
}
