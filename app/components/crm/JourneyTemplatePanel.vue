<script setup lang="ts">
import type {
  ContactBooking,
  ContactProfile,
  CrmContact,
  MessageTemplate,
  MessageTemplateVersion,
  Paginated,
  PublishTemplateInput,
  TemplateDraftInput,
  TemplatePreviewInput
} from '../../types/api'
import { firstApiMessage } from '../../utils/apiForm'

const open = defineModel<boolean>('open', { required: true })

const props = defineProps<{
  template: MessageTemplate | null
}>()

const emit = defineEmits<{
  saved: []
}>()

const { t } = useI18n()
const { can } = useAuth()
const { request } = useApi()
const { format } = useDates()
const toast = useToast()

const canManage = computed(() => can('rules.manage'))
const canRead = computed(() => can('panel.crm'))

const subject = ref('')
const paragraphs = ref<Array<string>>([''])
const listItems = ref<Array<string>>([])
const ctaOn = ref(false)
const ctaLabel = ref('')
const ctaLink = ref('')
const approval = ref('')
const selectedVersion = ref<number | undefined>(undefined)
const error = ref('')
const saving = ref(false)

const query = ref('')
const matches = ref<Array<CrmContact>>([])
const contactId = ref<number | null>(null)
const contactName = ref('')
const bookings = ref<Array<ContactBooking>>([])
const bookingId = ref<number | null>(null)
const preview = ref<{ subject: string, body: string } | null>(null)
const searched = ref(false)
let searchTimer: ReturnType<typeof setTimeout> | undefined

const versions = computed(() => {
  const rows: Array<{ label: string, version: MessageTemplateVersion }> = []

  if (props.template?.published) {
    rows.push({ label: t('crmJourneys.published'), version: props.template.published })
  }

  if (props.template?.draft) {
    rows.push({ label: t('crmJourneys.draft'), version: props.template.draft })
  }

  return rows
})

const versionItems = computed(() => versions.value.map(row => ({
  label: `${row.label} · ${row.version.version}`,
  value: row.version.version
})))

const bookingItems = computed(() => [
  { label: t('crmJourneys.noBooking'), value: null },
  ...bookings.value.map(booking => ({
    label: String(booking.display_reference ?? booking.id),
    value: booking.id
  }))
])

const canDraft = computed(() => {
  return canManage.value && props.template !== null && props.template.draft === null
})

function fillForm(): void {
  const source = props.template?.published
  subject.value = source?.subject ?? ''
  paragraphs.value = source && source.body.paragraphs.length > 0 ? [...source.body.paragraphs] : ['']
  listItems.value = [...(source?.body.list ?? [])]
  ctaOn.value = source?.body.cta != null
  ctaLabel.value = source?.body.cta?.label ?? ''
  ctaLink.value = source?.body.cta?.link_key ?? ''
  approval.value = ''
  selectedVersion.value = props.template?.published?.version ?? props.template?.draft?.version ?? undefined
  preview.value = null
  error.value = ''
}

watch(
  () => [props.template?.key ?? '', props.template?.draft?.version ?? 0, props.template?.published?.version ?? 0] as const,
  () => {
    fillForm()
  },
  { immediate: true }
)

function onSearch(): void {
  searched.value = false
  window.clearTimeout(searchTimer)
  searchTimer = setTimeout(() => {
    void searchContacts()
  }, 300)
}

async function searchContacts(): Promise<void> {
  const term = query.value.trim()

  if (term === '') {
    matches.value = []
    searched.value = false
    return
  }

  try {
    const result = await request(`/api/crm/contacts?q=${encodeURIComponent(term)}&per_page=8`) as Paginated<CrmContact>
    matches.value = result.data
    searched.value = true
  } catch (caught: unknown) {
    error.value = firstApiMessage(caught) ?? t('crmJourneys.failed')
  }
}

async function chooseContact(contact: CrmContact): Promise<void> {
  contactId.value = contact.id
  contactName.value = contact.name
  bookingId.value = null
  matches.value = []
  searched.value = false
  query.value = contact.name

  try {
    const profile = await request(`/api/crm/contacts/${String(contact.id)}`) as ContactProfile
    bookings.value = profile.bookings
  } catch (caught: unknown) {
    bookings.value = []
    error.value = firstApiMessage(caught) ?? t('crmJourneys.failed')
  }
}

function previewBody(): TemplatePreviewInput | null {
  if (contactId.value === null && bookingId.value === null) {
    return null
  }

  const body: TemplatePreviewInput = {}

  if (contactId.value !== null) {
    body.contact_id = contactId.value
  }

  if (bookingId.value !== null) {
    body.booking_id = bookingId.value
  }

  if (selectedVersion.value !== undefined) {
    body.version = selectedVersion.value
  }

  return body
}

async function runPreview(): Promise<void> {
  if (props.template === null) {
    return
  }

  const body = previewBody()

  if (body === null) {
    return
  }

  error.value = ''

  try {
    preview.value = await request(`/api/crm/templates/${encodeURIComponent(props.template.key)}/preview`, {
      method: 'POST',
      body
    }) as { subject: string, body: string }
  } catch (caught: unknown) {
    preview.value = null
    error.value = firstApiMessage(caught) ?? t('crmJourneys.failed')
  }
}

async function sendTest(): Promise<void> {
  if (props.template === null) {
    return
  }

  const body = previewBody()

  if (body === null) {
    return
  }

  error.value = ''
  saving.value = true

  try {
    const result = await request(`/api/crm/templates/${encodeURIComponent(props.template.key)}/test-send`, {
      method: 'POST',
      body
    }) as { subject: string }
    toast.add({ title: t('crmJourneys.testSent', { subject: result.subject }) })
  } catch (caught: unknown) {
    error.value = firstApiMessage(caught) ?? t('crmJourneys.failed')
  } finally {
    saving.value = false
  }
}

function addParagraph(): void {
  paragraphs.value = [...paragraphs.value, '']
}

function removeParagraph(index: number): void {
  const next = paragraphs.value.filter((_, item) => item !== index)
  paragraphs.value = next.length > 0 ? next : ['']
}

function addItem(): void {
  listItems.value = [...listItems.value, '']
}

function removeItem(index: number): void {
  listItems.value = listItems.value.filter((_, item) => item !== index)
}

function draftInput(): TemplateDraftInput {
  return {
    subject: subject.value.trim(),
    body: {
      paragraphs: paragraphs.value.map(item => item.trim()).filter(item => item !== ''),
      list: listItems.value.map(item => item.trim()).filter(item => item !== ''),
      cta: ctaOn.value
        ? { label: ctaLabel.value.trim(), link_key: ctaLink.value.trim() }
        : null
    }
  }
}

const draftReady = computed(() => {
  const input = draftInput()
  return input.subject !== '' && input.body.paragraphs.length > 0
})

async function createDraft(): Promise<void> {
  if (props.template === null || !draftReady.value) {
    return
  }

  saving.value = true
  error.value = ''

  try {
    await request(`/api/crm/templates/${encodeURIComponent(props.template.key)}/drafts`, {
      method: 'POST',
      body: draftInput()
    })
    toast.add({ title: t('crmJourneys.draftToast') })
    emit('saved')
  } catch (caught: unknown) {
    error.value = firstApiMessage(caught) ?? t('crmJourneys.failed')
  } finally {
    saving.value = false
  }
}

async function publishDraft(): Promise<void> {
  if (props.template?.draft === null || props.template === null) {
    return
  }

  const reference = approval.value.trim()

  if (reference === '') {
    return
  }

  saving.value = true
  error.value = ''
  const body: PublishTemplateInput = { approval_reference: reference }

  try {
    await request(`/api/crm/templates/${encodeURIComponent(props.template.key)}/versions/${String(props.template.draft.version)}/publish`, {
      method: 'POST',
      body
    })
    toast.add({ title: t('crmJourneys.publishedToast') })
    emit('saved')
  } catch (caught: unknown) {
    error.value = firstApiMessage(caught) ?? t('crmJourneys.failed')
  } finally {
    saving.value = false
  }
}

onUnmounted(() => {
  window.clearTimeout(searchTimer)
})
</script>

<template>
  <USlideover
    v-model:open="open"
    :title="template?.name ?? ''"
  >
    <template #body>
      <p
        v-if="!canRead"
        class="crm-held"
      >
        {{ t('crmJourneys.bodyHidden') }}
      </p>
      <template v-else-if="template">
        <p
          v-if="error"
          class="warnbox"
        >
          {{ error }}
        </p>
        <p
          v-if="versions.length === 0"
          class="crm-held"
        >
          {{ t('crmJourneys.noPublished') }}
        </p>
        <div
          v-for="row in versions"
          :key="row.version.version"
          class="journey-version"
        >
          <h3>{{ row.label }}</h3>
          <p class="mono">
            {{ t('crmJourneys.version', { version: row.version.version }) }}
            <template v-if="row.version.published_at">
              · {{ format(row.version.published_at, 'dateTime') }}
            </template>
          </p>
          <p v-if="row.version.approval_reference">
            {{ row.version.approval_reference }}
          </p>
          <p>{{ row.version.subject }}</p>
          <p
            v-for="(paragraph, index) in row.version.body.paragraphs"
            :key="`${row.version.version}-p-${String(index)}`"
          >
            {{ paragraph }}
          </p>
          <ul v-if="row.version.body.list.length > 0">
            <li
              v-for="(item, index) in row.version.body.list"
              :key="`${row.version.version}-l-${String(index)}`"
            >
              {{ item }}
            </li>
          </ul>
          <p v-if="row.version.body.cta">
            {{ row.version.body.cta.label }} · {{ row.version.body.cta.link_key }}
          </p>
          <p class="mono">
            {{ t('crmJourneys.variables') }}: {{ row.version.variables.join(', ') }}
          </p>
          <p
            v-if="row.version.variables.includes('departure_date')"
            class="field-hint"
          >
            {{ t('crmJourneys.departureDateDeprecated') }}
          </p>
        </div>

        <div class="field">
          <label for="journey-version">{{ t('crmJourneys.version', { version: selectedVersion ?? '' }) }}</label>
          <USelect
            id="journey-version"
            v-model="selectedVersion"
            class="w-full"
            :items="versionItems"
          />
        </div>
        <div class="field">
          <label for="journey-contact-search">{{ t('crmJourneys.searchContacts') }}</label>
          <input
            id="journey-contact-search"
            v-model="query"
            type="search"
            @input="onSearch"
          >
          <p
            v-if="searched && matches.length === 0"
            class="crm-held"
          >
            {{ t('crmJourneys.noContacts') }}
          </p>
          <button
            v-for="contact in matches"
            :key="contact.id"
            type="button"
            class="lnk"
            @click="chooseContact(contact)"
          >
            {{ contact.name }}
          </button>
          <p v-if="contactName">
            {{ t('crmJourneys.chooseContact') }}: {{ contactName }}
          </p>
        </div>
        <div
          v-if="bookings.length > 0"
          class="field"
        >
          <label for="journey-booking">{{ t('crmJourneys.booking') }}</label>
          <USelect
            id="journey-booking"
            v-model="bookingId"
            class="w-full"
            :items="bookingItems"
          />
        </div>
        <div class="crm-deal-actions">
          <UButton
            variant="outline"
            :disabled="contactId === null"
            @click="runPreview"
          >
            {{ t('crmJourneys.preview') }}
          </UButton>
          <UButton
            variant="outline"
            :disabled="contactId === null || saving"
            :loading="saving"
            @click="sendTest"
          >
            {{ t('crmJourneys.sendTest') }}
          </UButton>
        </div>
        <p
          v-if="preview === null"
          class="crm-held"
        >
          {{ t('crmJourneys.previewEmpty') }}
        </p>
        <template v-else>
          <p>{{ preview.subject }}</p>
          <iframe
            class="journey-preview"
            sandbox=""
            :srcdoc="preview.body"
            :title="preview.subject"
          />
        </template>

        <form
          v-if="canDraft"
          class="journey-version"
          @submit.prevent="createDraft"
        >
          <h3>{{ t('crmJourneys.createDraft') }}</h3>
          <div class="field">
            <label for="draft-subject">{{ t('crmJourneys.subject') }}</label>
            <input
              id="draft-subject"
              v-model="subject"
              type="text"
              required
            >
          </div>
          <div class="field">
            <span>{{ t('crmJourneys.paragraphs') }}</span>
            <div
              v-for="(paragraph, index) in paragraphs"
              :key="`draft-p-${String(index)}`"
              class="crm-inline"
            >
              <textarea
                v-model="paragraphs[index]"
                rows="3"
              />
              <button
                type="button"
                class="lnk"
                @click="removeParagraph(index)"
              >
                {{ t('crmJourneys.remove') }}
              </button>
            </div>
            <button
              type="button"
              class="lnk"
              @click="addParagraph"
            >
              {{ t('crmJourneys.addParagraph') }}
            </button>
          </div>
          <div class="field">
            <span>{{ t('crmJourneys.list') }}</span>
            <div
              v-for="(item, index) in listItems"
              :key="`draft-l-${String(index)}`"
              class="crm-inline"
            >
              <input
                v-model="listItems[index]"
                type="text"
              >
              <button
                type="button"
                class="lnk"
                @click="removeItem(index)"
              >
                {{ t('crmJourneys.remove') }}
              </button>
            </div>
            <button
              type="button"
              class="lnk"
              @click="addItem"
            >
              {{ t('crmJourneys.addItem') }}
            </button>
          </div>
          <label class="crm-check">
            <input
              v-model="ctaOn"
              type="checkbox"
            >
            {{ t('crmJourneys.cta') }}
          </label>
          <template v-if="ctaOn">
            <div class="field">
              <label for="draft-cta-label">{{ t('crmJourneys.ctaLabel') }}</label>
              <input
                id="draft-cta-label"
                v-model="ctaLabel"
                type="text"
              >
            </div>
            <div class="field">
              <label for="draft-cta-link">{{ t('crmJourneys.ctaLink') }}</label>
              <input
                id="draft-cta-link"
                v-model="ctaLink"
                type="text"
              >
            </div>
          </template>
          <UButton
            type="submit"
            :disabled="!draftReady || saving"
            :loading="saving"
          >
            {{ t('crmJourneys.createDraft') }}
          </UButton>
        </form>

        <form
          v-if="canManage && template.draft"
          class="journey-version"
          @submit.prevent="publishDraft"
        >
          <h3>{{ t('crmJourneys.publish') }}</h3>
          <div class="field">
            <label for="draft-approval">{{ t('crmJourneys.approval') }}</label>
            <input
              id="draft-approval"
              v-model="approval"
              type="text"
              required
            >
          </div>
          <UButton
            type="submit"
            :disabled="approval.trim() === '' || saving"
            :loading="saving"
          >
            {{ t('crmJourneys.publish') }}
          </UButton>
        </form>
      </template>
    </template>
  </USlideover>
</template>
