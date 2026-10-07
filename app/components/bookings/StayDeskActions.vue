<script setup lang="ts">
import type { Booking } from '../../types/api'
import { firstApiMessage } from '../../utils/apiForm'
import {
  deskActionPath,
  deskActionsVisible,
  type StayModifyPreview
} from './stayBooking'

const props = defineProps<{
  booking: Booking
}>()

const emit = defineEmits<{
  updated: [booking: Booking]
}>()

type FreeRoom = {
  id: number
  label: string
  room_type: { code: string }
}

const { t } = useI18n()
const { request } = useApi()
const { format: money } = useMoney()

const reason = ref('')
const error = ref('')
const busy = ref(false)
const modifyIn = ref<string | null>('')
const modifyOut = ref<string | null>('')
const preview = ref<StayModifyPreview | null>(null)
const moveRoomId = ref<string>('')
const freeRooms = ref<FreeRoom[]>([])

const actions = computed(() => deskActionsVisible(props.booking.allowed_actions ?? []))
const roomItems = computed(() => freeRooms.value.map(room => ({
  label: room.label,
  value: String(room.id)
})))

watch(() => props.booking, (booking) => {
  modifyIn.value = booking.stay?.check_in ?? ''
  modifyOut.value = booking.stay?.check_out ?? ''
  preview.value = null
  reason.value = ''
  error.value = ''
  moveRoomId.value = ''
}, { immediate: true })

watch(actions, (next) => {
  if (next.move_room) {
    void loadRooms()
  }
}, { immediate: true })

async function loadRooms(): Promise<void> {
  const propertyId = props.booking.property_id
  const stay = props.booking.stay

  if (propertyId === null || stay === null) {
    freeRooms.value = []
    return
  }

  try {
    const result = await request(
      `/api/rms/properties/${propertyId}/rooms?free_from=${stay.check_in}&free_to=${stay.check_out}`
    ) as { data: FreeRoom[] }
    const code = props.booking.room_type?.code
    freeRooms.value = result.data.filter(room => code === undefined || room.room_type.code === code)
  } catch {
    freeRooms.value = []
  }
}

async function post(path: string, body: Record<string, unknown>): Promise<void> {
  busy.value = true
  error.value = ''

  try {
    const updated = await request(path, { method: 'POST', body }) as Booking
    emit('updated', updated)
    reason.value = ''
    preview.value = null
  } catch (caught: unknown) {
    error.value = firstApiMessage(caught) ?? t('bookings.deskFailed')
  } finally {
    busy.value = false
  }
}

function checkIn(): Promise<void> {
  return post(deskActionPath(props.booking.id, 'check-in'), {})
}

function checkOut(): Promise<void> {
  const body: Record<string, unknown> = {}

  if (reason.value.trim() !== '') {
    body.reason = reason.value.trim()
  }

  return post(deskActionPath(props.booking.id, 'check-out'), body)
}

function noShow(): Promise<void> {
  return post(deskActionPath(props.booking.id, 'no-show'), { reason: reason.value.trim() })
}

async function previewModify(): Promise<void> {
  busy.value = true
  error.value = ''

  try {
    preview.value = await request(deskActionPath(props.booking.id, 'modify/preview'), {
      method: 'POST',
      body: {
        check_in: modifyIn.value ?? '',
        check_out: modifyOut.value ?? ''
      }
    }) as StayModifyPreview
  } catch (caught: unknown) {
    preview.value = null
    error.value = firstApiMessage(caught) ?? t('bookings.deskFailed')
  } finally {
    busy.value = false
  }
}

function confirmModify(): Promise<void> {
  return post(deskActionPath(props.booking.id, 'modify'), {
    check_in: modifyIn.value ?? '',
    check_out: modifyOut.value ?? '',
    reason: reason.value.trim()
  })
}

function moveRoom(): Promise<void> {
  return post(deskActionPath(props.booking.id, 'move'), {
    room_id: Number(moveRoomId.value),
    reason: reason.value.trim()
  })
}
</script>

<template>
  <section
    v-if="booking.stay"
    class="stack"
  >
    <div class="kv">
      <span>{{ t('bookings.colStay') }}</span>
      <span>
        {{ booking.stay.check_in }} – {{ booking.stay.check_out }}
        <span class="pill">{{ t('bookings.nightsPill', { n: String(booking.stay.nights) }) }}</span>
      </span>
    </div>
    <div
      v-if="booking.room"
      class="kv"
    >
      <span>{{ t('bookings.colRoom') }}</span>
      <span>{{ booking.room.label }}</span>
    </div>
    <div
      v-if="booking.room_type"
      class="kv"
    >
      <span>{{ t('bookings.colRoomType') }}</span>
      <span>{{ booking.room_type.name }}</span>
    </div>
    <div
      v-if="actions.check_in || actions.check_out || actions.no_show"
      class="desk-actions"
    >
      <UButton
        v-if="actions.check_in"
        :disabled="busy"
        @click="checkIn"
      >
        {{ t('bookings.deskCheckIn') }}
      </UButton>
      <UButton
        v-if="actions.check_out"
        :disabled="busy"
        @click="checkOut"
      >
        {{ t('bookings.deskCheckOut') }}
      </UButton>
      <UButton
        v-if="actions.no_show"
        variant="outline"
        :disabled="busy || reason.trim() === ''"
        @click="noShow"
      >
        {{ t('bookings.deskNoShow') }}
      </UButton>
    </div>
    <label
      v-if="actions.check_out || actions.no_show || actions.modify_stay || actions.move_room"
      class="field"
    >
      <span>{{ t('bookings.deskReason') }}</span>
      <UInput
        v-model="reason"
        class="w-full"
      />
    </label>
    <div
      v-if="actions.modify_stay"
      class="desk-modify"
    >
      <label class="field">
        <span>{{ t('bookings.filterArriving') }}</span>
        <AnkDateInput
          v-model="modifyIn"
          :aria-label="t('bookings.filterArriving')"
        />
      </label>
      <label class="field">
        <span>{{ t('bookings.filterDeparting') }}</span>
        <AnkDateInput
          v-model="modifyOut"
          :aria-label="t('bookings.filterDeparting')"
        />
      </label>
      <div class="desk-actions">
        <UButton
          variant="outline"
          :disabled="busy"
          @click="previewModify"
        >
          {{ t('bookings.deskPreview') }}
        </UButton>
        <UButton
          :disabled="busy || preview === null || reason.trim() === ''"
          @click="confirmModify"
        >
          {{ t('bookings.deskConfirm') }}
        </UButton>
      </div>
      <p
        v-if="preview"
        class="notice"
      >
        {{ money(preview.current_total) }} → {{ money(preview.new_total) }}
        · {{ t('bookings.nightsPill', { n: String(preview.nights) }) }}
      </p>
    </div>
    <div
      v-if="actions.move_room"
      class="field desk-move"
    >
      <label for="desk-room">{{ t('bookings.deskMove') }}</label>
      <USelect
        id="desk-room"
        v-model="moveRoomId"
        class="w-full"
        :items="roomItems"
      />
      <UButton
        :disabled="busy || moveRoomId === '' || reason.trim() === ''"
        @click="moveRoom"
      >
        {{ t('bookings.deskMove') }}
      </UButton>
    </div>
    <table
      v-if="booking.night_lines && booking.night_lines.length > 0"
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
          v-for="line in booking.night_lines"
          :key="line.night"
        >
          <td>{{ line.night }}</td>
          <td>{{ money(line.total) }}</td>
        </tr>
      </tbody>
    </table>
    <p
      v-if="error"
      class="field-error"
    >
      {{ error }}
    </p>
  </section>
</template>
