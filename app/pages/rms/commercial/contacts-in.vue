<script setup lang="ts">
import type { Booking, ContactInRow, NationalitiesSummary, Paginated } from '../../../types/api'
import BookingPanel from '../../../components/bookings/BookingPanel.vue'
import { segmentPillClass, statusLabel, statusPillClass } from '../../../components/bookings/bookingHelpers'
import { nationalityBarWidth } from '../../../components/contacts/contactHelpers'

const emptyNationalities: NationalitiesSummary = {
  nationalities: [],
  unknown: 0,
  total_guests: 0
}

const { t } = useI18n()
const { useFetch, request } = useApi()
const { format: money } = useMoney()

const page = ref(1)

const panelOpen = ref(false)
const selected = ref<Booking | null>(null)

const listUrl = computed(() => {
  const params = new URLSearchParams({
    page: String(page.value),
    per_page: '50'
  })

  return `/api/rms/contacts-in?${params.toString()}`
})

const nationalitiesUrl = '/api/rms/contacts-in/nationalities'

const { data: listPayload, refresh } = useFetch<Paginated<ContactInRow>>(listUrl)
const { data: nationalitiesPayload, refresh: refreshNationalities } = useFetch<NationalitiesSummary>(nationalitiesUrl)

const rows = computed(() => listPayload.value?.data ?? [])
const meta = computed(() => listPayload.value?.meta)
const summary = computed(() => nationalitiesPayload.value ?? emptyNationalities)
const nationalities = computed(() => summary.value.nationalities)
const barMax = computed(() => {
  const counts = nationalities.value.map(row => row.guests)

  return counts.length === 0 ? 0 : Math.max(...counts)
})

async function openBooking(id: number): Promise<void> {
  selected.value = await request(`/api/rms/bookings/${String(id)}`) as Booking
  panelOpen.value = true
}

async function onPanelUpdated(): Promise<void> {
  await refresh()
  await refreshNationalities()
}
</script>

<template>
  <div>
    <div class="panel">
      <h3>{{ t('contactsIn.listTitle') }}</h3>
      <div class="bk-table-wrap">
        <table class="list">
          <thead>
            <tr>
              <th>{{ t('contactsIn.colContact') }}</th>
              <th>{{ t('contactsIn.colSegment') }}</th>
              <th>{{ t('contactsIn.colSource') }}</th>
              <th>{{ t('contactsIn.colBooking') }}</th>
              <th>{{ t('contactsIn.colStatus') }}</th>
              <th>{{ t('contactsIn.colValue') }}</th>
              <th>{{ t('contactsIn.colOwner') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-if="rows.length === 0"
              class="dr-empty"
            >
              <td colspan="7">
                {{ t('contactsIn.empty') }}
              </td>
            </tr>
            <tr
              v-for="row in rows"
              :key="row.id"
              class="bk-row"
              @click="openBooking(row.id)"
            >
              <td>
                {{ row.contact.name }}
                <div
                  v-if="row.travel_advisor"
                  class="ct-advisor"
                >
                  <span class="pill">{{ t('contactsIn.advisor') }}</span>
                </div>
              </td>
              <td>
                <span
                  class="sg"
                  :class="segmentPillClass(row.segment)"
                >{{ row.segment }}</span>
              </td>
              <td class="ct-source">
                {{ row.channel_of_origin }}
              </td>
              <td class="bk-ref">
                {{ row.display_reference }}
              </td>
              <td>
                <span
                  class="pill"
                  :class="statusPillClass(row.status)"
                >{{ statusLabel(row.status) }}</span>
              </td>
              <td>{{ money(row.charges_total) }}</td>
              <td>
                {{ row.owner.name }}{{ row.can_act ? '' : ` ${t('bookings.ownedLock')}` }}
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

    <div class="panel">
      <h3>{{ t('contactsIn.natTitle') }}</h3>
      <div class="bk-table-wrap">
        <table class="list">
          <thead>
            <tr>
              <th>{{ t('contactsIn.colRank') }}</th>
              <th>{{ t('contactsIn.colNationality') }}</th>
              <th>{{ t('contactsIn.colGuests') }}</th>
              <th />
              <th>{{ t('contactsIn.colBookings') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-if="nationalities.length === 0"
              class="dr-empty"
            >
              <td colspan="5">
                {{ t('contactsIn.natEmpty') }}
              </td>
            </tr>
            <tr
              v-for="(row, index) in nationalities"
              :key="row.nationality"
            >
              <td>{{ index + 1 }}</td>
              <td>{{ row.country_name }}</td>
              <td>{{ row.guests }}</td>
              <td class="natbar-cell">
                <div class="natbar">
                  <i :style="{ width: `${String(nationalityBarWidth(row.guests, barMax))}%` }" />
                </div>
              </td>
              <td>{{ row.bookings }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p class="note">
        {{ summary.unknown === 1
          ? t('contactsIn.unknownOne', { n: String(summary.unknown) })
          : t('contactsIn.unknownMany', { n: String(summary.unknown) }) }}
      </p>
    </div>

    <BookingPanel
      v-model:open="panelOpen"
      :booking="selected"
      @updated="onPanelUpdated"
    />
  </div>
</template>
