import type { PriceCheckQuote, PriceCheckRow, StayQuote, StayTaxLine } from '../../types/api'
import type { RoomRateDraft, SeasonDraft, WeekdayKey } from './rateHelpers'

export const WEEKDAYS: Array<WeekdayKey> = ['1', '2', '3', '4', '5', '6', '7']

export const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const

export type MonthCoverage = {
  month: number
  label: string
  nights: number
  covered: number
  gap: boolean
}

export type StayEditor = {
  key: string
  room_type: string
  check_in: string
  check_out: string
  adults: number | null
  child_ages: string
  rate_plan: string
}

export function monthCoverage(seasons: Array<Pick<SeasonDraft, 'from' | 'to'>>, year: number): Array<MonthCoverage> {
  return MONTH_LABELS.map((label, index) => {
    const month = index + 1
    const nights = new Date(Date.UTC(year, month, 0)).getUTCDate()
    let covered = 0

    for (let day = 1; day <= nights; day++) {
      const iso = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`

      if (seasons.some(season => season.from !== '' && season.to !== '' && season.from <= iso && iso <= season.to)) {
        covered += 1
      }
    }

    return {
      month,
      label,
      nights,
      covered,
      gap: covered === 0
    }
  })
}

export function seasonYears(seasons: Array<Pick<SeasonDraft, 'from' | 'to'>>, fallbackYear: number): Array<number> {
  const years = new Set<number>()

  for (const season of seasons) {
    const from = Number(season.from.slice(0, 4))
    const to = Number(season.to.slice(0, 4))

    if (!Number.isInteger(from) || !Number.isInteger(to) || to < from) {
      continue
    }

    for (let year = from; year <= to; year += 1) {
      years.add(year)
    }
  }

  if (years.size === 0) {
    years.add(fallbackYear)
  }

  return [...years].sort((left, right) => left - right)
}

export function withNightly(
  rates: Array<RoomRateDraft>,
  roomType: string,
  season: string,
  nightly: number | null
): Array<RoomRateDraft> {
  const index = rates.findIndex(rate => rate.room_type === roomType && rate.season === season)

  if (nightly === null) {
    return index === -1 ? rates : rates.filter((_, item) => item !== index)
  }

  if (index === -1) {
    return [...rates, { room_type: roomType, season, nightly }]
  }

  return rates.map((rate, item) => item === index ? { ...rate, nightly } : rate)
}

export function nightlyFor(rates: Array<RoomRateDraft>, roomType: string, season: string): number | null {
  return rates.find(rate => rate.room_type === roomType && rate.season === season)?.nightly ?? null
}

export function parseChildAges(value: string): Array<number> {
  if (value.trim() === '') {
    return []
  }

  return value
    .split(/[,\s]+/)
    .map(part => Number(part))
    .filter(age => Number.isInteger(age) && age >= 0)
}

export function nightsBetween(checkIn: string, checkOut: string): number | null {
  const start = Date.parse(`${checkIn}T00:00:00Z`)
  const end = Date.parse(`${checkOut}T00:00:00Z`)

  if (!Number.isFinite(start) || !Number.isFinite(end)) {
    return null
  }

  const nights = Math.round((end - start) / 86_400_000)

  return nights > 0 ? nights : null
}

export function stayEditorsFrom(rows: Array<PriceCheckRow>): Array<StayEditor> {
  return rows.map(row => ({
    key: row.key,
    room_type: row.input.room_type,
    check_in: row.input.check_in,
    check_out: row.input.check_out,
    adults: row.input.adults,
    child_ages: row.input.child_ages.join(', '),
    rate_plan: row.input.rate_plan
  }))
}

export function blankStay(index: number, roomType: string, plan: string): StayEditor {
  return {
    key: `stay-${index}`,
    room_type: roomType,
    check_in: '',
    check_out: '',
    adults: null,
    child_ages: '',
    rate_plan: plan
  }
}

export function stayRequests(stays: Array<StayEditor>): Array<{
  id: string
  room_type: string
  check_in: string
  nights: number
  adults: number
  child_ages: Array<number>
  rate_plan: string
}> {
  const requests = []

  for (const stay of stays) {
    const nights = nightsBetween(stay.check_in, stay.check_out)

    if (nights === null || stay.room_type === '' || stay.rate_plan === '' || stay.adults === null) {
      continue
    }

    requests.push({
      id: stay.key,
      room_type: stay.room_type,
      check_in: stay.check_in,
      nights,
      adults: stay.adults,
      child_ages: parseChildAges(stay.child_ages),
      rate_plan: stay.rate_plan
    })
  }

  return requests
}

export function isStayQuote(value: PriceCheckQuote): value is StayQuote {
  return 'night_lines' in value && 'total' in value
}

export function quoteMessages(value: PriceCheckQuote): Array<string> {
  if (isStayQuote(value)) {
    return []
  }

  if ('errors' in value) {
    return value.errors
  }

  return [value.reason]
}

export function shownTaxes(quote: StayQuote): Array<StayTaxLine> {
  return quote.tax_lines.filter(line => line.shown_in_price_panel)
}
