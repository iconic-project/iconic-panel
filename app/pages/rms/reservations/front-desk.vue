<script setup lang="ts">
import type { Booking } from '../../../types/api'
import BookingPanel from '../../../components/bookings/BookingPanel.vue'
import { statusText } from '../../../components/bookings/bookingHelpers'
import { downloadDocumentFile } from '../../../components/documents/documentFetch'
import {
  deskActionPath,
  nightAuditAlerts,
  type DeskTab
} from '../../../components/bookings/stayBooking'
import { firstApiMessage } from '../../../utils/apiForm'

type DeskAlert = {
  id: number
  kind: string
  title: string
  sentence: string
}

const TABS: Array<{ id: DeskTab, labelKey: string }> = [
  { id: 'arrivals', labelKey: 'frontDesk.arrivals' },
  { id: 'in_house', labelKey: 'frontDesk.inHouse' },
  { id: 'departures', labelKey: 'frontDesk.departures' }
]

const { t } = useI18n()
const { request, useFetch } = useApi()
const { format } = useDates()
const { format: money } = useMoney()

type FrontDeskLists = {
  date: string
  arrivals: Booking[]
  in_house: Booking[]
  departures: Booking[]
}

const date = ref(format(new Date(), 'iso'))
const tab = ref<DeskTab>('arrivals')
const panelOpen = ref(false)
const selected = ref<Booking | null>(null)
const actionError = ref('')
const exportFormat = ref<'csv' | 'pdf'>('csv')
const exporting = ref(false)

const listUrl = computed(() => `/api/rms/front-desk?date=${date.value}`)

const { data: lists, refresh } = await useFetch<FrontDeskLists>(listUrl)
const { data: alerts } = await useFetch<{ data: DeskAlert[] }>('/api/alerts?section=rms&state=open')

const rows = computed(() => lists.value?.[tab.value] ?? [])
const counts = computed(() => ({
  arrivals: lists.value?.arrivals.length ?? 0,
  in_house: lists.value?.in_house.length ?? 0,
  departures: lists.value?.departures.length ?? 0
}))
const audit = computed(() => nightAuditAlerts(alerts.value?.data ?? []))

function countOf(id: DeskTab): number {
  return counts.value[id]
}

function labelOf(status: string): string {
  return statusText(status, key => t(key))
}

function openBooking(row: Booking): void {
  selected.value = row
  panelOpen.value = true
}

function onUpdated(booking: Booking): void {
  selected.value = booking
  void refresh()
}

const exportFormats = computed(() => [
  { label: t('frontDesk.formatCsv'), value: 'csv' },
  { label: t('frontDesk.formatPdf'), value: 'pdf' }
])

async function exportRegistration(): Promise<void> {
  exporting.value = true
  actionError.value = ''

  try {
    await downloadDocumentFile(
      `/api/rms/front-desk/registration?date=${date.value}&format=${exportFormat.value}`,
      `registration-${date.value}.${exportFormat.value}`
    )
  } catch (caught: unknown) {
    actionError.value = caught instanceof Error ? caught.message : t('frontDesk.exportFailed')
  } finally {
    exporting.value = false
  }
}

async function checkIn(row: Booking, event: Event): Promise<void> {
  event.stopPropagation()
  actionError.value = ''

  try {
    await request(deskActionPath(row.id, 'check-in'), { method: 'POST', body: {} })
    await refresh()
  } catch (caught: unknown) {
    actionError.value = firstApiMessage(caught) ?? t('bookings.deskFailed')
  }
}
</script>

<template>
  <div>
    <div class="panel">
      <div class="bk-toolbar bk-head">
        <h3>{{ t('frontDesk.title') }}</h3>
      </div>
      <div
        v-if="audit.length > 0"
        class="warnbox"
      >
        <p>{{ t('frontDesk.nightAudit') }}</p>
        <ul>
          <li
            v-for="alert in audit"
            :key="alert.id"
          >
            {{ alert.title }}
          </li>
        </ul>
      </div>
      <p
        v-if="actionError"
        class="field-error"
      >
        {{ actionError }}
      </p>
      <div class="ebtool dep-toolbar bk-filter-bar">
        <div class="fchips">
          <button
            v-for="item in TABS"
            :key="item.id"
            type="button"
            class="fchip"
            :class="{ on: tab === item.id }"
            @click="tab = item.id"
          >
            {{ t(item.labelKey) }} {{ countOf(item.id) }}
          </button>
        </div>
        <div class="bk-desk-controls">
          <UInput
            v-model="date"
            type="date"
            class="bk-desk-date"
            :aria-label="t('frontDesk.title')"
          />
          <USelect
            v-model="exportFormat"
            class="bk-select"
            :items="exportFormats"
            :aria-label="t('frontDesk.exportFormat')"
          />
          <UButton
            :loading="exporting"
            @click="exportRegistration"
          >
            {{ t('frontDesk.export') }}
          </UButton>
        </div>
      </div>
      <div class="bk-table-wrap">
        <table class="list">
          <thead>
            <tr>
              <th>{{ t('bookings.colId') }}</th>
              <th>{{ t('bookings.colClient') }}</th>
              <th>{{ t('bookings.colStay') }}</th>
              <th>{{ t('bookings.colRoom') }}</th>
              <th>{{ t('bookings.arrivalTime') }}</th>
              <th>{{ t('bookings.colBalanceDue') }}</th>
              <th>{{ t('bookings.colStatus') }}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            <tr
              v-if="rows.length === 0"
              class="dr-empty"
            >
              <td colspan="8">
                {{ t('frontDesk.empty') }}
              </td>
            </tr>
            <tr
              v-for="row in rows"
              :key="row.id"
              class="bk-row"
              @click="openBooking(row)"
            >
              <td class="bk-ref">
                {{ row.display_reference }}
              </td>
              <td>{{ row.contact.name }}</td>
              <td>
                <template v-if="row.stay">
                  {{ row.stay.check_in }} – {{ row.stay.check_out }}
                  <span class="pill">{{ t('bookings.nightsPill', { n: String(row.stay.nights) }) }}</span>
                </template>
              </td>
              <td>{{ row.room?.label ?? '' }}</td>
              <td>{{ row.times?.expected_arrival_time ?? '' }}</td>
              <td>{{ money(row.balance) }}</td>
              <td>{{ labelOf(row.status) }}</td>
              <td class="list-actions">
                <UButton
                  v-if="row.allowed_actions?.includes('check_in')"
                  @click="checkIn(row, $event)"
                >
                  {{ t('bookings.deskCheckIn') }}
                </UButton>
                <UButton
                  v-if="row.allowed_actions?.includes('check_out') || row.allowed_actions?.includes('no_show')"
                  variant="outline"
                  @click.stop="openBooking(row)"
                >
                  {{ t('frontDesk.open') }}
                </UButton>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
    <BookingPanel
      v-model:open="panelOpen"
      :booking="selected"
      @updated="onUpdated"
    />
  </div>
</template>
