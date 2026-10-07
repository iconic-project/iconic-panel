<script setup lang="ts">
import type {
  ActivityEvent,
  ActivityKpis,
  EventCatalogueRow,
  Paginated
} from '../../../types/api'
import {
  isAnonymousContact,
  sideTokens,
  systemBadgeClass
} from '../../../components/crm/syncHelpers'

type ActivityPayload = Paginated<ActivityEvent> & {
  meta: Paginated<ActivityEvent>['meta'] & {
    kpis: ActivityKpis
  }
}

const emptyKpis: ActivityKpis = {
  events_today: 0,
  identified: 0,
  anonymous: 0,
  inventory_touching: 0,
  web_hold_minutes: 0,
  web_hold_extension_minutes: 0
}

const { t } = useI18n()
const { useFetch } = useApi()
const { format } = useDates()
const config = useRuntimeConfig()

const FILTER_ALL = 'all'

const nameFilter = ref(FILTER_ALL)
const identifiedFilter = ref(FILTER_ALL)
const page = ref(1)
const eventNames = ref<Array<string>>([])

const nameItems = computed(() => [
  { label: t('crmActivity.filterEvent'), value: FILTER_ALL },
  ...eventNames.value.map(name => ({ label: name, value: name }))
])

const identifiedItems = computed(() => [
  { label: t('crmActivity.filterIdentified'), value: FILTER_ALL },
  { label: t('crmActivity.identifiedYes'), value: '1' },
  { label: t('crmActivity.identifiedNo'), value: '0' }
])

watch([nameFilter, identifiedFilter], () => {
  page.value = 1
})

const listUrl = computed(() => {
  const params = new URLSearchParams({
    page: String(page.value),
    per_page: '50'
  })

  if (nameFilter.value !== FILTER_ALL) {
    params.set('name', nameFilter.value)
  }

  if (identifiedFilter.value === '1' || identifiedFilter.value === '0') {
    params.set('identified', identifiedFilter.value)
  }

  return `/api/crm/activity?${params.toString()}`
})

const { data: listPayload } = useFetch<ActivityPayload>(listUrl)

const rows = computed(() => listPayload.value?.data ?? [])
const meta = computed(() => listPayload.value?.meta)
const kpis = computed(() => listPayload.value?.meta.kpis ?? emptyKpis)
const showEventFilter = computed(() => eventNames.value.length > 0)

onMounted(async () => {
  try {
    const result = await $fetch<{ data: Array<EventCatalogueRow> }>('/api/crm/sync/events', {
      credentials: 'include',
      baseURL: String(config.public.apiBase)
    })
    eventNames.value = result.data
      .filter(row => row.family === 'behavioural')
      .map(row => row.name)
  } catch {
    eventNames.value = []
  }
})

async function openContact(row: ActivityEvent): Promise<void> {
  if (row.contact_id === null || isAnonymousContact(row.contact)) {
    return
  }

  await navigateTo({
    path: '/crm/sales/contacts',
    query: { open: String(row.contact_id) }
  })
}
</script>

<template>
  <div>
    <div class="krow">
      <AnkKpi
        :label="t('crmActivity.kpiEventsToday')"
        :sub="t('crmActivity.kpiEventsTodaySub')"
      >
        {{ kpis.events_today }}
      </AnkKpi>
      <AnkKpi
        :label="t('crmActivity.kpiIdentified')"
        :sub="t('crmActivity.kpiIdentifiedSub')"
      >
        {{ kpis.identified }}
      </AnkKpi>
      <AnkKpi
        :label="t('crmActivity.kpiAnonymous')"
        :sub="t('crmActivity.kpiAnonymousSub')"
      >
        {{ kpis.anonymous }}
      </AnkKpi>
      <AnkKpi
        :label="t('crmActivity.kpiInventory')"
        :sub="t('crmActivity.kpiInventorySub')"
      >
        {{ kpis.inventory_touching }}
      </AnkKpi>
      <AnkKpi
        :label="t('crmActivity.kpiWebHold')"
        :sub="t('crmActivity.kpiWebHoldSub', { minutes: String(kpis.web_hold_extension_minutes) })"
      >
        {{ t('crmActivity.kpiWebHoldValue', { minutes: String(kpis.web_hold_minutes) }) }}
      </AnkKpi>
    </div>

    <div class="panel">
      <h3>{{ t('crmActivity.streamTitle') }}</h3>
      <div class="crm-filters">
        <USelect
          v-if="showEventFilter"
          v-model="nameFilter"
          size="sm"
          :items="nameItems"
        />
        <USelect
          v-model="identifiedFilter"
          size="sm"
          :items="identifiedItems"
        />
      </div>
      <div class="bk-table-wrap">
        <table class="list">
          <thead>
            <tr>
              <th class="nw">
                {{ t('crmActivity.colWhen') }}
              </th>
              <th class="nw">
                {{ t('crmActivity.colEvent') }}
              </th>
              <th class="nw">
                {{ t('crmActivity.colContact') }}
              </th>
              <th>{{ t('crmActivity.colDetail') }}</th>
              <th class="nw">
                {{ t('crmActivity.colSide') }}
              </th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-if="rows.length === 0"
              class="dr-empty"
            >
              <td colspan="5">
                {{ t('crmActivity.empty') }}
              </td>
            </tr>
            <tr
              v-for="row in rows"
              :key="`${row.at}-${row.name}-${row.contact}`"
            >
              <td class="nw">
                {{ format(row.at, 'dateTime') }}
              </td>
              <td class="nw crm-event">
                {{ row.name }}
              </td>
              <td class="nw">
                <button
                  v-if="row.contact_id !== null && !isAnonymousContact(row.contact)"
                  type="button"
                  class="lnk"
                  @click="openContact(row)"
                >
                  {{ row.contact }}
                </button>
                <template v-else>
                  {{ row.contact }}
                </template>
              </td>
              <td>{{ row.detail }}</td>
              <td class="nw">
                <div class="crm-side">
                  <span
                    v-for="token in sideTokens(row.side)"
                    :key="token"
                    class="sysbadge"
                    :class="systemBadgeClass(token)"
                  >{{ token }}</span>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div
        v-if="meta && meta.last_page > 1"
        class="list-pager"
      >
        <button
          type="button"
          :disabled="meta.current_page <= 1"
          @click="page -= 1"
        >
          {{ t('bookings.previous') }}
        </button>
        <span>{{ t('bookings.pager', { from: String(meta.from ?? 0), to: String(meta.to ?? 0), total: String(meta.total) }) }}</span>
        <button
          type="button"
          :disabled="meta.current_page >= meta.last_page"
          @click="page += 1"
        >
          {{ t('bookings.next') }}
        </button>
      </div>
    </div>
  </div>
</template>
