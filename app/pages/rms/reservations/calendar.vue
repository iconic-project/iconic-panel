<script setup lang="ts">
import type { BusinessRulesVersion, NightCalendar } from '../../../types/api'
import NightTimeline from '../../../components/calendar/NightTimeline.vue'
import NightBookingDrawer from '../../../components/calendar/NightBookingDrawer.vue'
import BlockDrawer from '../../../components/blocks/BlockDrawer.vue'
import NewBlockModal from '../../../components/blocks/NewBlockModal.vue'
import type { BlockPrefill } from '../../../components/blocks/NewBlockModal.vue'
import { readStayBounds, type RangeBlock } from '../../../components/blocks/blockHelpers'
import { addDays } from '../../../components/lists/dateRange'
import { nightWindow } from '../../../components/calendar/nightCalendar'

type PropertyOption = {
  id: number
  code: string
  name: string
}

const WINDOWS = [14, 31] as const

const { can, user } = useAuth()
const { t } = useI18n()
const { useFetch, request } = useApi()
const { format } = useDates()

const windowNights = ref<(typeof WINDOWS)[number]>(14)
const from = ref(format(new Date(), 'iso'))
const propertyId = ref<number | undefined>(undefined)
const grid = ref<NightCalendar | null>(null)
const loading = ref(false)
const bookingOpen = ref(false)
const bookingId = ref<number | null>(null)
const blockOpen = ref(false)
const selectedBlock = ref<RangeBlock | null>(null)
const createOpen = ref(false)
const prefill = ref<BlockPrefill | null>(null)

const canBlock = computed(() => can('blocks.manage'))
const roleName = computed(() => user.value?.role.name ?? '')
const span = computed(() => nightWindow(from.value, windowNights.value))

const { data: propertiesPayload } = useFetch<{ data: Array<PropertyOption> }>('/api/rms/properties')
const properties = computed(() => propertiesPayload.value?.data ?? [])

const { data: rulesPayload } = useFetch<BusinessRulesVersion>('/api/rms/business-rules')
const stay = computed(() => readStayBounds(rulesPayload.value?.document))

watch(properties, (list) => {
  if (propertyId.value === undefined && list[0] !== undefined) {
    propertyId.value = list[0].id
  }
}, { immediate: true })

watch([propertyId, from, windowNights], () => {
  void load()
}, { immediate: true })

async function load(): Promise<void> {
  if (propertyId.value === undefined) {
    grid.value = null
    return
  }

  loading.value = true

  try {
    const params = new URLSearchParams({
      property_id: String(propertyId.value),
      from: span.value.from,
      to: span.value.to
    })
    grid.value = await request(`/api/rms/calendar?${params.toString()}`) as NightCalendar
  } finally {
    loading.value = false
  }
}

function shift(days: number): void {
  from.value = addDays(from.value, days)
}

function goToday(): void {
  from.value = format(new Date(), 'iso')
}

function openBooking(id: number): void {
  bookingId.value = id
  bookingOpen.value = true
}

async function openBlock(id: number): Promise<void> {
  const payload = await request('/api/rms/blocks?status=all') as { data: Array<RangeBlock> }
  selectedBlock.value = payload.data.find(block => block.id === id) ?? null
  blockOpen.value = selectedBlock.value !== null
}

function blockNights(stayRange: { roomId: number, checkIn: string, checkOut: string }): void {
  if (!canBlock.value || propertyId.value === undefined) {
    return
  }

  prefill.value = {
    propertyId: propertyId.value,
    roomId: stayRange.roomId,
    checkIn: stayRange.checkIn,
    checkOut: stayRange.checkOut
  }
  createOpen.value = true
}
</script>

<template>
  <div class="night-page">
    <div class="night-toolbar">
      <USelect
        v-model="propertyId"
        :items="properties.map(property => ({ value: property.id, label: property.name }))"
        class="night-property"
      />
      <div class="fchips">
        <button
          v-for="size in WINDOWS"
          :key="size"
          type="button"
          class="fchip"
          :class="{ on: windowNights === size }"
          @click="windowNights = size"
        >
          {{ t('calendar.windowNights', { n: size }) }}
        </button>
      </div>
      <UButton
        variant="outline"
        @click="shift(-windowNights)"
      >
        {{ t('calendar.previous') }}
      </UButton>
      <UButton
        variant="outline"
        @click="goToday"
      >
        {{ t('calendar.today') }}
      </UButton>
      <UButton
        variant="outline"
        @click="shift(windowNights)"
      >
        {{ t('calendar.next') }}
      </UButton>
    </div>

    <div
      v-if="grid"
      class="krow"
    >
      <AnkKpi :label="t('calendar.kpiOccupancy')">
        {{ grid.kpis.occupancy_pct }}%
      </AnkKpi>
      <AnkKpi :label="t('calendar.kpiFree')">
        {{ grid.kpis.free_room_nights }}
      </AnkKpi>
      <AnkKpi :label="t('calendar.kpiSoldOut')">
        {{ grid.kpis.nights_fully_sold }}
      </AnkKpi>
      <AnkKpi :label="t('calendar.kpiBelow')">
        {{ grid.kpis.nights_below_threshold }}
      </AnkKpi>
    </div>

    <p
      v-if="loading"
      class="notice"
    >
      {{ t('calendar.loading') }}
    </p>
    <p
      v-else-if="grid === null || grid.rooms.length === 0"
      class="notice"
    >
      {{ t('calendar.emptyRooms') }}
    </p>
    <NightTimeline
      v-else
      :grid="grid"
      :can-block="canBlock"
      @open-booking="openBooking"
      @open-block="openBlock"
      @block-nights="blockNights"
    />

    <div class="night-legend">
      <span class="sw sw-conf" /> {{ t('calendar.legendSold') }}
      <span class="sw sw-hold" /> {{ t('calendar.legendHeld') }}
      <span class="sw sw-block" /> {{ t('calendar.legendBlocked') }}
    </div>

    <NightBookingDrawer
      v-model:open="bookingOpen"
      :booking-id="bookingId"
    />
    <BlockDrawer
      v-model:open="blockOpen"
      :source="selectedBlock"
      :can-manage="canBlock"
      :role-name="roleName"
      @saved="load"
    />
    <NewBlockModal
      v-model:open="createOpen"
      :properties="properties"
      :stay="stay"
      :prefill="prefill"
      @created="load"
    />
  </div>
</template>
