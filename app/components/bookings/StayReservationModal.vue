<script setup lang="ts">
import type { NightMark } from '#iconic-ui/app/components/AnkStayInput.vue'
import type { BookingFormOptions, CreateReservationResponse } from '../../types/api'
import { firstApiMessage } from '../../utils/apiForm'
import {
  addIsoDays,
  quoteFailures,
  stayBookingBody,
  stayQuoteBody,
  type StayQuote,
  type StayRoomDraft
} from './stayBooking'

const open = defineModel<boolean>('open', { required: true })

const emit = defineEmits<{
  created: [response: CreateReservationResponse]
}>()

type RoomForm = {
  key: number
  roomType: string
  adults: number
  childCount: number
  childAges: string[]
  ratePlan: string
  roomId: string
  ownDates: boolean
  checkIn: string
  checkOut: string
}

type RestrictionRow = {
  night: string
  room_type_id: number | null
  stop_sell: boolean
  closed_to_arrival: boolean
  closed_to_departure: boolean
  min_stay: number | null
}

type FreeRoom = {
  id: number
  label: string
  room_type: { code: string }
}

const { t } = useI18n()
const { can } = useAuth()
const { request } = useApi()
const { format } = useDates()
const { format: money } = useMoney()

const today = computed(() => format(new Date(), 'iso'))
const stay = ref<{ check_in: string, check_out: string } | null>(null)
const options = ref<BookingFormOptions | null>(null)
const restrictions = ref<RestrictionRow[]>([])
const rooms = ref<RoomForm[]>([])
const freeRooms = ref<FreeRoom[]>([])
const quote = ref<StayQuote | null>(null)
const name = ref('')
const email = ref('')
const phone = ref('')
const mainChannel = ref('')
const origin = ref('')
const groupName = ref('')
const arrivalTime = ref('')
const override = ref(false)
const overrideReason = ref('')
const error = ref('')
const busy = ref(false)
let nextKey = 1
let quoteTimer: ReturnType<typeof setTimeout> | undefined

const canOverride = computed(() => can('bookings.override_restrictions'))
const bounds = computed(() => options.value?.stay ?? null)
const maxDate = computed(() => {
  if (bounds.value === null) {
    return null
  }

  return addIsoDays(today.value, bounds.value.booking_horizon_days)
})
const propertyId = computed(() => options.value?.room_types[0]?.property_id ?? null)
const typeItems = computed(() => (options.value?.room_types ?? []).map(type => ({
  label: type.name,
  value: type.code
})))
const planItems = computed(() => (options.value?.rate_plans ?? []).map(plan => ({
  label: plan.name,
  value: plan.code
})))
const channelItems = computed(() => (options.value?.main ?? []).map(item => ({
  label: item.label,
  value: item.value
})))
const originItems = computed(() => (options.value?.origin ?? []).flatMap(group =>
  group.options.map(option => ({ label: option.label, value: option.value }))
))
const failures = computed(() => {
  const fromTypes = rooms.value.flatMap((room) => {
    const type = options.value?.room_types.find(item => item.code === room.roomType)

    return type?.restrictions ?? []
  })

  return [...new Set([...fromTypes, ...quoteFailures(quote.value)])]
})
const nightLines = computed(() => quote.value?.rooms.flatMap(room => room.quote?.night_lines ?? []) ?? [])
const taxLines = computed(() => quote.value?.rooms.flatMap(room => room.quote?.tax_lines ?? []) ?? [])
const canSubmit = computed(() =>
  stay.value !== null
  && name.value.trim() !== ''
  && quote.value?.total !== null
  && quote.value?.total !== undefined
  && (failures.value.length === 0 || (override.value && overrideReason.value.trim() !== ''))
  && (rooms.value.length < 2 || groupName.value.trim() !== '')
)

onMounted(() => {
  void loadOptions()
})

async function loadOptions(): Promise<void> {
  try {
    const value = await request('/api/rms/bookings/form-options') as BookingFormOptions
    options.value = value
    mainChannel.value = value.main[0]?.value ?? ''
    origin.value = value.origin[0]?.options[0]?.value ?? ''
    if (rooms.value.length === 0) {
      rooms.value = [blankRoom(value)]
    }
  } catch (caught: unknown) {
    error.value = firstApiMessage(caught) ?? ''
  }
}

watch(propertyId, () => {
  void loadRestrictions()
})

watch([stay, rooms], () => {
  clearTimeout(quoteTimer)
  quoteTimer = setTimeout(() => {
    void refreshQuote()
    void loadFreeRooms()
    void loadDatedOptions()
  }, 300)
}, { deep: true })

onUnmounted(() => {
  clearTimeout(quoteTimer)
})

function blankRoom(source: BookingFormOptions): RoomForm {
  const plan = source.rate_plans.find(item => item.default) ?? source.rate_plans[0]

  return {
    key: nextKey++,
    roomType: source.room_types[0]?.code ?? '',
    adults: source.room_types[0]?.base_occupancy ?? 1,
    childCount: 0,
    childAges: [],
    ratePlan: plan?.code ?? '',
    roomId: '',
    ownDates: false,
    checkIn: '',
    checkOut: ''
  }
}

function addRoom(): void {
  const source = options.value
  const cap = source?.stay.max_rooms_per_booking ?? 1

  if (source === undefined || source === null || rooms.value.length >= cap) {
    return
  }

  rooms.value.push(blankRoom(source))
}

function removeRoom(key: number): void {
  rooms.value = rooms.value.filter(room => room.key !== key)
}

function setChildCount(room: RoomForm, count: number): void {
  room.childCount = count
  room.childAges = Array.from({ length: count }, (_, index) => room.childAges[index] ?? '')
}

function drafts(): StayRoomDraft[] {
  return rooms.value.map(room => ({
    room_type: room.roomType,
    adults: room.adults,
    child_ages: room.childAges.map(age => Number(age)).filter(age => Number.isInteger(age)),
    rate_plan: room.ratePlan || null,
    room_id: room.roomId === '' ? null : Number(room.roomId),
    check_in: room.ownDates ? room.checkIn || null : null,
    check_out: room.ownDates ? room.checkOut || null : null
  }))
}

function nightInfo(date: string): NightMark {
  const typeId = options.value?.room_types.find(type => type.code === rooms.value[0]?.roomType)?.id ?? null
  const rows = restrictions.value.filter(row => row.night === date)
  const row = rows.find(item => item.room_type_id === typeId)
    ?? rows.find(item => item.room_type_id === null)
    ?? rows[0]

  if (row === undefined) {
    return {}
  }

  return {
    disabled: row.stop_sell,
    closedToArrival: row.closed_to_arrival,
    closedToDeparture: row.closed_to_departure,
    minStay: row.min_stay ?? undefined
  }
}

function roomsFor(room: RoomForm): FreeRoom[] {
  return freeRooms.value.filter(item => item.room_type.code === room.roomType)
}

async function loadRestrictions(): Promise<void> {
  if (propertyId.value === null || bounds.value === null) {
    return
  }

  try {
    const result = await request(
      `/api/rms/restrictions?property_id=${propertyId.value}&from=${today.value}&to=${maxDate.value}`
    ) as { restrictions: RestrictionRow[] }
    restrictions.value = result.restrictions
  } catch {
    restrictions.value = []
  }
}

async function loadDatedOptions(): Promise<void> {
  if (stay.value === null) {
    return
  }

  try {
    options.value = await request(
      `/api/rms/bookings/form-options?check_in=${stay.value.check_in}&check_out=${stay.value.check_out}`
    ) as BookingFormOptions
  } catch {
    // The undated options stay in place. Quote errors name the restriction.
  }
}

async function loadFreeRooms(): Promise<void> {
  if (stay.value === null || propertyId.value === null) {
    freeRooms.value = []
    return
  }

  try {
    const result = await request(
      `/api/rms/properties/${propertyId.value}/rooms?free_from=${stay.value.check_in}&free_to=${stay.value.check_out}`
    ) as { data: FreeRoom[] }
    freeRooms.value = result.data
  } catch {
    freeRooms.value = []
  }
}

async function refreshQuote(): Promise<void> {
  if (stay.value === null || rooms.value.some(room => room.roomType === '')) {
    quote.value = null
    return
  }

  try {
    quote.value = await request('/api/rms/bookings/quote', {
      method: 'POST',
      body: {
        ...stayQuoteBody(stay.value.check_in, stay.value.check_out, drafts()),
        ...(mainChannel.value === '' ? {} : { main_channel: mainChannel.value })
      }
    }) as StayQuote
    error.value = ''
  } catch (caught: unknown) {
    quote.value = null
    error.value = firstApiMessage(caught) ?? ''
  }
}

async function submit(): Promise<void> {
  if (stay.value === null || quote.value?.total == null || !canSubmit.value) {
    return
  }

  busy.value = true
  error.value = ''

  try {
    const created = await request('/api/rms/bookings', {
      method: 'POST',
      body: stayBookingBody({
        checkIn: stay.value.check_in,
        checkOut: stay.value.check_out,
        rooms: drafts(),
        clientName: name.value.trim(),
        clientEmail: email.value.trim(),
        clientPhone: phone.value.trim(),
        mainChannel: mainChannel.value,
        channelOfOrigin: origin.value,
        expectedTotal: quote.value.total,
        override: override.value,
        overrideReason: overrideReason.value.trim(),
        groupName: rooms.value.length > 1 ? groupName.value : '',
        expectedArrivalTime: arrivalTime.value
      })
    }) as CreateReservationResponse
    open.value = false
    emit('created', created)
  } catch (caught: unknown) {
    error.value = firstApiMessage(caught) ?? t('bookings.deskFailed')
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <UModal
    :open="open"
    :title="t('bookings.stayTitle')"
    @update:open="open = $event"
  >
    <template #body>
      <form
        class="modal-form"
        @submit.prevent="submit"
      >
        <p
          v-if="error"
          class="field-error"
        >
          {{ error }}
        </p>
        <AnkStayInput
          v-if="bounds"
          v-model="stay"
          :min-nights="bounds.min_nights"
          :max-nights="bounds.max_nights"
          :min-date="today"
          :max-date="maxDate"
          :night-info="nightInfo"
        />
        <div
          v-for="room in rooms"
          :key="room.key"
          class="panel"
        >
          <div class="cols2">
            <label class="field">
              <span>{{ t('bookings.roomType') }}</span>
              <USelect
                v-model="room.roomType"
                class="w-full"
                :items="typeItems"
              />
            </label>
            <label class="field">
              <span>{{ t('bookings.ratePlan') }}</span>
              <USelect
                v-model="room.ratePlan"
                class="w-full"
                :items="planItems"
              />
            </label>
            <label class="field">
              <span>{{ t('bookings.adults') }}</span>
              <UInput
                v-model.number="room.adults"
                type="number"
                class="w-full"
              />
            </label>
            <label class="field">
              <span>{{ t('bookings.children') }}</span>
              <UInput
                :model-value="String(room.childCount)"
                type="number"
                class="w-full"
                @update:model-value="setChildCount(room, Number($event))"
              />
            </label>
          </div>
          <div
            v-for="(_, index) in room.childAges"
            :key="index"
            class="field"
          >
            <label :for="`age-${room.key}-${index}`">{{ t('bookings.childAge') }}</label>
            <UInput
              :id="`age-${room.key}-${index}`"
              v-model="room.childAges[index]"
              type="number"
              class="w-full"
            />
          </div>
          <label class="field">
            <span>{{ t('bookings.roomOptional') }}</span>
            <USelect
              v-model="room.roomId"
              class="w-full"
              :items="[{ label: t('bookings.roomUnassigned'), value: '' }, ...roomsFor(room).map(item => ({ label: item.label, value: String(item.id) }))]"
            />
          </label>
          <label class="field">
            <input
              v-model="room.ownDates"
              type="checkbox"
            >
            {{ t('bookings.ownDates') }}
          </label>
          <div
            v-if="room.ownDates"
            class="cols2"
          >
            <UInput
              v-model="room.checkIn"
              type="date"
              class="w-full"
            />
            <UInput
              v-model="room.checkOut"
              type="date"
              class="w-full"
            />
          </div>
          <UButton
            v-if="rooms.length > 1"
            variant="outline"
            type="button"
            @click="removeRoom(room.key)"
          >
            {{ t('bookings.removeRoom') }}
          </UButton>
        </div>
        <UButton
          type="button"
          variant="outline"
          @click="addRoom"
        >
          {{ t('bookings.addRoom') }}
        </UButton>
        <label
          v-if="rooms.length > 1"
          class="field"
        >
          <span>{{ t('bookings.groupName') }}</span>
          <UInput
            v-model="groupName"
            class="w-full"
          />
        </label>
        <div
          v-if="quote && quote.total !== null"
          class="kv"
        >
          <span>{{ t('bookings.quoteTotal') }}</span>
          <span>{{ money(quote.total) }}</span>
        </div>
        <div
          v-if="quote?.deposit !== null && quote?.deposit !== undefined"
          class="kv"
        >
          <span>{{ t('bookings.quoteDeposit') }}</span>
          <span>{{ money(quote.deposit) }}</span>
        </div>
        <table
          v-if="nightLines.length > 0"
          class="list"
        >
          <thead>
            <tr>
              <th>{{ t('bookings.nightLines') }}</th>
              <th>{{ t('bookings.quoteTotal') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="(line, index) in nightLines"
              :key="`${line.night}-${index}`"
            >
              <td>{{ line.night }}</td>
              <td>{{ money(line.total) }}</td>
            </tr>
          </tbody>
        </table>
        <ul v-if="taxLines.length > 0">
          <li
            v-for="line in taxLines"
            :key="line.code"
          >
            {{ line.label }} {{ money(line.amount) }}
          </li>
        </ul>
        <div v-if="failures.length > 0">
          <p>{{ t('bookings.restrictionFailures') }}</p>
          <ul>
            <li
              v-for="failure in failures"
              :key="failure"
            >
              {{ failure }}
            </li>
          </ul>
          <label v-if="canOverride">
            <input
              v-model="override"
              type="checkbox"
            >
            {{ t('bookings.overrideRestrictions') }}
          </label>
          <UInput
            v-if="override"
            v-model="overrideReason"
            :placeholder="t('bookings.overrideReason')"
            class="w-full"
          />
        </div>
        <div class="cols2">
          <label class="field">
            <span>{{ t('bookings.guestName') }}</span>
            <UInput
              v-model="name"
              class="w-full"
            />
          </label>
          <label class="field">
            <span>{{ t('bookings.email') }}</span>
            <UInput
              v-model="email"
              type="email"
              class="w-full"
            />
          </label>
          <label class="field">
            <span>{{ t('bookings.phone') }}</span>
            <UInput
              v-model="phone"
              class="w-full"
            />
          </label>
          <label class="field">
            <span>{{ t('bookings.arrivalTime') }}</span>
            <UInput
              v-model="arrivalTime"
              type="time"
              class="w-full"
            />
          </label>
          <label class="field">
            <span>{{ t('bookings.mainChannel') }}</span>
            <USelect
              v-model="mainChannel"
              class="w-full"
              :items="channelItems"
            />
          </label>
          <label class="field">
            <span>{{ t('bookings.originChannel') }}</span>
            <USelect
              v-model="origin"
              class="w-full"
              :items="originItems"
            />
          </label>
        </div>
        <div class="modal-actions">
          <UButton
            type="submit"
            :disabled="busy || !canSubmit"
          >
            {{ t('bookings.createStay') }}
          </UButton>
        </div>
      </form>
    </template>
  </UModal>
</template>
