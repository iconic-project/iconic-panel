<script setup lang="ts">
import type { Booking, BookingAuditRow, BookingOwner, BookingSegment, BookingStatus, CreateReservationResponse, Group, Paginated } from '../../../types/api'
import BookingPanel from '../../../components/bookings/BookingPanel.vue'
import GroupDrawer from '../../../components/bookings/GroupDrawer.vue'
import StayReservationModal from '../../../components/bookings/StayReservationModal.vue'
import {
  bookingToOpen,
  statusPillClass,
  statusText
} from '../../../components/bookings/bookingHelpers'
import { MAIN_CHANNELS } from '../../../components/bookings/stayBooking'

const SEARCH_DEBOUNCE_MS = 300
const FILTER_ANY = 'ALL'
const PAGE_SIZE = 15

const SEGMENTS: Array<{ id: 'ALL' | BookingSegment, labelKey: string }> = [
  { id: 'ALL', labelKey: 'bookings.segmentAll' },
  { id: 'D2C', labelKey: 'bookings.segmentD2c' },
  { id: 'B2B', labelKey: 'bookings.segmentB2b' },
  { id: 'CHARTER', labelKey: 'bookings.segmentCharter' }
]

const { can } = useAuth()
const { t } = useI18n()
const { useFetch, request } = useApi()
const { format } = useDates()
const { format: money } = useMoney()
const route = useRoute()
const router = useRouter()
const stayOpen = ref(false)

const arrivingFrom = ref<string | null>(null)
const arrivingTo = ref<string | null>(null)
const inHouseOn = ref<string | null>(null)
const departingFrom = ref<string | null>(null)
const departingTo = ref<string | null>(null)
const statusFilter = ref(FILTER_ANY)
const ownerFilter = ref(FILTER_ANY)
const channelFilter = ref(FILTER_ANY)
const owners = ref<BookingOwner[]>([])
const segment = ref<'ALL' | BookingSegment>('ALL')
const searchInput = ref('')
const search = ref('')
const mine = ref(false)
const overdueOnly = ref(false)
const page = ref(1)
const auditPage = ref(1)

const STATUS_FILTERS: BookingStatus[] = [
  'REQUESTED',
  'PENDING_PAYMENT',
  'CONFIRMED',
  'FULLY_PAID',
  'IN_HOUSE',
  'CHECKED_OUT',
  'NO_SHOW',
  'ON_HOLD_AGENCY',
  'OVERDUE',
  'CANCELLED'
]

const panelOpen = ref(false)
const selected = ref<Booking | null>(null)
const groupOpen = ref(false)
const selectedGroup = ref<Group | null>(null)
const openedFromQuery = ref(false)

let searchTimer: ReturnType<typeof setTimeout> | undefined

watch(searchInput, (value) => {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(() => {
    search.value = value.trim()
  }, SEARCH_DEBOUNCE_MS)
})

onUnmounted(() => {
  clearTimeout(searchTimer)
})

watch([search, segment, mine, overdueOnly, arrivingFrom, arrivingTo, inHouseOn, departingFrom, departingTo, statusFilter, ownerFilter, channelFilter], () => {
  page.value = 1
  auditPage.value = 1
})

onMounted(() => {
  void loadOwners()
})

async function loadOwners(): Promise<void> {
  try {
    const result = await request('/api/rms/bookings/owners') as { data: BookingOwner[] }
    owners.value = result.data
  } catch {
    owners.value = []
  }
}

function labelOf(status: string): string {
  return statusText(status, key => t(key))
}

function dateQuery(value: string | null): string | null {
  if (value === null || value === '') {
    return null
  }

  return value
}

const canViewAudit = computed(() => can('bookings.view_all'))
const canCreate = computed(() => can('bookings.create'))

const listUrl = computed(() => {
  const params = new URLSearchParams({
    page: String(page.value),
    per_page: String(PAGE_SIZE)
  })

  const arrivingStart = dateQuery(arrivingFrom.value)
  const arrivingEnd = dateQuery(arrivingTo.value)
  const inHouse = dateQuery(inHouseOn.value)
  const departingStart = dateQuery(departingFrom.value)
  const departingEnd = dateQuery(departingTo.value)

  if (arrivingStart !== null) {
    params.set('arriving_from', arrivingStart)
  }

  if (arrivingEnd !== null) {
    params.set('arriving_to', arrivingEnd)
  }

  if (inHouse !== null) {
    params.set('in_house_on', inHouse)
  }

  if (departingStart !== null) {
    params.set('departing_from', departingStart)
  }

  if (departingEnd !== null) {
    params.set('departing_to', departingEnd)
  }

  if (statusFilter.value !== FILTER_ANY) {
    params.set('status', statusFilter.value)
  }

  if (ownerFilter.value !== FILTER_ANY) {
    params.set('owner_id', ownerFilter.value)
  }

  if (channelFilter.value !== FILTER_ANY) {
    params.set('channel', channelFilter.value)
  }

  if (segment.value !== 'ALL') {
    params.set('segment', segment.value)
  }

  if (search.value !== '') {
    params.set('q', search.value)
  }

  if (mine.value) {
    params.set('mine', '1')
  }

  if (overdueOnly.value) {
    params.set('overdue', '1')
  }

  return `/api/rms/bookings?${params.toString()}`
})

const groupsUrl = computed(() => '/api/rms/groups')

const auditUrl = computed(() => {
  const params = new URLSearchParams({
    page: String(auditPage.value),
    per_page: '50'
  })

  return `/api/rms/bookings/audit?${params.toString()}`
})

const { data: listPayload, refresh } = useFetch<Paginated<Booking>>(listUrl)
const { data: groupsPayload, refresh: refreshGroups } = useFetch<{ data: Array<Group> }>(groupsUrl)
const { data: auditPayload, refresh: refreshAudit } = useFetch<Paginated<BookingAuditRow>>(auditUrl, {
  immediate: false
})

watch([canViewAudit, auditUrl], ([allowed]) => {
  if (allowed) {
    void refreshAudit()
  }
}, { immediate: true })

const bookings = computed(() => listPayload.value?.data ?? [])
const meta = computed(() => listPayload.value?.meta)
const groups = computed(() => groupsPayload.value?.data ?? [])
const audit = computed(() => auditPayload.value?.data ?? [])
const auditMeta = computed(() => auditPayload.value?.meta)

function openBooking(booking: Booking): void {
  selected.value = booking
  panelOpen.value = true
}

function openGroup(group: Group): void {
  selectedGroup.value = group
  groupOpen.value = true
}

async function openGroupById(id: number): Promise<void> {
  const fromList = groups.value.find(item => item.id === id)

  if (fromList !== undefined) {
    panelOpen.value = false
    openGroup(fromList)
    return
  }

  const all = await request('/api/rms/groups') as { data: Array<Group> }
  const found = all.data.find(item => item.id === id)

  if (found !== undefined) {
    panelOpen.value = false
    openGroup(found)
  }
}

async function refreshAll(): Promise<void> {
  await refresh()
  await refreshGroups()

  if (canViewAudit.value) {
    await refreshAudit()
  }
}

async function onUpdated(booking: Booking): Promise<void> {
  await refreshAll()
  selected.value = bookings.value.find(item => item.id === booking.id) ?? booking
}

async function onDeleted(): Promise<void> {
  selected.value = null
  await refreshAll()
}

async function onCreated(response: CreateReservationResponse): Promise<void> {
  stayOpen.value = false
  page.value = 1
  await refreshAll()
  const first = response.bookings[0]

  if (first === undefined) {
    return
  }

  openBooking(bookings.value.find(item => item.id === first.id) ?? first)
}

function onOpenBookingFromGroup(booking: Booking): void {
  openBooking(booking)
}

watch(
  () => route.query.new,
  (value) => {
    if (value !== '1') {
      return
    }

    stayOpen.value = true

    const query = { ...route.query }
    delete query.new
    void router.replace({ query })
  },
  { immediate: true }
)

watch(
  [listPayload, () => route.query.open],
  async ([payload, open]) => {
    if (openedFromQuery.value || payload === undefined) {
      return
    }

    const fromList = bookingToOpen(open as string | Array<string> | undefined, payload.data)

    if (fromList !== null) {
      openBooking(fromList)
      openedFromQuery.value = true
      return
    }

    const reference = Array.isArray(open) ? open[0] : open

    if (typeof reference !== 'string' || reference === '') {
      openedFromQuery.value = true
      return
    }

    const found = await request(`/api/rms/bookings?q=${encodeURIComponent(reference)}&per_page=50`) as Paginated<Booking>
    const match = bookingToOpen(reference, found.data)

    if (match !== null) {
      openBooking(match)
    }

    openedFromQuery.value = true
  }
)
</script>

<template>
  <div>
    <div class="panel">
      <div class="bk-toolbar bk-head">
        <h3>{{ t('bookings.panelTitle') }}</h3>
        <UButton
          v-if="canCreate"
          @click="stayOpen = true"
        >
          {{ t('bookings.newStay') }}
        </UButton>
      </div>
      <div class="bk-filters-wrap">
        <div class="bk-filters">
          <label class="field">
            <span>{{ t('bookings.filterArriving') }}</span>
            <span class="bk-date-range">
              <span class="bk-date">
                <AnkDateInput
                  v-model="arrivingFrom"
                  :aria-label="t('bookings.filterArriving')"
                />
              </span>
              <span
                class="bk-range-sep"
                aria-hidden="true"
              >–</span>
              <span class="bk-date">
                <AnkDateInput
                  v-model="arrivingTo"
                  :aria-label="t('bookings.filterArriving')"
                />
              </span>
            </span>
          </label>
          <label class="field">
            <span>{{ t('bookings.filterInHouse') }}</span>
            <span class="bk-date">
              <AnkDateInput
                v-model="inHouseOn"
                :aria-label="t('bookings.filterInHouse')"
              />
            </span>
          </label>
          <label class="field">
            <span>{{ t('bookings.filterDeparting') }}</span>
            <span class="bk-date-range">
              <span class="bk-date">
                <AnkDateInput
                  v-model="departingFrom"
                  :aria-label="t('bookings.filterDeparting')"
                />
              </span>
              <span
                class="bk-range-sep"
                aria-hidden="true"
              >–</span>
              <span class="bk-date">
                <AnkDateInput
                  v-model="departingTo"
                  :aria-label="t('bookings.filterDeparting')"
                />
              </span>
            </span>
          </label>
        </div>
      </div>
      <div class="ebtool dep-toolbar bk-filter-bar">
        <div class="fchips">
          <button
            v-for="item in SEGMENTS"
            :key="item.id"
            type="button"
            class="fchip"
            :class="{ on: segment === item.id }"
            @click="segment = item.id"
          >
            {{ t(item.labelKey) }}
          </button>
        </div>
        <div class="bk-filter-selects">
          <label class="field">
            <span>{{ t('bookings.filterStatus') }}</span>
            <USelect
              v-model="statusFilter"
              class="bk-select"
              :items="[{ label: t('bookings.filterAny'), value: FILTER_ANY }, ...STATUS_FILTERS.map(status => ({ label: labelOf(status), value: status }))]"
            />
          </label>
          <label class="field">
            <span>{{ t('bookings.filterOwner') }}</span>
            <USelect
              v-model="ownerFilter"
              class="bk-select"
              :items="[{ label: t('bookings.filterAny'), value: FILTER_ANY }, ...owners.map(owner => ({ label: owner.name, value: String(owner.id) }))]"
            />
          </label>
          <label class="field">
            <span>{{ t('bookings.filterChannel') }}</span>
            <USelect
              v-model="channelFilter"
              class="bk-select"
              :items="[{ label: t('bookings.filterAny'), value: FILTER_ANY }, ...MAIN_CHANNELS.map(channel => ({ label: channel, value: channel }))]"
            />
          </label>
        </div>
        <div class="list-filters">
          <UInput
            v-model="searchInput"
            class="bk-search"
            :placeholder="t('bookings.searchPlaceholder')"
            :aria-label="t('bookings.search')"
          />
          <button
            type="button"
            class="fchip bk-mine"
            :class="{ on: mine }"
            @click="mine = !mine"
          >
            {{ t('bookings.mine') }}
          </button>
          <button
            type="button"
            class="fchip bk-mine"
            :class="{ on: overdueOnly }"
            @click="overdueOnly = !overdueOnly"
          >
            {{ t('bookings.overdueOnly') }}
          </button>
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
              <th>{{ t('bookings.colRoomType') }}</th>
              <th>{{ t('bookings.colStatus') }}</th>
              <th>{{ t('bookings.colBalanceDue') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-if="bookings.length === 0"
              class="dr-empty"
            >
              <td colspan="7">
                {{ t('bookings.empty') }}
              </td>
            </tr>
            <tr
              v-for="row in bookings"
              :key="row.id"
              class="bk-row"
              @click="openBooking(row)"
            >
              <td class="bk-ref">
                {{ row.display_reference }}
              </td>
              <td>
                {{ row.contact.name }}
                <div
                  v-if="row.group"
                  class="bk-sub"
                >
                  {{ t('bookings.groupLine', { reference: row.group.reference, name: row.group.coordinator.name }) }}
                </div>
                <div
                  class="bk-sub guests-line"
                  :class="row.guests_summary.complete === row.guests_summary.total ? 'guests-ok' : 'guests-muted'"
                >
                  {{ t('bookings.guestsLine', {
                    complete: String(row.guests_summary.complete),
                    total: String(row.guests_summary.total)
                  }) }}
                </div>
              </td>
              <td>
                <template v-if="row.stay">
                  {{ row.stay.check_in }} – {{ row.stay.check_out }}
                  <span class="pill">{{ t('bookings.nightsPill', { n: String(row.stay.nights) }) }}</span>
                </template>
              </td>
              <td>{{ row.room?.label ?? '' }}</td>
              <td>{{ row.room_type?.name ?? '' }}</td>
              <td>
                <span
                  class="pill"
                  :class="statusPillClass(row.status)"
                >{{ labelOf(row.status) }}</span>
                <span
                  v-if="row.overdue"
                  class="pill p-over"
                >{{ t('bookings.overduePill') }}</span>
              </td>
              <td>{{ money(row.balance) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <div
        v-if="meta && meta.total > 0"
        class="bk-pager"
      >
        <span class="bk-pager-count">{{ t('bookings.pager', { from: String(meta.from ?? 0), to: String(meta.to ?? 0), total: String(meta.total) }) }}</span>
        <UPagination
          v-model:page="page"
          :total="meta.total"
          :items-per-page="PAGE_SIZE"
          size="sm"
        />
      </div>
    </div>

    <div class="panel">
      <h3>{{ t('bookings.groupsTitle') }}</h3>
      <div class="bk-table-wrap">
        <table class="list">
          <thead>
            <tr>
              <th>{{ t('bookings.colGroup') }}</th>
              <th>{{ t('bookings.colCoordinator') }}</th>
              <th>{{ t('blocks.property') }}</th>
              <th>{{ t('blocks.rooms') }}</th>
              <th>{{ t('bookings.colTotal') }}</th>
              <th>{{ t('bookings.colBalance') }}</th>
              <th>{{ t('bookings.colStatus') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-if="groups.length === 0"
              class="dr-empty"
            >
              <td colspan="7">
                {{ t('bookings.groupsEmpty') }}
              </td>
            </tr>
            <tr
              v-for="row in groups"
              :key="row.id"
              class="bk-row"
              @click="openGroup(row)"
            >
              <td class="bk-ref">
                {{ row.reference }}
              </td>
              <td>
                {{ row.name }}
                <div class="gmeta">
                  {{ t('bookings.groupCoordinator', { name: row.coordinator.name }) }}
                </div>
              </td>
              <td>{{ row.property?.name ?? '' }}</td>
              <td>{{ row.rooms.join(', ') }}</td>
              <td>{{ money(row.total) }}</td>
              <td>{{ money(row.balance) }}</td>
              <td>
                <span
                  v-for="status in row.statuses"
                  :key="status"
                  class="pill"
                  :class="statusPillClass(status)"
                >{{ labelOf(status) }}</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <div
      v-if="canViewAudit"
      class="panel"
    >
      <h3>{{ t('bookings.auditTitle') }}</h3>
      <div class="bk-table-wrap">
        <table class="list">
          <thead>
            <tr>
              <th>{{ t('bookings.colWhen') }}</th>
              <th>{{ t('bookings.colWho') }}</th>
              <th>{{ t('bookings.colBooking') }}</th>
              <th>{{ t('bookings.colAction') }}</th>
              <th>{{ t('bookings.colReason') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-if="audit.length === 0"
              class="dr-empty"
            >
              <td colspan="5">
                {{ t('bookings.auditEmpty') }}
              </td>
            </tr>
            <tr
              v-for="(row, index) in audit"
              :key="`${row.at}-${index}`"
            >
              <td class="bk-sub">
                {{ format(row.at, 'dateTime') }}
              </td>
              <td>{{ row.actor_label }}</td>
              <td>
                <span class="bk-ref">{{ row.reference }}</span>
                <div
                  v-if="row.client"
                  class="gmeta"
                >
                  {{ row.client }}
                </div>
              </td>
              <td>{{ row.what }}</td>
              <td class="bk-sub">
                {{ row.why ?? '—' }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div
        v-if="auditMeta && auditMeta.last_page > 1"
        class="list-pager"
      >
        <button
          type="button"
          :disabled="auditMeta.current_page <= 1"
          @click="auditPage -= 1"
        >
          {{ t('bookings.previous') }}
        </button>
        <span>{{ t('bookings.pager', { from: String(auditMeta.from ?? 0), to: String(auditMeta.to ?? 0), total: String(auditMeta.total) }) }}</span>
        <button
          type="button"
          :disabled="auditMeta.current_page >= auditMeta.last_page"
          @click="auditPage += 1"
        >
          {{ t('bookings.next') }}
        </button>
      </div>
    </div>

    <BookingPanel
      v-model:open="panelOpen"
      :booking="selected"
      @updated="onUpdated"
      @deleted="onDeleted"
      @open-group="openGroupById"
    />

    <GroupDrawer
      v-model:open="groupOpen"
      :group="selectedGroup"
      @open-booking="onOpenBookingFromGroup"
    />

    <StayReservationModal
      v-model:open="stayOpen"
      @created="onCreated"
    />
  </div>
</template>
