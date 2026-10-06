<script setup lang="ts">
import type {
  BookingFormOptions,
  Contact,
  PreferredChannel,
  WaitlistEntry
} from '../../types/api'
import { firstApiMessage, applyApiFormError } from '../../utils/apiForm'
import { existingContactSelected } from '../bookings/newReservationHelpers'

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

const CONTACT_DEBOUNCE_MS = 300

const open = defineModel<boolean>('open', { required: true })

const emit = defineEmits<{
  created: [entry: WaitlistEntry]
}>()

const { t } = useI18n()
const { request } = useApi()
const toast = useToast()

const options = ref<BookingFormOptions | null>(null)
const properties = ref<Array<PropertyOption>>([])
const roomTypes = ref<Array<RoomTypeOption>>([])
const contacts = ref<Array<Contact>>([])
const selectedContact = ref<Contact | null>(null)
const loading = ref(false)
const submitting = ref(false)
const warn = ref('')
const fieldErrors = ref<Record<string, string>>({})

const propertyId = ref<number | null>(null)
const roomTypeId = ref<number | null>(null)
const checkIn = ref('')
const checkOut = ref('')
const guestName = ref('')
const email = ref('')
const phone = ref('')
const preferred = ref<PreferredChannel>('EMAIL')
const adults = ref(2)
const children = ref(0)
const notes = ref('')

let contactTimer: ReturnType<typeof setTimeout> | undefined

const existingNotice = computed(() => {
  return selectedContact.value !== null && existingContactSelected(email.value, selectedContact.value.email)
})

const propertyItems = computed(() => [
  { label: t('holds.property'), value: null as number | null },
  ...properties.value.map(row => ({
    label: `${row.code} · ${row.name}`,
    value: row.id
  }))
])

const roomTypeItems = computed(() => [
  { label: t('holds.cabinType'), value: null as number | null },
  ...roomTypes.value.map(row => ({
    label: `${row.code} · ${row.name}`,
    value: row.id
  }))
])

const preferredItems = computed(() => (options.value?.preferred ?? []).map(item => ({
  label: item.label,
  value: item.value as PreferredChannel
})))

function reset(): void {
  propertyId.value = null
  roomTypeId.value = null
  checkIn.value = ''
  checkOut.value = ''
  roomTypes.value = []
  guestName.value = ''
  email.value = ''
  phone.value = ''
  preferred.value = 'EMAIL'
  adults.value = 2
  children.value = 0
  notes.value = ''
  selectedContact.value = null
  contacts.value = []
  warn.value = ''
  fieldErrors.value = {}
}

async function loadOptions(): Promise<void> {
  options.value = await request('/api/rms/bookings/form-options') as BookingFormOptions
}

async function loadProperties(): Promise<void> {
  const result = await request('/api/rms/properties') as { data: Array<PropertyOption> }
  properties.value = result.data
}

async function loadRoomTypes(id: number): Promise<void> {
  const result = await request(`/api/rms/properties/${id}/room-types`) as { data: Array<RoomTypeOption> }
  roomTypes.value = result.data
}

async function searchContacts(query: string): Promise<void> {
  const q = query.trim()

  if (q === '') {
    contacts.value = []
    return
  }

  const result = await request(`/api/rms/contacts?q=${encodeURIComponent(q)}`) as { data: Array<Contact> }
  contacts.value = result.data
}

function onEmailInput(value: string): void {
  email.value = value

  if (selectedContact.value !== null && !existingContactSelected(value, selectedContact.value.email)) {
    selectedContact.value = null
  }

  clearTimeout(contactTimer)
  contactTimer = setTimeout(() => {
    void searchContacts(value)
  }, CONTACT_DEBOUNCE_MS)
}

function pickContact(contact: Contact): void {
  selectedContact.value = contact
  guestName.value = contact.name
  email.value = contact.email ?? ''
  phone.value = contact.phone ?? ''
  preferred.value = contact.preferred_channel as PreferredChannel
  contacts.value = []
}

async function onSubmit(): Promise<void> {
  if (roomTypeId.value === null || checkIn.value === '' || checkOut.value === '' || guestName.value.trim() === '') {
    return
  }

  submitting.value = true
  warn.value = ''
  fieldErrors.value = {}

  try {
    const created = await request('/api/rms/waitlist', {
      method: 'POST',
      body: {
        room_type_id: roomTypeId.value,
        check_in: checkIn.value,
        check_out: checkOut.value,
        client: {
          name: guestName.value.trim(),
          email: email.value.trim() === '' ? null : email.value.trim(),
          phone: phone.value.trim() === '' ? null : phone.value.trim(),
          preferred_channel: preferred.value
        },
        adults: adults.value,
        children: children.value,
        notes: notes.value.trim() === '' ? null : notes.value.trim()
      }
    }) as WaitlistEntry

    toast.add({ title: t('holds.addedToast') })
    open.value = false
    emit('created', created)
  } catch (error: unknown) {
    const handled = applyApiFormError(error, (fields, conflict) => {
      fieldErrors.value = fields
      if (conflict !== '') {
        warn.value = conflict
      }
    })

    if (!handled || warn.value === '') {
      warn.value = firstApiMessage(error) ?? (error instanceof Error ? error.message : '')
    }
  } finally {
    submitting.value = false
  }
}

watch(propertyId, (id) => {
  roomTypeId.value = null
  roomTypes.value = []

  if (id === null) {
    return
  }

  void loadRoomTypes(id).catch((error: unknown) => {
    warn.value = firstApiMessage(error) ?? (error instanceof Error ? error.message : '')
  })
})

watch(open, async (isOpen) => {
  if (!isOpen) {
    return
  }

  reset()
  loading.value = true

  try {
    await Promise.all([loadOptions(), loadProperties()])
  } catch (error: unknown) {
    warn.value = firstApiMessage(error) ?? (error instanceof Error ? error.message : '')
  } finally {
    loading.value = false
  }
})

onUnmounted(() => {
  clearTimeout(contactTimer)
})
</script>

<template>
  <UModal
    :open="open"
    :title="t('holds.addTitle')"
    @update:open="open = $event"
  >
    <template #body>
      <form
        class="modal-form"
        @submit.prevent="onSubmit"
      >
        <div
          v-if="warn"
          class="warnbox"
        >
          {{ warn }}
        </div>
        <div class="field">
          <label>{{ t('holds.property') }}</label>
          <USelect
            v-model="propertyId"
            :items="propertyItems"
            :disabled="loading"
            class="w-full"
          />
        </div>
        <div class="field">
          <label>{{ t('holds.cabinType') }}</label>
          <USelect
            v-model="roomTypeId"
            :items="roomTypeItems"
            :disabled="propertyId === null"
            class="w-full"
          />
        </div>
        <div class="cols2">
          <div class="field">
            <label>{{ t('holds.checkIn') }}</label>
            <input
              v-model="checkIn"
              type="date"
            >
          </div>
          <div class="field">
            <label>{{ t('holds.checkOut') }}</label>
            <input
              v-model="checkOut"
              type="date"
            >
          </div>
        </div>
        <div class="cols2">
          <div class="field">
            <label>{{ t('bookings.guestName') }}</label>
            <input
              v-model="guestName"
              type="text"
              :placeholder="t('bookings.guestPlaceholder')"
            >
            <p
              v-if="fieldErrors['client.name']"
              class="field-hint"
            >
              {{ fieldErrors['client.name'] }}
            </p>
          </div>
          <div class="field">
            <label>{{ t('bookings.email') }}</label>
            <input
              :value="email"
              type="email"
              autocomplete="off"
              @input="onEmailInput(($event.target as HTMLInputElement).value)"
            >
            <div
              v-if="contacts.length > 0"
              class="nb-suggest"
            >
              <button
                v-for="contact in contacts"
                :key="contact.id"
                type="button"
                class="nb-suggest-item"
                @click="pickContact(contact)"
              >
                {{ contact.name }}{{ contact.email ? ` · ${contact.email}` : '' }}
              </button>
            </div>
          </div>
        </div>
        <p
          v-if="existingNotice"
          class="notice"
        >
          {{ t('bookings.existingContact') }}
        </p>
        <div class="cols2">
          <div class="field">
            <label>{{ t('bookings.phone') }}</label>
            <input
              v-model="phone"
              type="text"
            >
          </div>
          <div class="field">
            <label>{{ t('bookings.preferredChannel') }}</label>
            <USelect
              v-model="preferred"
              :items="preferredItems"
              class="w-full"
            />
          </div>
        </div>
        <div class="cols2">
          <div class="field">
            <label>{{ t('bookings.adults') }}</label>
            <input
              v-model.number="adults"
              type="number"
              min="1"
            >
          </div>
          <div class="field">
            <label>{{ t('bookings.children') }}</label>
            <input
              v-model.number="children"
              type="number"
              min="0"
            >
          </div>
        </div>
        <div class="field">
          <label>{{ t('holds.notes') }}</label>
          <textarea
            v-model="notes"
            rows="3"
          />
        </div>
        <div class="modal-actions">
          <UButton
            variant="outline"
            :disabled="submitting"
            @click="open = false"
          >
            {{ t('bookings.cancel') }}
          </UButton>
          <UButton
            type="submit"
            :loading="submitting"
            :disabled="submitting || roomTypeId === null || checkIn === '' || checkOut === '' || guestName.trim() === ''"
          >
            {{ t('holds.addSubmit') }}
          </UButton>
        </div>
      </form>
    </template>
  </UModal>
</template>
