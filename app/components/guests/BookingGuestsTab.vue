<script setup lang="ts">
import type {
  Booking,
  BookingConsent,
  ConsentDocument,
  ConsentSource,
  Country,
  Guest,
  GuestListSummary
} from '../../types/api'
import { applyApiFormError, firstApiMessage, type FormFieldErrors } from '../../utils/apiForm'
import { confirmUnsaved } from '../../composables/useUnsavedGuard'
import { galapagosTodayIso } from '../bookings/bookingHelpers'
import ReasonModal from '../bookings/ReasonModal.vue'
import {
  consentRowState,
  guestDisplayName,
  issueIcon,
  showGuardianBlock
} from './guestHelpers'

const props = defineProps<{
  booking: Booking
}>()

const emit = defineEmits<{
  updated: [booking?: Booking]
}>()

type GuestForm = {
  first_name: string
  last_name: string
  dob: string | null
  nationality: string
  ecuador_resident: boolean
  passport_no: string
  passport_expiry: string | null
  email: string
  insurance_declared: boolean
  medical_note: string
  dietary_note: string
  accessibility_note: string
  guardian_name: string
  guardian_relationship: string
  guardian_consented: boolean
}

type GuestsIndex = GuestListSummary & { data: Array<Guest> }

const { t } = useI18n()
const { can } = useAuth()
const { request } = useApi()
const { format } = useDates()
const { format: money } = useMoney()
const toast = useToast()

const canViewSensitive = computed(() => can('guests.view_sensitive'))
const canAct = computed(() => props.booking.can_act)

const guests = ref<Array<Guest>>([])
const summary = ref<GuestListSummary>(emptySummary())
const consents = ref<Array<BookingConsent>>([])
const countries = ref<Array<Country>>([])
const loading = ref(false)
const loadError = ref('')

const editingId = ref<number | null>(null)
const form = ref<GuestForm>(blankForm())
const snapshot = ref('')
const fieldErrors = ref<FormFieldErrors>({})
const formError = ref('')
const submitting = ref(false)

const consentOpen = ref(false)
const consentDocument = ref<ConsentDocument | null>(null)
const consentLabel = ref('')
const consentError = ref('')
const consentSubmitting = ref(false)

const todayIso = computed(() => {
  return galapagosTodayIso(new Date(), (value, style, options) => format(value, style, options))
})

const dirty = computed(() => JSON.stringify(form.value) !== snapshot.value)
const guardianPreview = computed(() => showGuardianBlock(form.value.dob ?? '', todayIso.value))
const nationalityItems = computed(() => [
  { label: t('bookings.nationalityNone'), value: '' },
  ...countries.value.map(item => ({
    label: item.name,
    value: item.code
  }))
])
const pngSub = computed(() => {
  const pending = summary.value.png_pending_count

  if (pending > 0) {
    return pending === 1
      ? t('bookings.pngPendingOne')
      : t('bookings.pngPendingMany', { n: String(pending) })
  }

  return ''
})

function emptySummary(): GuestListSummary {
  return {
    complete_count: 0,
    total: 0,
    png_known_total: 0,
    png_pending_count: 0,
    max: 0,
    can_add: false,
    issues: []
  }
}

function blankForm(): GuestForm {
  return {
    first_name: '',
    last_name: '',
    dob: null,
    nationality: '',
    ecuador_resident: false,
    passport_no: '',
    passport_expiry: null,
    email: '',
    insurance_declared: false,
    medical_note: '',
    dietary_note: '',
    accessibility_note: '',
    guardian_name: '',
    guardian_relationship: '',
    guardian_consented: false
  }
}

function countryName(code: string | null): string {
  if (code === null || code === '') {
    return ''
  }

  return countries.value.find(item => item.code === code)?.name ?? code
}

function sourceLabel(source: ConsentSource): string {
  if (source === 'ENGINE') {
    return t('bookings.consentSourceEngine')
  }

  if (source === 'PAYMENT_LINK') {
    return t('bookings.consentSourcePaymentLink')
  }

  return t('bookings.consentSourceStaff')
}

function consentSourceText(row: BookingConsent): string {
  if (row.consent === null) {
    return ''
  }

  const parts: Array<string> = [sourceLabel(row.consent.source)]

  if (row.consent.how_obtained !== null && row.consent.how_obtained !== '') {
    parts.push(row.consent.how_obtained)
  }

  let text = parts.join(' — ')

  if (row.consent.ip !== null && row.consent.ip !== '') {
    text += t('bookings.consentIp', { ip: row.consent.ip })
  }

  return text
}

function canRemove(guest: Guest): boolean {
  return !guest.is_lead && guest.first_name === '' && guest.last_name === ''
}

async function loadGuests(): Promise<void> {
  const result = await request(`/api/rms/bookings/${props.booking.id}/guests`) as GuestsIndex
  const { data, ...rest } = result
  guests.value = data
  summary.value = rest
}

async function loadConsents(): Promise<void> {
  const result = await request(`/api/rms/bookings/${props.booking.id}/consents`) as { data: Array<BookingConsent> }
  consents.value = result.data
}

async function loadCountries(): Promise<void> {
  if (countries.value.length > 0) {
    return
  }

  countries.value = await request('/api/rms/countries') as Array<Country>
}

async function loadAll(): Promise<void> {
  loading.value = true
  loadError.value = ''

  try {
    await Promise.all([loadGuests(), loadConsents(), loadCountries()])
  } catch (error: unknown) {
    loadError.value = firstApiMessage(error) ?? (error instanceof Error ? error.message : t('bookings.guestsFailed'))
  } finally {
    loading.value = false
  }
}

async function afterWrite(): Promise<void> {
  await loadGuests()
  await loadConsents()
  emit('updated')
}

onMounted(() => {
  void loadAll()
})

watch(() => props.booking.id, () => {
  editingId.value = null
  void loadAll()
})

function startEdit(guest: Guest): void {
  if (editingId.value !== null && dirty.value && !confirmUnsaved(t('bookings.leaveUnsaved'))) {
    return
  }

  form.value = {
    first_name: guest.first_name,
    last_name: guest.last_name,
    dob: guest.dob ?? null,
    nationality: guest.nationality ?? '',
    ecuador_resident: guest.ecuador_resident,
    passport_no: canViewSensitive.value ? (guest.passport_no ?? '') : '',
    passport_expiry: guest.passport_expiry ?? null,
    email: guest.email ?? '',
    insurance_declared: guest.insurance_declared,
    medical_note: guest.medical_note.value ?? '',
    dietary_note: guest.dietary_note.value ?? '',
    accessibility_note: guest.accessibility_note.value ?? '',
    guardian_name: guest.guardian?.name ?? '',
    guardian_relationship: guest.guardian?.relationship ?? '',
    guardian_consented: guest.guardian?.consented_at !== null && guest.guardian?.consented_at !== undefined
  }
  snapshot.value = JSON.stringify(form.value)
  fieldErrors.value = {}
  formError.value = ''
  editingId.value = guest.id
}

function cancelEdit(): void {
  if (dirty.value && !confirmUnsaved(t('bookings.leaveUnsaved'))) {
    return
  }

  editingId.value = null
}

function payload(): Record<string, unknown> {
  const body: Record<string, unknown> = {
    first_name: form.value.first_name,
    last_name: form.value.last_name,
    dob: form.value.dob === null || form.value.dob === '' ? null : form.value.dob,
    nationality: form.value.nationality === '' ? null : form.value.nationality,
    ecuador_resident: form.value.ecuador_resident,
    passport_no: form.value.passport_no,
    passport_expiry: form.value.passport_expiry === null || form.value.passport_expiry === '' ? null : form.value.passport_expiry,
    email: form.value.email === '' ? null : form.value.email,
    insurance_declared: form.value.insurance_declared
  }

  if (canViewSensitive.value) {
    body.medical_note = form.value.medical_note === '' ? null : form.value.medical_note
    body.dietary_note = form.value.dietary_note === '' ? null : form.value.dietary_note
    body.accessibility_note = form.value.accessibility_note === '' ? null : form.value.accessibility_note
  }

  if (guardianPreview.value) {
    body.guardian_name = form.value.guardian_name === '' ? null : form.value.guardian_name
    body.guardian_relationship = form.value.guardian_relationship === '' ? null : form.value.guardian_relationship
    body.guardian_consented = form.value.guardian_consented
  }

  return body
}

async function saveGuest(): Promise<void> {
  if (editingId.value === null || !canAct.value) {
    return
  }

  submitting.value = true
  fieldErrors.value = {}
  formError.value = ''

  try {
    await request(`/api/rms/guests/${editingId.value}`, {
      method: 'PATCH',
      body: payload()
    })
    toast.add({ title: t('bookings.guestSavedToast') })
    editingId.value = null
    await afterWrite()
  } catch (error: unknown) {
    if (!applyApiFormError(error, (fields, conflict) => {
      fieldErrors.value = fields
      formError.value = conflict
    })) {
      formError.value = firstApiMessage(error) ?? (error instanceof Error ? error.message : '')
    }
  } finally {
    submitting.value = false
  }
}

async function addGuest(): Promise<void> {
  if (!canAct.value || !summary.value.can_add) {
    return
  }

  if (editingId.value !== null && dirty.value && !confirmUnsaved(t('bookings.leaveUnsaved'))) {
    return
  }

  submitting.value = true
  formError.value = ''

  try {
    const created = await request(`/api/rms/bookings/${props.booking.id}/guests`, {
      method: 'POST',
      body: {}
    }) as Guest
    toast.add({ title: t('bookings.guestAddedToast') })
    await afterWrite()
    startEdit(created)
  } catch (error: unknown) {
    formError.value = firstApiMessage(error) ?? (error instanceof Error ? error.message : '')
  } finally {
    submitting.value = false
  }
}

async function removeGuest(guest: Guest): Promise<void> {
  if (!canAct.value || !canRemove(guest)) {
    return
  }

  submitting.value = true
  formError.value = ''

  try {
    await request(`/api/rms/guests/${guest.id}`, { method: 'DELETE' })
    toast.add({ title: t('bookings.guestRemovedToast') })
    editingId.value = null
    await afterWrite()
  } catch (error: unknown) {
    formError.value = firstApiMessage(error) ?? (error instanceof Error ? error.message : '')
  } finally {
    submitting.value = false
  }
}

function startConsent(row: BookingConsent): void {
  consentDocument.value = row.document
  consentLabel.value = row.label
  consentError.value = ''
  consentOpen.value = true
}

async function submitConsent(how: string): Promise<void> {
  if (consentDocument.value === null || !canAct.value) {
    return
  }

  consentSubmitting.value = true
  consentError.value = ''

  try {
    await request(`/api/rms/bookings/${props.booking.id}/consents`, {
      method: 'POST',
      body: { document: consentDocument.value, how_obtained: how }
    })
    toast.add({ title: t('bookings.consentRecordedToast') })
    consentOpen.value = false
    await afterWrite()
  } catch (error: unknown) {
    consentError.value = firstApiMessage(error) ?? (error instanceof Error ? error.message : '')
  } finally {
    consentSubmitting.value = false
  }
}
</script>

<template>
  <div>
    <p class="note">
      {{ t('bookings.privacyNote') }}
    </p>

    <div class="krow">
      <AnkKpi
        :label="t('bookings.completeKpi')"
        :sub="t('bookings.completeSub')"
      >
        {{ summary.complete_count }}/{{ summary.total }}
      </AnkKpi>
      <AnkKpi
        :label="t('bookings.pngKpi')"
        :sub="pngSub"
      >
        {{ money(summary.png_known_total) }}
      </AnkKpi>
    </div>

    <div
      v-if="summary.issues.length > 0"
      class="warnbox"
    >
      <p
        v-for="(item, index) in summary.issues"
        :key="`${item.code}-${item.guest_id ?? 'booking'}-${index}`"
      >
        {{ issueIcon(item.severity) }} {{ item.message }}
      </p>
    </div>

    <p
      v-if="loading && guests.length === 0"
      class="note"
    >
      {{ t('bookings.guestsLoading') }}
    </p>
    <div
      v-else-if="loadError"
      class="warnbox"
    >
      {{ loadError }}
    </div>

    <div
      v-if="formError && editingId === null"
      class="warnbox"
    >
      {{ formError }}
    </div>

    <template
      v-for="guest in guests"
      :key="guest.id"
    >
      <div
        v-if="editingId === guest.id"
        class="gcard gcard-edit"
      >
        <div class="gf-head">
          {{ t('bookings.editHeading', { name: guestDisplayName(guest).toUpperCase() }) }}
        </div>
        <div
          v-if="formError"
          class="warnbox"
        >
          {{ formError }}
        </div>
        <div class="cols2">
          <div class="field">
            <label for="gf-first">{{ t('bookings.firstName') }}</label>
            <input
              id="gf-first"
              v-model="form.first_name"
            >
            <p
              v-if="fieldErrors.first_name"
              class="pline-err"
            >
              {{ fieldErrors.first_name }}
            </p>
          </div>
          <div class="field">
            <label for="gf-last">{{ t('bookings.lastName') }}</label>
            <input
              id="gf-last"
              v-model="form.last_name"
            >
            <p
              v-if="fieldErrors.last_name"
              class="pline-err"
            >
              {{ fieldErrors.last_name }}
            </p>
          </div>
        </div>
        <div class="cols2">
          <div class="field">
            <label for="gf-dob">{{ t('bookings.dateOfBirth') }}</label>
            <AnkDateInput
              id="gf-dob"
              v-model="form.dob"
            />
            <p
              v-if="fieldErrors.dob"
              class="pline-err"
            >
              {{ fieldErrors.dob }}
            </p>
          </div>
          <div class="field">
            <label for="gf-nat">{{ t('bookings.nationality') }}</label>
            <USelect
              id="gf-nat"
              v-model="form.nationality"
              class="w-full"
              :items="nationalityItems"
            />
            <p
              v-if="fieldErrors.nationality"
              class="pline-err"
            >
              {{ fieldErrors.nationality }}
            </p>
          </div>
        </div>
        <label class="chkline">
          <input
            v-model="form.ecuador_resident"
            type="checkbox"
          >
          {{ t('bookings.ecuadorResident') }}
        </label>
        <div class="cols2">
          <div class="field">
            <label for="gf-pp">{{ t('bookings.passportNumber') }}</label>
            <input
              id="gf-pp"
              v-model="form.passport_no"
              :placeholder="canViewSensitive ? '' : t('bookings.passportRestricted')"
              autocomplete="off"
            >
            <p
              v-if="!canViewSensitive"
              class="gf-hint"
            >
              {{ t('bookings.passportRestrictedHint') }}
            </p>
            <p
              v-if="fieldErrors.passport_no"
              class="pline-err"
            >
              {{ fieldErrors.passport_no }}
            </p>
          </div>
          <div class="field">
            <label for="gf-exp">{{ t('bookings.passportExpiryLabel') }}</label>
            <AnkDateInput
              id="gf-exp"
              v-model="form.passport_expiry"
            />
            <p
              v-if="fieldErrors.passport_expiry"
              class="pline-err"
            >
              {{ fieldErrors.passport_expiry }}
            </p>
          </div>
        </div>
        <div class="field">
          <label for="gf-email">{{ t('bookings.guestEmail') }}</label>
          <input
            id="gf-email"
            v-model="form.email"
          >
          <p
            v-if="fieldErrors.email"
            class="pline-err"
          >
            {{ fieldErrors.email }}
          </p>
        </div>
        <label class="chkline">
          <input
            v-model="form.insurance_declared"
            type="checkbox"
          >
          {{ t('bookings.insuranceDeclaredCheck') }}
        </label>
        <div v-if="guardianPreview">
          <div class="gf-guard">
            {{ t('bookings.guardianHeading') }}
          </div>
          <div class="cols2">
            <div class="field">
              <label for="gf-gn">{{ t('bookings.guardianName') }}</label>
              <input
                id="gf-gn"
                v-model="form.guardian_name"
              >
              <p
                v-if="fieldErrors.guardian_name"
                class="pline-err"
              >
                {{ fieldErrors.guardian_name }}
              </p>
            </div>
            <div class="field">
              <label for="gf-gr">{{ t('bookings.guardianRelationship') }}</label>
              <input
                id="gf-gr"
                v-model="form.guardian_relationship"
              >
            </div>
          </div>
          <label class="chkline">
            <input
              v-model="form.guardian_consented"
              type="checkbox"
            >
            {{ t('bookings.guardianConsented') }}
          </label>
        </div>
        <template v-if="canViewSensitive">
          <div class="field">
            <label for="gf-med">{{ t('bookings.medicalNote') }}</label>
            <textarea
              id="gf-med"
              v-model="form.medical_note"
              rows="2"
            />
          </div>
          <div class="field">
            <label for="gf-diet">{{ t('bookings.dietaryNote') }}</label>
            <textarea
              id="gf-diet"
              v-model="form.dietary_note"
              rows="2"
            />
          </div>
          <div class="field">
            <label for="gf-access">{{ t('bookings.accessibilityNote') }}</label>
            <textarea
              id="gf-access"
              v-model="form.accessibility_note"
              rows="2"
            />
          </div>
        </template>
        <div class="transbtns">
          <UButton
            :loading="submitting"
            :disabled="submitting"
            @click="saveGuest"
          >
            {{ t('bookings.saveGuest') }}
          </UButton>
          <UButton
            variant="outline"
            :disabled="submitting"
            @click="cancelEdit"
          >
            {{ t('bookings.cancel') }}
          </UButton>
          <UButton
            v-if="canRemove(guest)"
            variant="outline"
            :disabled="submitting"
            @click="removeGuest(guest)"
          >
            {{ t('bookings.removeGuest') }}
          </UButton>
        </div>
      </div>
      <div
        v-else
        class="gcard"
        :class="{ 'gcard-inc': !guest.complete }"
      >
        <div class="gtop">
          <div>
            <b>{{ guestDisplayName(guest) }}</b>
            <span
              v-if="guest.is_lead"
              class="pill"
            >{{ t('bookings.leadPill') }}</span>
            <span
              v-if="guest.is_minor_now"
              class="pill p-hold"
            >{{ t('bookings.minorPill') }}</span>
            <div class="gmeta">
              {{ guest.age_at_departure === null
                ? t('bookings.dobPending')
                : t('bookings.yearsOnDeparture', { age: String(guest.age_at_departure) }) }}
              ·
              {{ guest.nationality
                ? countryName(guest.nationality) + (guest.ecuador_resident ? t('bookings.ecResident') : '')
                : t('bookings.nationalityPending') }}
              ·
              {{ t('bookings.passportLabel', { number: guest.passport_no ?? '—' }) }}{{ guest.passport_expiry
                ? t('bookings.passportExpiry', { date: format(guest.passport_expiry, 'short') })
                : '' }}
            </div>
            <div class="gmeta">
              {{ t('bookings.pngKpi') }}{{ guest.png_fee !== null
                ? t('bookings.pngFee', { amount: money(guest.png_fee) })
                : '' }}
              ·
              <span :class="guest.insurance_declared ? 'guests-ok' : 'guests-miss'">
                {{ guest.insurance_declared ? t('bookings.insuranceDeclared') : t('bookings.insuranceMissing') }}
              </span>
              <template v-if="guest.is_minor_now">
                ·
                <span :class="guest.guardian?.consented_at ? 'guests-ok' : 'guests-miss'">
                  {{ guest.guardian?.consented_at
                    ? t('bookings.guardianOk', { name: guest.guardian.name ?? '' })
                    : t('bookings.guardianMissing') }}
                </span>
              </template>
            </div>
            <div
              v-if="guest.medical_note.on_file && guest.medical_note.value === null"
              class="gmeta"
            >
              <span class="guests-miss">{{ t('bookings.medicalOnFile') }}</span>
            </div>
          </div>
          <UButton
            v-if="canAct"
            variant="outline"
            @click="startEdit(guest)"
          >
            {{ t('bookings.editGuest') }}
          </UButton>
        </div>
      </div>
    </template>

    <UButton
      v-if="canAct && summary.can_add"
      variant="outline"
      :disabled="submitting"
      @click="addGuest"
    >
      {{ t('bookings.addGuest') }}
    </UButton>

    <div class="sec">
      <h4>{{ t('bookings.consentsTitle') }}</h4>
      <table class="list mini-t">
        <thead>
          <tr>
            <th>{{ t('bookings.consentDocument') }}</th>
            <th>{{ t('bookings.consentVersion') }}</th>
            <th>{{ t('bookings.consentAccepted') }}</th>
            <th>{{ t('bookings.consentSource') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="row in consents"
            :key="row.document"
          >
            <td>{{ row.label }}</td>
            <td>
              <template v-if="row.consent">
                {{ row.consent.version }}
                <span
                  v-if="row.outdated"
                  class="guests-muted"
                > ({{ t('bookings.consentOutdated') }})</span>
              </template>
              <template v-else>
                —
              </template>
            </td>
            <td>
              <template v-if="row.consent">
                {{ format(row.consent.accepted_at, 'dateTime') }}
              </template>
              <span
                v-else
                :class="consentRowState(row) === 'missing' ? 'guests-miss' : 'guests-muted'"
              >
                {{ consentRowState(row) === 'missing' ? t('bookings.consentMissing') : t('bookings.consentNotGiven') }}
              </span>
            </td>
            <td>
              <template v-if="row.consent">
                {{ consentSourceText(row) }}
              </template>
              <button
                v-else-if="canAct"
                type="button"
                class="mini"
                @click="startConsent(row)"
              >
                {{ t('bookings.consentRecord') }}
              </button>
            </td>
          </tr>
        </tbody>
      </table>
      <p class="guests-footnote">
        {{ t('bookings.consentFootnote') }}
      </p>
    </div>

    <ReasonModal
      v-model:open="consentOpen"
      :title="t('bookings.consentRecordTitle', { document: consentLabel })"
      :label="t('bookings.consentHow')"
      hint="required"
      :submitting="consentSubmitting"
      :error="consentError"
      @submit="submitConsent"
    />
  </div>
</template>
