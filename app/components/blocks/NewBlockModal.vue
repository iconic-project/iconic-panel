<script setup lang="ts">
import type { BlockReason } from '../../types/api'
import { applyApiFormError, type FormFieldErrors } from '../../utils/apiForm'
import { BLOCK_REASONS, storeRangeBlockBody } from './blockHelpers'
import type { StayRange } from '#iconic-ui/app/components/AnkStayInput.vue'

type PropertyOption = {
  id: number
  code: string
  name: string
}

type RoomOption = {
  id: number
  code: string
  label: string
}

type RoomTypeOption = {
  id: number
  code: string
  name: string
}

export type BlockPrefill = {
  propertyId: number | null
  roomId: number | null
  checkIn: string
  checkOut: string
}

const open = defineModel<boolean>('open', { required: true })

const props = defineProps<{
  properties: Array<PropertyOption>
  stay: { minNights: number, maxNights: number, horizonDays: number } | null
  prefill: BlockPrefill | null
}>()

const emit = defineEmits<{
  created: []
}>()

const { t } = useI18n()
const toast = useToast()
const { request } = useApi()
const { format, addNights } = useDates()

const propertyId = ref<number | undefined>(undefined)
const stayRange = ref<StayRange | null>(null)
const reason = ref<BlockReason>('MAINTENANCE')
const notes = ref('')
const byType = ref(false)
const roomIds = ref<Array<number>>([])
const roomTypeId = ref<number | undefined>(undefined)
const count = ref(1)
const rooms = ref<Array<RoomOption>>([])
const roomTypes = ref<Array<RoomTypeOption>>([])
const saving = ref(false)
const fieldErrors = ref<FormFieldErrors>({})
const conflict = ref('')

const today = computed(() => format(new Date(), 'iso'))
const minDate = computed(() => today.value)
const maxDate = computed(() => props.stay === null ? '' : addNights(today.value, props.stay.horizonDays))

const reasonItems = computed(() => BLOCK_REASONS.map(value => ({
  value,
  label: t(`blocks.reasons.${value}`)
})))

watch(open, (isOpen) => {
  if (!isOpen) {
    return
  }

  fieldErrors.value = {}
  conflict.value = ''
  notes.value = ''
  reason.value = 'MAINTENANCE'
  byType.value = false
  count.value = 1
  propertyId.value = props.prefill?.propertyId ?? props.properties[0]?.id
  roomIds.value = props.prefill?.roomId === null || props.prefill === null ? [] : [props.prefill.roomId]
  stayRange.value = props.prefill === null || props.prefill.checkIn === ''
    ? null
    : {
        check_in: props.prefill.checkIn,
        check_out: props.prefill.checkOut
      }
})

watch(() => props.properties, (list) => {
  if (!open.value || propertyId.value !== undefined || list[0] === undefined) {
    return
  }

  propertyId.value = list[0].id
})

watch(propertyId, () => {
  void loadProperty()
})

async function loadProperty(): Promise<void> {
  const id = propertyId.value

  if (id === undefined) {
    rooms.value = []
    roomTypes.value = []
    return
  }

  const [roomList, typeList] = await Promise.all([
    request(`/api/rms/properties/${id}/rooms`) as Promise<{ data: Array<RoomOption> }>,
    request(`/api/rms/properties/${id}/room-types`) as Promise<{ data: Array<RoomTypeOption> }>
  ])

  rooms.value = roomList.data
  roomTypes.value = typeList.data
  roomTypeId.value = typeList.data[0]?.id
  roomIds.value = roomIds.value.filter(roomId => roomList.data.some(room => room.id === roomId))
}

function toggleRoom(id: number): void {
  roomIds.value = roomIds.value.includes(id)
    ? roomIds.value.filter(roomId => roomId !== id)
    : [...roomIds.value, id]
}

async function submit(): Promise<void> {
  if (propertyId.value === undefined || props.stay === null || stayRange.value === null) {
    return
  }

  saving.value = true
  fieldErrors.value = {}
  conflict.value = ''

  try {
    await request('/api/rms/blocks', {
      method: 'POST',
      body: storeRangeBlockBody({
        startsOn: stayRange.value.check_in,
        endsOn: stayRange.value.check_out,
        reason: reason.value,
        notes: notes.value,
        roomIds: roomIds.value,
        roomTypeId: roomTypeId.value ?? null,
        count: count.value,
        byType: byType.value
      })
    })
    toast.add({ title: t('blocks.createdDone'), color: 'success' })
    open.value = false
    emit('created')
  } catch (error) {
    if (!applyApiFormError(error, (fields, message) => {
      fieldErrors.value = fields
      conflict.value = message
    })) {
      throw error
    }
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <UModal
    v-model:open="open"
    :title="t('blocks.newTitle')"
    :description="t('blocks.newBody')"
  >
    <template #body>
      <form
        class="stack"
        @submit.prevent="submit"
      >
        <p
          v-if="stay === null"
          class="field-error"
        >
          {{ t('blocks.stayMissing') }}
        </p>
        <UFormField :label="t('blocks.property')">
          <USelect
            v-model="propertyId"
            :items="properties.map(property => ({ value: property.id, label: property.name }))"
            class="w-full"
          />
        </UFormField>
        <AnkStayInput
          v-if="stay !== null"
          v-model="stayRange"
          :min-nights="stay.minNights"
          :max-nights="stay.maxNights"
          :min-date="minDate"
          :max-date="maxDate"
        />
        <p
          v-if="fieldErrors.starts_on || fieldErrors.ends_on"
          class="field-error"
        >
          {{ fieldErrors.starts_on || fieldErrors.ends_on }}
        </p>
        <UFormField :label="t('blocks.reason')">
          <USelect
            v-model="reason"
            :items="reasonItems"
            class="w-full"
          />
        </UFormField>
        <UFormField :label="t('blocks.notes')">
          <UTextarea
            v-model="notes"
            class="w-full"
            :rows="2"
          />
        </UFormField>
        <label class="check-row">
          <input
            v-model="byType"
            type="checkbox"
          >
          {{ t('blocks.byType') }}
        </label>
        <UFormField
          v-if="byType"
          :label="t('blocks.roomType')"
          :error="fieldErrors.room_type_id"
        >
          <USelect
            v-model="roomTypeId"
            :items="roomTypes.map(type => ({ value: type.id, label: type.name }))"
            class="w-full"
          />
        </UFormField>
        <UFormField
          v-if="byType"
          :label="t('blocks.count')"
          :error="fieldErrors.count"
        >
          <UInput
            v-model.number="count"
            type="number"
            :min="1"
            class="w-full"
          />
        </UFormField>
        <fieldset v-else>
          <legend class="field-label">
            {{ t('blocks.rooms') }}
          </legend>
          <p
            v-if="fieldErrors.rooms"
            class="field-error"
          >
            {{ fieldErrors.rooms }}
          </p>
          <label
            v-for="room in rooms"
            :key="room.id"
            class="check-row"
          >
            <input
              type="checkbox"
              :checked="roomIds.includes(room.id)"
              @change="toggleRoom(room.id)"
            >
            {{ room.label }}
          </label>
        </fieldset>
        <p
          v-if="conflict"
          class="field-error"
        >
          {{ conflict }}
        </p>
        <div class="row-actions">
          <UButton
            type="submit"
            :loading="saving"
            :disabled="stay === null || stayRange === null"
          >
            {{ t('blocks.create') }}
          </UButton>
        </div>
      </form>
    </template>
  </UModal>
</template>
