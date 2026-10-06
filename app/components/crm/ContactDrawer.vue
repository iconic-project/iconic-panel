<script setup lang="ts">
import type {
  AgencyListItem,
  ConsentPurpose,
  ContactConsentEntry,
  ContactConsentState,
  ContactMerge,
  ContactProfile,
  ContactType,
  ContactUnmergeResult,
  CrmTask,
  JourneyEnrolment,
  Paginated,
  PreferredChannel,
  RecordConsentInput,
  TimelineItem
} from '../../types/api'
import { ApiError } from '#imports'
import type { FormFieldErrors } from '../../utils/apiForm'
import { applyApiFormError, firstApiMessage } from '../../utils/apiForm'
import { statusLabel } from '../bookings/bookingHelpers'
import ReasonModal from '../bookings/ReasonModal.vue'
import JourneyEnrolmentDetail from './JourneyEnrolmentDetail.vue'
import LogActivityModal from './LogActivityModal.vue'
import { consentStateLabel } from './privacyHelpers'
import { relativeDue, taskPriorityClass } from './salesHelpers'
import {
  filterLabel,
  formatAttribution,
  isUndoWindowOpen,
  matchMergeForTimeline,
  matchPartnerByEmail,
  emailConflictId,
  parseEmailConflictContactId,
  segmentPillClass,
  shouldLookupPartner
} from './contactHelpers'

const open = defineModel<boolean>('open', { required: true })

const props = defineProps<{
  profile: ContactProfile | null
  typeOptions: Array<{ value: string, label: string }>
  lifecycleOptions: Array<{ value: string, label: string }>
}>()

const emit = defineEmits<{
  updated: [profile: ContactProfile]
  reviewMerge: [currentId: number, otherId: number]
  openContact: [id: number]
  undone: []
}>()

const CHANNELS: Array<PreferredChannel> = ['EMAIL', 'WHATSAPP', 'PHONE']
const CONSENT_PURPOSES: Array<ConsentPurpose> = ['MARKETING', 'PROFILING', 'REMARKETING', 'WHATSAPP', 'ANALYTICS']

const { t } = useI18n()
const { can } = useAuth()
const { request } = useApi()
const { format } = useDates()
const { format: money } = useMoney()
const toast = useToast()

const name = ref('')
const email = ref('')
const phone = ref('')
const country = ref('')
const language = ref('')
const preferredChannel = ref<PreferredChannel>('EMAIL')
const type = ref<ContactType>('DIRECT_PASSENGER')
const fieldErrors = ref<FormFieldErrors>({})
const warn = ref('')
const conflictId = ref<number | null>(null)
const saving = ref(false)

const timelinePage = ref(1)
const timeline = ref<Paginated<TimelineItem> | null>(null)
const contactTasks = ref<Array<CrmTask>>([])
const activityOpen = ref(false)
const merges = ref<Array<ContactMerge>>([])
const partner = ref<AgencyListItem | null>(null)

const undoOpen = ref(false)
const undoTarget = ref<ContactMerge | null>(null)
const undoSubmitting = ref(false)
const undoError = ref('')

const canManage = computed(() => can('contacts.manage'))
const canRecordConsent = computed(() => can('consents.record'))
const consentCurrent = ref<Array<ContactConsentState>>([])
const consentHistory = ref<Array<ContactConsentEntry>>([])
const showConsentHistory = ref(false)
const recordOpen = ref(false)
const recordPurpose = ref<ConsentPurpose>('MARKETING')
const recordGranted = ref<'1' | '0'>('1')
const recordHow = ref('')
const recordVersion = ref('')
const recordError = ref('')
const recordSaving = ref(false)
const canMerge = computed(() => can('contacts.merge'))
const canRms = computed(() => can('panel.rms'))
const contactJourneys = ref<Array<JourneyEnrolment>>([])
const journeysError = ref('')

const items = computed(() => timeline.value?.data ?? [])
const timelineMeta = computed(() => timeline.value?.meta)

const purposeItems = computed(() => CONSENT_PURPOSES.map(purpose => ({
  label: purpose,
  value: purpose
})))

const grantedItems = computed(() => [
  { label: t('crmContacts.consentOptedIn'), value: '1' as const },
  { label: t('crmContacts.consentWithdrawn'), value: '0' as const }
])

const channelItems = computed(() => CHANNELS.map(channel => ({
  label: channelLabel(channel),
  value: channel
})))

const contactTypeItems = computed(() => props.typeOptions.map(option => ({
  label: option.label,
  value: option.value
})))

function channelLabel(value: string): string {
  if (value === 'EMAIL') {
    return t('crmContacts.channelEmail')
  }

  if (value === 'WHATSAPP') {
    return t('crmContacts.channelWhatsapp')
  }

  if (value === 'PHONE') {
    return t('crmContacts.channelPhone')
  }

  return value
}

function applyProfile(profile: ContactProfile): void {
  name.value = profile.name
  email.value = profile.email ?? ''
  phone.value = profile.phone ?? ''
  country.value = profile.country ?? ''
  language.value = profile.language
  preferredChannel.value = profile.preferred_channel as PreferredChannel
  type.value = profile.type
  fieldErrors.value = {}
  warn.value = ''
  conflictId.value = null
}

async function loadTimeline(id: number): Promise<void> {
  const params = new URLSearchParams({
    page: String(timelinePage.value),
    per_page: '50'
  })

  timeline.value = await request(`/api/crm/contacts/${String(id)}/timeline?${params.toString()}`) as Paginated<TimelineItem>
}

async function loadMerges(): Promise<void> {
  if (!canMerge.value) {
    merges.value = []
    return
  }

  const all: Array<ContactMerge> = []
  let page = 1
  let last = 1

  while (page <= last) {
    const result = await request(`/api/crm/contact-merges?page=${String(page)}`) as Paginated<ContactMerge>
    all.push(...result.data)
    last = result.meta.last_page
    page += 1
  }

  merges.value = all
}

async function loadPartner(profile: ContactProfile): Promise<void> {
  partner.value = null

  if (!canRms.value || !shouldLookupPartner(profile.lifecycle, profile.type) || profile.email === null || profile.email === '') {
    return
  }

  const result = await request(`/api/rms/agencies?q=${encodeURIComponent(profile.email)}`) as { data: Array<AgencyListItem> }
  partner.value = matchPartnerByEmail(result.data, profile.email)
}

watch(
  () => [open.value, props.profile] as const,
  async ([isOpen, profile]) => {
    if (!isOpen || profile === null) {
      return
    }

    applyProfile(profile)
    timelinePage.value = 1
    showConsentHistory.value = false
    recordOpen.value = false
    await Promise.all([
      loadTimeline(profile.id),
      loadContactTasks(profile.id),
      loadMerges(),
      loadPartner(profile),
      loadConsents(profile.id),
      loadJourneys(profile.id)
    ])
  }
)

async function loadJourneys(id: number): Promise<void> {
  journeysError.value = ''

  try {
    const result = await request(`/api/crm/contacts/${String(id)}/journeys`) as { data: Array<JourneyEnrolment> }
    contactJourneys.value = result.data
  } catch (error: unknown) {
    contactJourneys.value = []
    journeysError.value = firstApiMessage(error) ?? t('crmJourneys.failed')
  }
}

async function loadConsents(contactId: number): Promise<void> {
  const payload = await request(`/api/crm/contacts/${String(contactId)}/consents`) as {
    current: Array<ContactConsentState>
    history: Array<ContactConsentEntry>
  }
  consentCurrent.value = payload.current
  consentHistory.value = payload.history
}

function consentPill(granted: boolean | null): string {
  if (granted === true) {
    return 'ok'
  }

  if (granted === false) {
    return 'bad'
  }

  return 'new'
}

async function recordConsent(): Promise<void> {
  if (props.profile === null || recordHow.value.trim() === '') {
    return
  }

  const body: RecordConsentInput = {
    purpose: recordPurpose.value,
    granted: recordGranted.value === '1',
    how_obtained: recordHow.value.trim()
  }

  if (recordVersion.value.trim() !== '') {
    body.version = recordVersion.value.trim()
  }

  recordSaving.value = true
  recordError.value = ''

  try {
    await request(`/api/crm/contacts/${String(props.profile.id)}/consents`, { method: 'POST', body })
    recordOpen.value = false
    recordHow.value = ''
    recordVersion.value = ''
    await loadConsents(props.profile.id)
    toast.add({ title: t('crmContacts.consentRecorded') })
  } catch (error: unknown) {
    recordError.value = firstApiMessage(error) ?? t('crmContacts.consentRecordFailed')
  } finally {
    recordSaving.value = false
  }
}

async function loadContactTasks(contactId: number): Promise<void> {
  const scopes = can('records.act_on_any') ? ['all'] : ['mine', 'unassigned']
  const pages = await Promise.all(scopes.map(scope =>
    request(`/api/crm/tasks?scope=${scope}&status=open`) as Promise<{ data: Array<CrmTask> }>
  ))
  const seen = new Set<number>()

  contactTasks.value = pages.flatMap(page => page.data).filter((task) => {
    if (task.contact?.id !== contactId || seen.has(task.id)) {
      return false
    }

    seen.add(task.id)
    return true
  })
}

async function onActivitySaved(): Promise<void> {
  if (props.profile === null) {
    return
  }

  await Promise.all([
    loadTimeline(props.profile.id),
    loadContactTasks(props.profile.id)
  ])
}

watch(timelinePage, async () => {
  if (props.profile !== null && open.value) {
    await loadTimeline(props.profile.id)
  }
})

async function save(): Promise<void> {
  if (props.profile === null) {
    return
  }

  saving.value = true
  fieldErrors.value = {}
  warn.value = ''
  conflictId.value = null

  try {
    const updated = await request(`/api/crm/contacts/${String(props.profile.id)}`, {
      method: 'PATCH',
      body: {
        name: name.value.trim(),
        email: email.value.trim() === '' ? null : email.value.trim(),
        phone: phone.value.trim() === '' ? null : phone.value.trim(),
        country: country.value.trim() === '' ? null : country.value.trim().toUpperCase(),
        language: language.value.trim().toLowerCase(),
        preferred_channel: preferredChannel.value,
        type: type.value
      }
    }) as ContactProfile

    applyProfile(updated)
    toast.add({ title: t('crmContacts.savedToast') })
    emit('updated', updated)
  } catch (error: unknown) {
    if (error instanceof ApiError && error.status === 409) {
      fieldErrors.value = {}
      warn.value = error.message
      conflictId.value = emailConflictId(error, error.message)
      return
    }

    if (!applyApiFormError(error, (fields, conflict) => {
      fieldErrors.value = fields
      warn.value = conflict
      conflictId.value = parseEmailConflictContactId(conflict)
    })) {
      warn.value = firstApiMessage(error) ?? (error instanceof Error ? error.message : '')
    }
  } finally {
    saving.value = false
  }
}

function reviewMerge(): void {
  if (props.profile === null || conflictId.value === null) {
    return
  }

  emit('reviewMerge', props.profile.id, conflictId.value)
}

function bookingHref(reference: string | null): string | null {
  if (reference === null || reference === '') {
    return null
  }

  return `/rms/reservations/bookings?open=${encodeURIComponent(reference)}`
}

function timelineHref(item: TimelineItem): string | null {
  if (item.link === null) {
    return null
  }

  if (item.link.type === 'booking') {
    return bookingHref(item.link.reference)
  }

  return null
}

function onTimelineContact(id: number): void {
  emit('openContact', id)
}

function mergeMatch(item: TimelineItem) {
  return matchMergeForTimeline(item.at, item.link?.id, merges.value)
}

function showUndo(item: TimelineItem): boolean {
  if (!canMerge.value || item.kind !== 'merge') {
    return false
  }

  const match = mergeMatch(item)

  if (match.kind === 'ambiguous') {
    return true
  }

  return match.kind === 'one' && isUndoWindowOpen(match.merge.merged_at)
}

function undoDisabled(item: TimelineItem): boolean {
  return mergeMatch(item).kind === 'ambiguous'
}

function startUndo(item: TimelineItem): void {
  const match = mergeMatch(item)

  if (match.kind !== 'one') {
    return
  }

  undoTarget.value = match.merge
  undoError.value = ''
  undoOpen.value = true
}

async function onUndo(reason: string): Promise<void> {
  if (undoTarget.value === null) {
    return
  }

  undoSubmitting.value = true
  undoError.value = ''

  try {
    const result = await request(`/api/crm/contact-merges/${String(undoTarget.value.id)}/undo`, {
      method: 'POST',
      body: { reason }
    }) as ContactUnmergeResult

    undoOpen.value = false
    toast.add({ title: t('crmContacts.undoneToast') })

    if (result.skipped_rows.length > 0) {
      toast.add({
        title: t('crmContacts.undoSkipped', {
          rows: result.skipped_rows.map(row => `${row.table}#${String(row.id)}`).join(', ')
        })
      })
    }

    emit('undone')
  } catch (error: unknown) {
    undoError.value = firstApiMessage(error) ?? (error instanceof Error ? error.message : '')
  } finally {
    undoSubmitting.value = false
  }
}
</script>

<template>
  <USlideover
    :open="open"
    class="history-drawer"
    @update:open="open = $event"
  >
    <template #header>
      <div v-if="profile">
        <h2>{{ profile.name }}</h2>
        <div class="bid">
          {{ filterLabel(typeOptions, profile.type) }}
          ·
          {{ filterLabel(lifecycleOptions, profile.lifecycle) }}
          ·
          {{ t('crmContacts.contactId', { id: String(profile.id) }) }}
        </div>
      </div>
    </template>

    <template #body>
      <template v-if="profile">
        <div
          v-if="profile.resolved_from_alias"
          class="crm-banner"
        >
          {{ t('crmContacts.mergedInto', { name: profile.name }) }}
        </div>

        <div class="kv">
          <span>{{ t('crmContacts.countryLanguage') }}</span>
          <span>
            {{ profile.country ?? '—' }} · {{ profile.language }}
            <span class="ro">{{ t('crmContacts.allSendsEnglish') }}</span>
          </span>
        </div>
        <div class="kv">
          <span>{{ t('crmContacts.preferredChannel') }}</span>
          <span>{{ channelLabel(profile.preferred_channel) }}</span>
        </div>
        <div class="kv">
          <span>{{ t('crmContacts.mainChannel') }}</span>
          <span>{{ profile.main_channel ?? '—' }}</span>
        </div>
        <div class="kv">
          <span>{{ t('crmContacts.channelOfOrigin') }}</span>
          <span>{{ profile.channel_of_origin ?? '—' }}</span>
        </div>
        <div class="kv">
          <span>
            {{ t('crmContacts.ltv') }}
            <span class="ro">{{ t('crmContacts.fromRmsLedger') }}</span>
          </span>
          <span>
            {{ profile.lifetime_value === 0 ? '—' : money(profile.lifetime_value) }}
            ·
            <span
              class="pill"
              :class="segmentPillClass(profile.segment)"
            >{{ profile.segment }}</span>
          </span>
        </div>
        <div class="kv">
          <span>{{ t('crmContacts.firstTouch') }}</span>
          <span>{{ formatAttribution(profile.first_touch) }}</span>
        </div>
        <div class="kv">
          <span>{{ t('crmContacts.lastTouch') }}</span>
          <span>{{ formatAttribution(profile.last_touch) }}</span>
        </div>
        <div class="kv">
          <span>{{ t('crmContacts.stays') }}</span>
          <span>
            {{ t('crmContacts.staySummary', { stays: String(profile.stays_count), nights: String(profile.nights_count) }) }}
            <template v-if="profile.last_room_type">
              · {{ t('crmContacts.lastRoom', { room: profile.last_room_type }) }}
            </template>
            <template v-if="profile.last_stay_check_out">
              · {{ t('crmContacts.lastStay', { date: format(profile.last_stay_check_out, 'short') }) }}
            </template>
            <template v-if="profile.next_stay_check_in">
              · {{ t('crmContacts.nextStay', { date: format(profile.next_stay_check_in, 'short') }) }}
            </template>
          </span>
        </div>
        <div class="kv">
          <span>{{ t('crmContacts.npsLabel') }}</span>
          <span>{{ profile.nps ?? '—' }}</span>
        </div>
        <div
          v-if="partner"
          class="kv"
        >
          <span>{{ t('crmContacts.partnerRecord') }}</span>
          <span>
            <NuxtLink :to="`/rms/commercial/b2b?open=${String(partner.id)}`">
              {{ partner.reference }} · {{ partner.name }}
            </NuxtLink>
            <span class="ro">{{ t('crmContacts.partnerRms') }}</span>
          </span>
        </div>

        <div class="sec">
          <h4>
            {{ t('crmContacts.consentTitle') }}
            <span class="ro">{{ t('crmContacts.consentOwned') }}</span>
          </h4>
          <div class="kv">
            <span>{{ t('crmContacts.consentTransactionalLabel') }}</span>
            <span class="pill ok">{{ t('crmContacts.consentAlwaysOn') }}</span>
          </div>
          <div
            v-for="row in consentCurrent"
            :key="row.purpose"
            class="kv"
          >
            <span>{{ row.label }}</span>
            <span
              class="pill"
              :class="consentPill(row.granted)"
            >{{ consentStateLabel(row.granted) }}</span>
          </div>
          <div class="crm-deal-actions">
            <UButton
              variant="outline"
              @click="showConsentHistory = !showConsentHistory"
            >
              {{ t('crmContacts.consentHistory') }}
            </UButton>
            <UButton
              v-if="canRecordConsent"
              variant="outline"
              @click="recordOpen = !recordOpen"
            >
              {{ t('crmContacts.recordConsent') }}
            </UButton>
          </div>
          <table
            v-if="showConsentHistory"
            class="list"
          >
            <thead>
              <tr>
                <th>{{ t('crmContacts.consentPurpose') }}</th>
                <th>{{ t('crmContacts.consentGranted') }}</th>
                <th>{{ t('crmContacts.consentVersion') }}</th>
                <th>{{ t('crmContacts.consentWhen') }}</th>
                <th>{{ t('crmContacts.consentCapture') }}</th>
                <th>{{ t('crmContacts.consentBy') }}</th>
                <th>{{ t('crmContacts.consentHow') }}</th>
                <th>{{ t('crmContacts.consentIp') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="consentHistory.length === 0">
                <td colspan="8">
                  {{ t('crmContacts.consentHistoryEmpty') }}
                </td>
              </tr>
              <tr
                v-for="(entry, index) in consentHistory"
                :key="`${entry.purpose}-${entry.captured_at}-${String(index)}`"
              >
                <td>{{ entry.label }}</td>
                <td>{{ consentStateLabel(entry.granted) }}</td>
                <td>{{ entry.version }}</td>
                <td class="nw">
                  {{ format(entry.captured_at, 'dateTime') }}
                </td>
                <td>{{ entry.capture_point }}</td>
                <td>{{ entry.recorded_by?.name ?? '—' }}</td>
                <td>{{ entry.how_obtained ?? '—' }}</td>
                <td>{{ entry.ip_present ? t('crmContacts.consentIpRecorded') : '—' }}</td>
              </tr>
            </tbody>
          </table>
          <form
            v-if="recordOpen && canRecordConsent"
            class="modal-form"
            @submit.prevent="recordConsent"
          >
            <p
              v-if="recordError"
              class="warnbox"
            >
              {{ recordError }}
            </p>
            <div class="field">
              <label for="consent-purpose">{{ t('crmContacts.consentPurpose') }}</label>
              <USelect
                id="consent-purpose"
                v-model="recordPurpose"
                class="w-full"
                :items="purposeItems"
              />
            </div>
            <div class="field">
              <label for="consent-granted">{{ t('crmContacts.consentGranted') }}</label>
              <USelect
                id="consent-granted"
                v-model="recordGranted"
                class="w-full"
                :items="grantedItems"
              />
            </div>
            <div class="field">
              <label for="consent-how">{{ t('crmContacts.consentHow') }}</label>
              <input
                id="consent-how"
                v-model="recordHow"
                type="text"
                required
              >
            </div>
            <div class="field">
              <label for="consent-version">{{ t('crmContacts.consentVersionOptional') }}</label>
              <input
                id="consent-version"
                v-model="recordVersion"
                type="text"
              >
            </div>
            <UButton
              type="submit"
              :loading="recordSaving"
              :disabled="recordSaving || recordHow.trim() === ''"
            >
              {{ t('crmContacts.recordConsent') }}
            </UButton>
          </form>
        </div>

        <div class="sec">
          <h4>
            {{ t('crmContacts.bookingsTitle') }}
            <span class="ro">{{ t('crmContacts.bookingsRms') }}</span>
          </h4>
          <table
            v-if="profile.bookings.length > 0"
            class="list"
          >
            <tbody>
              <tr
                v-for="row in profile.bookings"
                :key="row.id"
              >
                <td class="bk-ref">
                  <NuxtLink
                    v-if="bookingHref(row.display_reference)"
                    :to="bookingHref(row.display_reference) ?? ''"
                  >
                    {{ row.display_reference }}
                  </NuxtLink>
                  <template v-else>
                    —
                  </template>
                </td>
                <td>
                  <span class="pill">{{ statusLabel(row.status) }}</span>
                </td>
                <td>{{ format(row.check_in, 'short') }} – {{ format(row.check_out, 'short') }}</td>
                <td>{{ money(row.charges_total) }}</td>
              </tr>
            </tbody>
          </table>
          <p
            v-else
            class="crm-held"
          >
            {{ t('crmContacts.bookingsEmpty') }}
          </p>
        </div>

        <div class="sec">
          <h4>{{ t('crmJourneys.journeysTitle') }}</h4>
          <p
            v-if="journeysError"
            class="warnbox"
          >
            {{ journeysError }}
          </p>
          <p
            v-else-if="contactJourneys.length === 0"
            class="crm-held"
          >
            {{ t('crmJourneys.journeysEmpty') }}
          </p>
          <JourneyEnrolmentDetail
            v-for="row in contactJourneys"
            :key="row.id"
            :enrolment="row"
          />
        </div>

        <div class="sec">
          <h4>{{ t('crmContacts.tasksTitle') }}</h4>
          <UButton
            v-if="canManage"
            variant="outline"
            @click="activityOpen = true"
          >
            {{ t('crmPipeline.logActivity') }}
          </UButton>
          <p
            v-if="contactTasks.length === 0"
            class="crm-held"
          >
            {{ t('crmContacts.tasksEmpty') }}
          </p>
          <div
            v-for="task in contactTasks"
            :key="task.id"
            class="taskrow"
          >
            <div
              class="due"
              :class="taskPriorityClass(task.priority)"
            >
              {{ relativeDue(task.due_at) }}
            </div>
            <div>
              <div class="ttl">
                {{ task.title }}
              </div>
              <div
                v-if="task.context"
                class="ctx"
              >
                {{ task.context }}
              </div>
            </div>
          </div>
        </div>

        <div class="sec">
          <h4>{{ t('crmContacts.timelineTitle') }}</h4>
          <div
            v-if="items.length > 0"
            class="crm-tl"
          >
            <div
              v-for="item in items"
              :key="`${item.kind}-${item.at}-${item.title}`"
              class="crm-ev"
            >
              <span class="t">{{ format(item.at, 'dateTime') }} · {{ item.kind }}</span>
              <div class="crm-ev-title">
                <NuxtLink
                  v-if="timelineHref(item)"
                  :to="timelineHref(item) ?? ''"
                >
                  {{ item.title }}
                </NuxtLink>
                <button
                  v-else-if="item.link?.type === 'contact'"
                  type="button"
                  class="lnk"
                  @click="onTimelineContact(item.link.id)"
                >
                  {{ item.title }}
                </button>
                <template v-else>
                  {{ item.title }}
                </template>
              </div>
              <div
                v-if="item.detail !== ''"
                class="crm-held"
              >
                {{ item.detail }}
              </div>
              <div
                v-if="showUndo(item)"
                class="row-actions"
              >
                <UButton
                  variant="outline"
                  :disabled="undoDisabled(item)"
                  @click="startUndo(item)"
                >
                  {{ t('crmContacts.undo') }}
                </UButton>
                <span
                  v-if="undoDisabled(item)"
                  class="crm-held"
                >{{ t('crmContacts.undoAmbiguous') }}</span>
              </div>
            </div>
          </div>
          <p
            v-else
            class="crm-held"
          >
            {{ t('crmContacts.timelineEmpty') }}
          </p>
          <div
            v-if="timelineMeta && timelineMeta.last_page > 1"
            class="list-pager"
          >
            <button
              type="button"
              :disabled="timelineMeta.current_page <= 1"
              @click="timelinePage -= 1"
            >
              {{ t('bookings.previous') }}
            </button>
            <span>{{ t('bookings.pager', { from: String(timelineMeta.from ?? 0), to: String(timelineMeta.to ?? 0), total: String(timelineMeta.total) }) }}</span>
            <button
              type="button"
              :disabled="timelineMeta.current_page >= timelineMeta.last_page"
              @click="timelinePage += 1"
            >
              {{ t('bookings.next') }}
            </button>
          </div>
        </div>

        <div class="sec">
          <h4>{{ t('crmContacts.notHeldTitle') }}</h4>
          <p class="crm-held">
            {{ t('crmContacts.notHeld') }}
          </p>
        </div>

        <div
          v-if="canManage"
          class="sec"
        >
          <h4>{{ t('crmContacts.editTitle') }}</h4>
          <div
            v-if="warn"
            class="warnbox"
          >
            <span>{{ warn }}</span>
            <UButton
              v-if="conflictId !== null && canMerge"
              variant="outline"
              @click="reviewMerge"
            >
              {{ t('crmContacts.reviewMerge') }}
            </UButton>
          </div>
          <div class="field">
            <label for="crm-name">{{ t('crmContacts.name') }}</label>
            <input
              id="crm-name"
              v-model="name"
            >
            <p
              v-if="fieldErrors.name"
              class="field-hint"
            >
              {{ fieldErrors.name }}
            </p>
          </div>
          <div class="field">
            <label for="crm-email">{{ t('crmContacts.email') }}</label>
            <input
              id="crm-email"
              v-model="email"
            >
            <p
              v-if="fieldErrors.email"
              class="field-hint"
            >
              {{ fieldErrors.email }}
            </p>
          </div>
          <div class="field">
            <label for="crm-phone">{{ t('crmContacts.phone') }}</label>
            <input
              id="crm-phone"
              v-model="phone"
            >
            <p
              v-if="fieldErrors.phone"
              class="field-hint"
            >
              {{ fieldErrors.phone }}
            </p>
          </div>
          <div class="field">
            <label for="crm-country">{{ t('crmContacts.country') }}</label>
            <input
              id="crm-country"
              v-model="country"
              maxlength="2"
            >
            <p
              v-if="fieldErrors.country"
              class="field-hint"
            >
              {{ fieldErrors.country }}
            </p>
          </div>
          <div class="field">
            <label for="crm-language">{{ t('crmContacts.language') }}</label>
            <input
              id="crm-language"
              v-model="language"
              maxlength="2"
            >
            <p
              v-if="fieldErrors.language"
              class="field-hint"
            >
              {{ fieldErrors.language }}
            </p>
          </div>
          <div class="field">
            <label for="crm-channel">{{ t('crmContacts.preferredChannel') }}</label>
            <USelect
              id="crm-channel"
              v-model="preferredChannel"
              class="w-full"
              :items="channelItems"
            />
          </div>
          <div class="field">
            <label for="crm-type">{{ t('crmContacts.type') }}</label>
            <USelect
              id="crm-type"
              v-model="type"
              class="w-full"
              :items="contactTypeItems"
            />
          </div>
          <UButton
            :loading="saving"
            :disabled="saving"
            @click="save"
          >
            {{ t('crmContacts.save') }}
          </UButton>
        </div>
      </template>
    </template>
  </USlideover>

  <LogActivityModal
    v-model:open="activityOpen"
    :contact-id="profile?.id ?? null"
    @saved="onActivitySaved"
  />

  <ReasonModal
    v-model:open="undoOpen"
    :title="t('crmContacts.undoTitle')"
    hint="required"
    :submitting="undoSubmitting"
    :error="undoError"
    @submit="onUndo"
  >
    <template #extra>
      <p class="crm-held">
        {{ t('crmContacts.undoHint') }}
      </p>
    </template>
  </ReasonModal>
</template>
