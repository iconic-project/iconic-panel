<script setup lang="ts">
import { addDays, addMonths } from '../../../components/lists/dateRange'
import {
  restrictionMarks,
  restrictionPayload,
  winningRestriction,
  type RestrictionRow
} from '../../../components/restrictions/restrictionEditor'

type PropertyOption = {
  id: number
  code: string
  name: string
}

type RoomTypeOption = {
  id: number
  code: string
  name: string
}

type RestrictionsPayload = {
  restrictions: Array<RestrictionRow>
}

type FlagChoice = 'omit' | 'yes' | 'no'
type ValueChoice = 'omit' | 'set' | 'clear'

const WEEKDAYS = [1, 2, 3, 4, 5, 6, 7] as const

const { can } = useAuth()
const { t } = useI18n()
const { useFetch, request } = useApi()
const { format } = useDates()

const propertyId = ref<number | undefined>(undefined)
const monthStart = ref(`${format(new Date(), 'iso').slice(0, 8)}01`)
const rows = ref<Array<RestrictionRow>>([])
const roomTypes = ref<Array<RoomTypeOption>>([])
const saving = ref(false)
const conflict = ref('')

const editFrom = ref(monthStart.value)
const editTo = ref(monthStart.value)
const weekdays = ref<Array<number>>([...WEEKDAYS])
const typeIds = ref<Array<number>>([])
const stopSell = ref<FlagChoice>('omit')
const closedToArrival = ref<FlagChoice>('omit')
const closedToDeparture = ref<FlagChoice>('omit')
const minMode = ref<ValueChoice>('omit')
const maxMode = ref<ValueChoice>('omit')
const noteMode = ref<ValueChoice>('omit')
const minStay = ref(1)
const maxStay = ref(1)
const note = ref('')
const reason = ref('')

const canManage = computed(() => can('inventory.manage_restrictions'))

const { data: propertiesPayload } = useFetch<{ data: Array<PropertyOption> }>('/api/rms/properties')
const properties = computed(() => propertiesPayload.value?.data ?? [])

const monthEnd = computed(() => addDays(addMonths(monthStart.value, 1), -1))

const days = computed(() => {
  const list: Array<string> = []
  let cursor = monthStart.value

  while (cursor <= monthEnd.value) {
    list.push(cursor)
    cursor = addDays(cursor, 1)
  }

  return list
})

const payload = computed(() => {
  if (propertyId.value === undefined) {
    return null
  }

  return restrictionPayload({
    propertyId: propertyId.value,
    roomTypeIds: typeIds.value,
    from: editFrom.value,
    to: editTo.value,
    weekdays: weekdays.value,
    stopSell: flag(stopSell.value),
    closedToArrival: flag(closedToArrival.value),
    closedToDeparture: flag(closedToDeparture.value),
    minStay: optionalNumber(minMode.value, minStay.value),
    maxStay: optionalNumber(maxMode.value, maxStay.value),
    note: optionalText(noteMode.value, note.value),
    reason: reason.value
  })
})

const canSubmit = computed(() => {
  const body = payload.value

  if (body === null || !canManage.value) {
    return false
  }

  return ['stop_sell', 'closed_to_arrival', 'closed_to_departure', 'min_stay', 'max_stay', 'note']
    .some(key => key in body)
})

watch(properties, (list) => {
  if (propertyId.value === undefined && list[0] !== undefined) {
    propertyId.value = list[0].id
  }
}, { immediate: true })

watch([propertyId, monthStart], () => {
  void load()
}, { immediate: true })

function flag(choice: FlagChoice): boolean | null {
  if (choice === 'omit') {
    return null
  }

  return choice === 'yes'
}

function optionalNumber(choice: ValueChoice, value: number): number | null | undefined {
  if (choice === 'omit') {
    return undefined
  }

  if (choice === 'clear') {
    return null
  }

  return value
}

function optionalText(choice: ValueChoice, value: string): string | null | undefined {
  if (choice === 'omit') {
    return undefined
  }

  if (choice === 'clear') {
    return null
  }

  return value
}

function toggleWeekday(day: number): void {
  weekdays.value = weekdays.value.includes(day)
    ? weekdays.value.filter(item => item !== day)
    : [...weekdays.value, day]
}

function toggleType(id: number): void {
  typeIds.value = typeIds.value.includes(id)
    ? typeIds.value.filter(item => item !== id)
    : [...typeIds.value, id]
}

function shiftMonth(months: number): void {
  monthStart.value = addMonths(monthStart.value, months)
}

async function load(): Promise<void> {
  if (propertyId.value === undefined) {
    rows.value = []
    roomTypes.value = []
    return
  }

  const params = new URLSearchParams({
    property_id: String(propertyId.value),
    from: monthStart.value,
    to: monthEnd.value
  })
  const [grid, types] = await Promise.all([
    request(`/api/rms/restrictions?${params.toString()}`) as Promise<RestrictionsPayload>,
    request(`/api/rms/properties/${propertyId.value}/room-types`) as Promise<{ data: Array<RoomTypeOption> }>
  ])

  rows.value = grid.restrictions
  roomTypes.value = types.data
}

async function save(): Promise<void> {
  if (payload.value === null || !canSubmit.value) {
    return
  }

  saving.value = true
  conflict.value = ''

  try {
    await request('/api/rms/restrictions', {
      method: 'PUT',
      body: payload.value
    })
    await load()
  } catch (error) {
    conflict.value = error instanceof Error ? error.message : t('restrictions.saveFailed')
  } finally {
    saving.value = false
  }
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
      <UButton
        variant="outline"
        @click="shiftMonth(-1)"
      >
        {{ t('restrictions.previous') }}
      </UButton>
      <strong>{{ format(monthStart, 'short') }}</strong>
      <UButton
        variant="outline"
        @click="shiftMonth(1)"
      >
        {{ t('restrictions.next') }}
      </UButton>
    </div>

    <p
      v-if="!canManage"
      class="notice"
    >
      {{ t('restrictions.readOnly') }}
    </p>

    <div
      class="night-scroll"
      :style="{ '--cols': days.length }"
    >
      <div class="night-row night-head">
        <div class="night-label">
          {{ t('restrictions.type') }}
        </div>
        <div
          v-for="day in days"
          :key="day"
          class="night-cell night-meta"
        >
          {{ format(day, 'short') }}
        </div>
      </div>
      <div
        v-for="type in roomTypes"
        :key="type.id"
        class="night-row"
      >
        <div class="night-label">
          {{ type.name }}
        </div>
        <div
          v-for="day in days"
          :key="`${type.id}-${day}`"
          class="night-cell night-meta"
        >
          {{ restrictionMarks(winningRestriction(rows, day, type.id)) || t('restrictions.open') }}
        </div>
      </div>
    </div>

    <form
      class="stack night-editor"
      @submit.prevent="save"
    >
      <h3>{{ t('restrictions.editor') }}</h3>
      <p class="notice">
        {{ typeIds.length === 0 ? t('restrictions.propertyWide') : t('restrictions.typed') }}
      </p>
      <fieldset :disabled="!canManage">
        <div class="night-editor-grid">
          <UFormField :label="t('restrictions.from')">
            <UInput
              v-model="editFrom"
              type="date"
              class="w-full"
            />
          </UFormField>
          <UFormField :label="t('restrictions.to')">
            <UInput
              v-model="editTo"
              type="date"
              class="w-full"
            />
          </UFormField>
        </div>
        <div class="fchips">
          <button
            v-for="day in WEEKDAYS"
            :key="day"
            type="button"
            class="fchip"
            :class="{ on: weekdays.includes(day) }"
            @click="toggleWeekday(day)"
          >
            {{ t(`restrictions.weekdays.${day}`) }}
          </button>
        </div>
        <div class="fchips">
          <button
            v-for="type in roomTypes"
            :key="type.id"
            type="button"
            class="fchip"
            :class="{ on: typeIds.includes(type.id) }"
            @click="toggleType(type.id)"
          >
            {{ type.name }}
          </button>
        </div>
        <UFormField :label="t('restrictions.stopSell')">
          <USelect
            v-model="stopSell"
            :items="[
              { value: 'omit', label: t('restrictions.leave') },
              { value: 'yes', label: t('restrictions.yes') },
              { value: 'no', label: t('restrictions.no') }
            ]"
            class="w-full"
          />
        </UFormField>
        <UFormField :label="t('restrictions.cta')">
          <USelect
            v-model="closedToArrival"
            :items="[
              { value: 'omit', label: t('restrictions.leave') },
              { value: 'yes', label: t('restrictions.yes') },
              { value: 'no', label: t('restrictions.no') }
            ]"
            class="w-full"
          />
        </UFormField>
        <UFormField :label="t('restrictions.ctd')">
          <USelect
            v-model="closedToDeparture"
            :items="[
              { value: 'omit', label: t('restrictions.leave') },
              { value: 'yes', label: t('restrictions.yes') },
              { value: 'no', label: t('restrictions.no') }
            ]"
            class="w-full"
          />
        </UFormField>
        <UFormField :label="t('restrictions.minStay')">
          <USelect
            v-model="minMode"
            :items="[
              { value: 'omit', label: t('restrictions.leave') },
              { value: 'set', label: t('restrictions.set') },
              { value: 'clear', label: t('restrictions.clear') }
            ]"
            class="w-full"
          />
        </UFormField>
        <UInput
          v-if="minMode === 'set'"
          v-model.number="minStay"
          type="number"
          :min="1"
        />
        <UFormField :label="t('restrictions.maxStay')">
          <USelect
            v-model="maxMode"
            :items="[
              { value: 'omit', label: t('restrictions.leave') },
              { value: 'set', label: t('restrictions.set') },
              { value: 'clear', label: t('restrictions.clear') }
            ]"
            class="w-full"
          />
        </UFormField>
        <UInput
          v-if="maxMode === 'set'"
          v-model.number="maxStay"
          type="number"
          :min="1"
        />
        <UFormField :label="t('restrictions.note')">
          <USelect
            v-model="noteMode"
            :items="[
              { value: 'omit', label: t('restrictions.leave') },
              { value: 'set', label: t('restrictions.set') },
              { value: 'clear', label: t('restrictions.clear') }
            ]"
            class="w-full"
          />
        </UFormField>
        <UTextarea
          v-if="noteMode === 'set'"
          v-model="note"
          :rows="2"
        />
        <UFormField :label="t('restrictions.reason')">
          <UTextarea
            v-model="reason"
            :rows="2"
          />
        </UFormField>
      </fieldset>
      <p
        v-if="conflict"
        class="field-error"
      >
        {{ conflict }}
      </p>
      <UButton
        v-if="canManage"
        type="submit"
        :loading="saving"
        :disabled="!canSubmit"
      >
        {{ t('restrictions.save') }}
      </UButton>
    </form>
  </div>
</template>
