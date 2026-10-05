<script setup lang="ts">
import type {
  DepartureKpis,
  DepartureListItem,
  DepartureStatus,
  Itinerary,
  Paginated,
  RatesVersion,
  Yacht
} from '../../../types/api'
import { firstApiMessage } from '../../../utils/apiForm'
import {
  DEPARTURE_STATUSES,
  invBarWidths,
  itineraryWarningKey,
  labelToneClass,
  revertStatus,
  statusLabelKey
} from '../../../components/departures/departureHelpers'
import DateRangeFilter from '../../../components/lists/DateRangeFilter.vue'
import DepartureEditor from '../../../components/departures/DepartureEditor.vue'
import GenerateSeasonDrawer from '../../../components/departures/GenerateSeasonDrawer.vue'

type DeparturesPage = Paginated<DepartureListItem> & {
  meta: Paginated<DepartureListItem>['meta'] & {
    kpis: DepartureKpis
  }
}

const emptyKpis: DepartureKpis = {
  on_sale_on_engine: 0,
  cabins_bookable: 0,
  showing_only_n_left: 0,
  full: 0
}

const { can, user } = useAuth()
const { t } = useI18n()
const { useFetch, request } = useApi()
const { format } = useDates()
const { format: money } = useMoney()
const toast = useToast()

const from = ref<string | null>(null)
const to = ref<string | null>(null)
const yachtFilter = ref('ALL')
const editorOpen = ref(false)
const seasonOpen = ref(false)
const selectedId = ref<number | null>(null)
const today = computed(() => format(new Date(), 'iso'))

const canManage = computed(() => can('departures.manage'))
const roleName = computed(() => user.value?.role.name ?? '')

const { data: yachtsPayload } = useFetch<{ data: Array<Yacht> }>('/api/rms/yachts')
const { data: itinerariesPayload } = useFetch<{ data: Array<Itinerary> }>('/api/rms/itineraries')
const { data: rates } = useFetch<RatesVersion>('/api/rms/rates')

const yachts = computed(() => yachtsPayload.value?.data ?? [])
const itineraries = computed(() => itinerariesPayload.value?.data ?? [])
const festiveSupplementPp = computed(() => rates.value?.document.rules.festive_supplement_pp ?? 0)

const yachtId = computed(() => {
  if (yachtFilter.value === 'ALL') {
    return undefined
  }

  return yachts.value.find(yacht => yacht.code === yachtFilter.value)?.id
})

const listUrl = computed(() => {
  const params = new URLSearchParams({ per_page: '500' })

  if (from.value !== null) {
    params.set('from', from.value)
  }

  if (to.value !== null) {
    params.set('to', to.value)
  }

  if (yachtId.value !== undefined) {
    params.set('yacht_id', String(yachtId.value))
  }

  return `/api/rms/departures?${params.toString()}`
})

const { data: listPayload, refresh } = useFetch<DeparturesPage>(listUrl)

const departures = computed(() => listPayload.value?.data ?? [])
const total = computed(() => listPayload.value?.meta.total ?? 0)
const kpis = computed(() => listPayload.value?.meta.kpis ?? emptyKpis)

const latestDate = computed(() => {
  return departures.value.reduce<string | null>((latest, row) => {
    if (latest === null || row.date > latest) {
      return row.date
    }

    return latest
  }, null)
})

function openNew(): void {
  selectedId.value = null
  editorOpen.value = true
}

function openExisting(row: DepartureListItem): void {
  selectedId.value = row.id
  editorOpen.value = true
}

async function onStatusChange(row: DepartureListItem, value: string | number | null | undefined): Promise<void> {
  if (typeof value !== 'string') {
    return
  }

  const previous = row.status
  const next = value as DepartureStatus

  if (next === previous) {
    return
  }

  row.status = next

  try {
    await request(`/api/rms/departures/${row.id}`, {
      method: 'PATCH',
      body: { status: next }
    })
    toast.add({ title: t('departures.statusSaved') })
    await refresh()
  } catch (error) {
    row.status = revertStatus(previous, next, false)
    toast.add({
      title: firstApiMessage(error) ?? (error instanceof Error ? error.message : t('departures.statusSaved'))
    })
  }
}

const statusItems = computed(() => DEPARTURE_STATUSES.map(status => ({
  label: t(statusLabelKey(status)),
  value: status
})))

function ratesLine(row: DepartureListItem): string {
  if (row.rates.suite_from === null) {
    return t('departures.ratesMissing', { year: String(row.rates.year) })
  }

  return t('departures.ratesFrom', {
    year: String(row.rates.year),
    amount: money(row.rates.suite_from)
  })
}

function rowNote(row: DepartureListItem): string {
  return row.public_note ? `${row.reference} · ${row.public_note}` : row.reference
}

function inventoryParts(row: DepartureListItem): string {
  const counts = row.availability.counts
  const parts = [
    t('departures.invSold', { n: String(counts.sold) }),
    t('departures.invHeld', { n: String(counts.held) })
  ]

  if (counts.blocked > 0) {
    parts.push(t('departures.invBlocked', { n: String(counts.blocked) }))
  }

  return parts.join(' · ')
}

function itineraryWarning(status: string): string | null {
  const key = itineraryWarningKey(status)

  return key === null ? null : t(key)
}
</script>

<template>
  <div>
    <p class="notice dep-notice">
      {{ t('departures.retired') }}
    </p>
    <p class="notice dep-notice">
      {{ t('departures.noticeBefore') }}<b>{{ t('departures.noticeItinerary') }}</b>{{ t('departures.noticeMid') }}<b>{{ t('departures.noticeOnSale') }}</b>{{ t('departures.noticeGuest') }}<b>{{ t('departures.noticeInventory') }}</b>{{ t('departures.noticeAfter') }}
    </p>

    <DateRangeFilter
      v-model:from="from"
      v-model:to="to"
      :field-label="t('departures.fieldLabel')"
      :noun="t('departures.noun')"
      :total="total"
      :today="today"
    />

    <div class="krow">
      <AnkKpi
        :label="t('departures.kpiOnSale')"
        :sub="t('departures.kpiOnSaleSub', { n: String(departures.length) })"
      >
        {{ kpis.on_sale_on_engine }}
      </AnkKpi>
      <AnkKpi
        :label="t('departures.kpiBookable')"
        :sub="t('departures.kpiBookableSub')"
      >
        {{ kpis.cabins_bookable }}
      </AnkKpi>
      <AnkKpi
        :label="t('departures.kpiOnlyN')"
        :sub="t('departures.kpiOnlyNSub')"
      >
        <span class="dep-kpi-warn">{{ kpis.showing_only_n_left }}</span>
      </AnkKpi>
      <AnkKpi
        :label="t('departures.kpiFull')"
        :sub="t('departures.kpiFullSub')"
      >
        <span class="dep-kpi-full">{{ kpis.full }}</span>
      </AnkKpi>
    </div>

    <div class="panel">
      <h3>{{ t('departures.panelTitle') }}</h3>
      <div class="ebtool dep-toolbar">
        <div class="fchips">
          <button
            type="button"
            class="fchip"
            :class="{ on: yachtFilter === 'ALL' }"
            @click="yachtFilter = 'ALL'"
          >
            {{ t('departures.allYachts') }}
          </button>
          <button
            v-for="yacht in yachts"
            :key="yacht.id"
            type="button"
            class="fchip"
            :class="{ on: yachtFilter === yacht.code }"
            @click="yachtFilter = yacht.code"
          >
            {{ yacht.code }}
          </button>
        </div>
        <div
          v-if="canManage"
          class="acts"
        >
          <UButton
            variant="outline"
            @click="seasonOpen = true"
          >
            {{ t('departures.generate') }}
          </UButton>
          <UButton @click="openNew">
            {{ t('departures.new') }}
          </UButton>
        </div>
      </div>
      <div class="dep-table-wrap">
        <table class="list">
          <thead>
            <tr>
              <th>{{ t('departures.colDeparture') }}</th>
              <th>{{ t('departures.colYacht') }}</th>
              <th>{{ t('departures.colItinerary') }}</th>
              <th>{{ t('departures.colRates') }}</th>
              <th>{{ t('departures.colInventory') }}</th>
              <th>{{ t('departures.colEngine') }}</th>
              <th>{{ t('departures.colStatus') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-if="departures.length === 0"
              class="dr-empty"
            >
              <td colspan="7">
                {{ t('departures.empty') }}
              </td>
            </tr>
            <tr
              v-for="row in departures"
              :key="row.id"
              class="dep-row"
              @click="openExisting(row)"
            >
              <td>
                <span class="nw dep-dates">
                  <b>{{ format(row.date, 'short') }}</b> → {{ format(row.return_date, 'short') }}
                </span>
                <br>
                <span class="mono dep-sub">{{ rowNote(row) }}</span>
              </td>
              <td class="nw">
                {{ row.yacht.name }}
              </td>
              <td>
                {{ row.itinerary.name }}
                <template v-if="itineraryWarning(row.itinerary.status)">
                  <br>
                  <span class="mono dep-itin-warn">{{ itineraryWarning(row.itinerary.status) }}</span>
                </template>
              </td>
              <td>
                <span :class="{ 'dep-rates-missing': row.rates.suite_from === null }">
                  {{ ratesLine(row) }}
                </span>
                <template v-if="row.festive">
                  <br>
                  <span class="pill p-canc dep-festive">{{ t('departures.festivePill', { amount: money(festiveSupplementPp) }) }}</span>
                </template>
              </td>
              <td>
                <div class="invbar">
                  <i
                    :style="{ width: invBarWidths(row.availability.counts).sold, background: 'var(--ok)' }"
                  />
                  <i
                    :style="{ width: invBarWidths(row.availability.counts).held, background: 'var(--warn)' }"
                  />
                  <i
                    :style="{ width: invBarWidths(row.availability.counts).blocked, background: 'var(--olive)' }"
                  />
                </div>
                <div class="invtxt">
                  {{ inventoryParts(row) }} · <b>{{ t('departures.invFree', { n: String(row.availability.counts.free) }) }}</b>
                </div>
              </td>
              <td>
                <span
                  class="pill"
                  :class="labelToneClass(row.availability.engine_label.tone)"
                >{{ row.availability.engine_label.text }}</span>
              </td>
              <td>
                <USelect
                  size="sm"
                  :model-value="row.status"
                  :items="statusItems"
                  :disabled="!canManage"
                  @click.stop
                  @update:model-value="onStatusChange(row, $event)"
                />
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <DepartureEditor
      v-model:open="editorOpen"
      :source-id="selectedId"
      :yachts="yachts"
      :itineraries="itineraries"
      :can-manage="canManage"
      :role-name="roleName"
      :festive-supplement-pp="festiveSupplementPp"
      @saved="() => refresh()"
      @deleted="() => refresh()"
    />

    <GenerateSeasonDrawer
      v-model:open="seasonOpen"
      :yachts="yachts"
      :latest-date="latestDate"
      :today="today"
      @generated="refresh"
    />
  </div>
</template>
