<script setup lang="ts">
import type {
  AgencyListItem,
  BusinessRulesVersion,
  ChannelOfOriginGroup,
  CommercialMetrics,
  HotelKpis,
  MetricDefinition
} from '../../../types/api'
import DateRangeFilter from '../../../components/lists/DateRangeFilter.vue'
import { calendarYear, resolveDateRange } from '../../../components/lists/dateRange'
import {
  occupancyBarWidth,
  occupancyIsLow,
  ratioPercentLabel,
  SELECT_ALL,
  selectedId,
  withSelectAll
} from '../../../components/commercial/dashboardHelpers'
import { firstApiMessage } from '../../../utils/apiForm'

const CHANNELS: Array<ChannelOfOriginGroup> = [
  'Direct',
  'Marketing',
  'Trade, corporate & groups',
  'Distribution, partners & other'
]

const FILTER_DEBOUNCE_MS = 300

const { can } = useAuth()
const { t } = useI18n()
const { useFetch, request } = useApi()
const { format } = useDates()
const { format: money } = useMoney()

const today = computed(() => format(new Date(), 'iso'))
const yearWindow = resolveDateRange(`y${calendarYear(today.value)}`, today.value)
const from = ref<string | null>(yearWindow.from)
const to = ref<string | null>(yearWindow.to)
const channel = ref(SELECT_ALL)
const agencyId = ref(SELECT_ALL)

const metrics = ref<CommercialMetrics | null>(null)
const hotel = ref<HotelKpis | null>(null)
const loadError = ref('')

const { data: agenciesPayload } = useFetch<{ data: Array<AgencyListItem> }>('/api/rms/agencies')
const { data: rulesPayload } = useFetch<BusinessRulesVersion>('/api/rms/business-rules', {
  immediate: can('rules.view')
})

const agencies = computed(() => agenciesPayload.value?.data ?? [])
const lowOccupancyPct = computed(() => rulesPayload.value?.document.alerts.low_occupancy_pct ?? null)
const stayCount = computed(() => metrics.value?.metrics.occupancy.stays.length ?? 0)
const hasWindow = computed(() => from.value !== null && to.value !== null)

const channelItems = computed(() => withSelectAll(
  t('dashboard.allChannels'),
  CHANNELS.map(group => ({
    label: group,
    value: group
  }))
))

const agencyItems = computed(() => withSelectAll(
  t('dashboard.allAgencies'),
  agencies.value.map(agency => ({
    label: agency.name,
    value: String(agency.id)
  }))
))

let filterTimer: ReturnType<typeof setTimeout> | undefined

watch([from, to, channel, agencyId], () => {
  metrics.value = null
  clearTimeout(filterTimer)
  filterTimer = setTimeout(() => {
    void loadMetrics()
  }, FILTER_DEBOUNCE_MS)
}, { immediate: true })

onUnmounted(() => {
  clearTimeout(filterTimer)
})

function definitionLine(definition: MetricDefinition): string {
  return t('dashboard.definition', {
    sentence: definition.sentence,
    filters: definition.filters_on,
    excludes: definition.excludes
  })
}

function hotelPercent(value: string | null): string {
  if (value === null) {
    return t('dashboard.dash')
  }

  return `${value}%`
}

function periodLabel(key: string): string {
  if (key === 'this_month') {
    return t('dashboard.thisMonth')
  }

  if (key === 'next_30') {
    return t('dashboard.next30')
  }

  return t('dashboard.next90')
}

function percentOrDash(ratio: string | null): string {
  return ratioPercentLabel(ratio) ?? t('dashboard.dash')
}

function moneyOrDash(value: number | null): string {
  if (value === null) {
    return t('dashboard.dash')
  }

  return money(value)
}

function daysOrDash(value: string | null): string {
  if (value === null) {
    return t('dashboard.dash')
  }

  return t('dashboard.kpiLeadDays', { days: value })
}

function shareOrDash(value: number | null): string {
  if (value === null || value === 0) {
    return t('dashboard.dash')
  }

  return `${String(value)}%`
}

function barColor(ratio: string | null): string {
  return occupancyIsLow(ratio, lowOccupancyPct.value) ? 'var(--coral)' : 'var(--sand)'
}

type HotelCard = {
  occupancy: string | null
  adr: number | null
  revpar: number | null
}

type HotelPeriod = {
  key: string
  kpis: HotelCard
  last_year: HotelCard | null
}

function readCard(value: unknown): HotelCard {
  if (value === null || typeof value !== 'object') {
    return { occupancy: null, adr: null, revpar: null }
  }

  const card = value as Record<string, unknown>

  return {
    occupancy: typeof card.occupancy === 'string' ? card.occupancy : null,
    adr: typeof card.adr === 'number' ? card.adr : null,
    revpar: typeof card.revpar === 'number' ? card.revpar : null
  }
}

function readPeriods(source: HotelKpis | null): Array<HotelPeriod> {
  if (source === null) {
    return []
  }

  return source.periods.flatMap((row) => {
    if (typeof row.key !== 'string') {
      return []
    }

    const lastYear = row.last_year

    return [{
      key: row.key,
      kpis: readCard(row.kpis),
      last_year: lastYear === null || lastYear === undefined ? null : readCard(lastYear)
    }]
  })
}

const hotelPeriods = computed(() => readPeriods(hotel.value))

async function loadMetrics(): Promise<void> {
  if (from.value === null || to.value === null) {
    metrics.value = null
    hotel.value = null
    loadError.value = ''
    return
  }

  const params = new URLSearchParams({
    from: from.value,
    to: to.value
  })

  const agency = selectedId(agencyId.value)

  if (channel.value !== SELECT_ALL) {
    params.set('channel', channel.value)
  }

  if (agency !== null) {
    params.set('agency', String(agency))
  }

  try {
    const hotelParams = new URLSearchParams()

    if (channel.value !== SELECT_ALL) {
      hotelParams.set('channel', channel.value)
    }

    const hotelQuery = hotelParams.size > 0 ? `?${hotelParams.toString()}` : ''
    const [metricsPayload, hotelPayload] = await Promise.all([
      request(`/api/rms/metrics?${params.toString()}`) as Promise<CommercialMetrics>,
      request(`/api/rms/hotel-kpis${hotelQuery}`) as Promise<HotelKpis>
    ])

    metrics.value = metricsPayload
    hotel.value = hotelPayload
    loadError.value = ''
  } catch (error: unknown) {
    metrics.value = null
    hotel.value = null
    loadError.value = firstApiMessage(error) ?? t('dashboard.loadError')
  }
}
</script>

<template>
  <div>
    <DateRangeFilter
      v-model:from="from"
      v-model:to="to"
      :field-label="t('dashboard.fieldLabel')"
      :noun="t('dashboard.noun')"
      :total="stayCount"
      :today="today"
    />

    <div class="drbar">
      <div class="drl">
        <span class="mono">{{ t('dashboard.filtersLabel') }}</span>
      </div>
      <USelect
        v-model="channel"
        size="sm"
        :items="channelItems"
        :aria-label="t('dashboard.allChannels')"
      />
      <USelect
        v-model="agencyId"
        size="sm"
        :items="agencyItems"
        :aria-label="t('dashboard.allAgencies')"
      />
    </div>

    <p
      v-if="loadError !== ''"
      class="notice"
    >
      {{ loadError }}
    </p>
    <p
      v-else-if="!hasWindow"
      class="notice"
    >
      {{ t('dashboard.windowEmpty') }}
    </p>

    <template v-else-if="metrics">
      <div class="krow">
        <AnkKpi :label="t('dashboard.kpiOccupancy')">
          {{ hotelPercent(hotelPeriods[0]?.kpis.occupancy ?? null) }}
        </AnkKpi>
        <AnkKpi :label="t('dashboard.kpiAdr')">
          {{ moneyOrDash(hotelPeriods[0]?.kpis.adr ?? null) }}
        </AnkKpi>
        <AnkKpi :label="t('dashboard.kpiRevpar')">
          {{ moneyOrDash(hotelPeriods[0]?.kpis.revpar ?? null) }}
        </AnkKpi>
        <AnkKpi
          :label="t('dashboard.kpiLead')"
          :sub="definitionLine(metrics.metrics.lead_time.definition)"
        >
          {{ daysOrDash(metrics.metrics.lead_time.average_days) }}
        </AnkKpi>
        <AnkKpi
          :label="t('dashboard.kpiNps')"
          :sub="definitionLine(metrics.metrics.nps.definition)"
        >
          {{ metrics.metrics.nps.average_score ?? t('dashboard.dash') }}
        </AnkKpi>
        <AnkKpi
          :label="t('dashboard.kpiCommissions')"
          :sub="definitionLine(metrics.metrics.commissions.definition)"
        >
          {{ money(metrics.metrics.commissions.payable) }}
        </AnkKpi>
      </div>

      <div class="panel">
        <h3>{{ t('dashboard.hotelKpis') }}</h3>
        <div class="bk-table-wrap">
          <table class="list">
            <thead>
              <tr>
                <th>{{ t('dashboard.period') }}</th>
                <th>{{ t('dashboard.onTheBooks') }} {{ t('dashboard.kpiOccupancy') }}</th>
                <th>{{ t('dashboard.onTheBooks') }} {{ t('dashboard.kpiAdr') }}</th>
                <th>{{ t('dashboard.onTheBooks') }} {{ t('dashboard.kpiRevpar') }}</th>
                <th>{{ t('dashboard.lastYear') }} {{ t('dashboard.kpiOccupancy') }}</th>
                <th>{{ t('dashboard.lastYear') }} {{ t('dashboard.kpiAdr') }}</th>
                <th>{{ t('dashboard.lastYear') }} {{ t('dashboard.kpiRevpar') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="period in hotelPeriods"
                :key="period.key"
              >
                <td>{{ periodLabel(period.key) }}</td>
                <td>{{ hotelPercent(period.kpis.occupancy) }}</td>
                <td>{{ moneyOrDash(period.kpis.adr) }}</td>
                <td>{{ moneyOrDash(period.kpis.revpar) }}</td>
                <td>{{ hotelPercent(period.last_year?.occupancy ?? null) }}</td>
                <td>{{ moneyOrDash(period.last_year?.adr ?? null) }}</td>
                <td>{{ moneyOrDash(period.last_year?.revpar ?? null) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div class="panel">
        <h3>{{ t('dashboard.cashTitle') }}</h3>
        <p class="mono dash-def">
          {{ definitionLine(metrics.metrics.cash.definition) }}
        </p>
        <div class="krow">
          <AnkKpi :label="t('dashboard.kpiCollected')">
            {{ money(metrics.metrics.cash.collected) }}
          </AnkKpi>
          <AnkKpi :label="t('dashboard.kpiPending')">
            {{ money(metrics.metrics.cash.pending) }}
          </AnkKpi>
          <AnkKpi :label="t('dashboard.kpiOverdue')">
            <span class="pay-kpi-coral">{{ money(metrics.metrics.cash.overdue) }}</span>
          </AnkKpi>
          <AnkKpi :label="t('dashboard.kpiDepositShare')">
            {{ shareOrDash(metrics.metrics.cash.deposit_share_pct) }}
          </AnkKpi>
        </div>
      </div>

      <div class="panel">
        <h3>{{ t('dashboard.occupancyTitle') }}</h3>
        <div class="bk-table-wrap">
          <table class="list">
            <thead>
              <tr>
                <th>{{ t('dashboard.colDate') }}</th>
                <th>{{ t('blocks.property') }}</th>
                <th>{{ t('dashboard.colSold') }}</th>
                <th>{{ t('dashboard.colSellable') }}</th>
                <th>{{ t('dashboard.colOccupancy') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-if="metrics.metrics.occupancy.stays.length === 0"
                class="dr-empty"
              >
                <td colspan="5">
                  {{ t('dashboard.occupancyEmpty') }}
                </td>
              </tr>
              <tr
                v-for="row in metrics.metrics.occupancy.stays"
                :key="row.id"
              >
                <td>
                  <NuxtLink :to="'/rms/reservations/calendar'">
                    {{ format(row.date, 'short') }}
                  </NuxtLink>
                </td>
                <td>{{ row.property_code }}</td>
                <td>{{ row.sold_berths }}</td>
                <td>{{ row.sellable_berths }}</td>
                <td>
                  <div class="dash-occ">
                    <div class="cmp">
                      <i :style="{ width: occupancyBarWidth(row.occupancy), background: barColor(row.occupancy) }" />
                    </div>
                    <span :class="{ 'pay-kpi-coral': occupancyIsLow(row.occupancy, lowOccupancyPct) }">
                      {{ percentOrDash(row.occupancy) }}
                    </span>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div class="panel">
        <h3>{{ t('dashboard.channelTitle') }}</h3>
        <p class="mono dash-def">
          {{ definitionLine(metrics.metrics.channel_mix.definition) }}
        </p>
        <div class="bk-table-wrap">
          <table class="list">
            <thead>
              <tr>
                <th>{{ t('dashboard.colChannel') }}</th>
                <th>{{ t('dashboard.colBookings') }}</th>
                <th>{{ t('dashboard.colRevenue') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-if="metrics.metrics.channel_mix.rows.length === 0"
                class="dr-empty"
              >
                <td colspan="3">
                  {{ t('dashboard.channelEmpty') }}
                </td>
              </tr>
              <tr
                v-for="row in metrics.metrics.channel_mix.rows"
                :key="row.channel"
              >
                <td>{{ row.channel }}</td>
                <td>{{ row.bookings }}</td>
                <td>{{ money(row.revenue) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div class="panel">
        <h3>{{ t('dashboard.nationalityTitle') }}</h3>
        <p class="mono dash-def">
          {{ definitionLine(metrics.metrics.nationality_mix.definition) }}
        </p>
        <div class="bk-table-wrap">
          <table class="list">
            <thead>
              <tr>
                <th>{{ t('dashboard.colCountry') }}</th>
                <th>{{ t('dashboard.colGuests') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-if="metrics.metrics.nationality_mix.rows.length === 0 && metrics.metrics.nationality_mix.unknown === 0"
                class="dr-empty"
              >
                <td colspan="2">
                  {{ t('dashboard.nationalityEmpty') }}
                </td>
              </tr>
              <tr
                v-for="row in metrics.metrics.nationality_mix.rows"
                :key="row.country_code"
              >
                <td>{{ row.country_code }}</td>
                <td>{{ row.guests }}</td>
              </tr>
              <tr v-if="metrics.metrics.nationality_mix.unknown > 0">
                <td>{{ t('dashboard.unknownCountry') }}</td>
                <td>{{ metrics.metrics.nationality_mix.unknown }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div class="panel">
        <h3>{{ t('dashboard.npsTitle') }}</h3>
        <div class="krow">
          <AnkKpi :label="t('dashboard.npsAverage')">
            {{ metrics.metrics.nps.average_score ?? t('dashboard.dash') }}
          </AnkKpi>
          <AnkKpi :label="t('dashboard.npsPromoters')">
            {{ metrics.metrics.nps.promoters }}
          </AnkKpi>
          <AnkKpi :label="t('dashboard.npsPassives')">
            {{ metrics.metrics.nps.passives }}
          </AnkKpi>
          <AnkKpi :label="t('dashboard.npsDetractors')">
            {{ metrics.metrics.nps.detractors }}
          </AnkKpi>
          <AnkKpi :label="t('dashboard.npsResponses')">
            {{ metrics.metrics.nps.responses }}
          </AnkKpi>
        </div>
      </div>
    </template>
  </div>
</template>
