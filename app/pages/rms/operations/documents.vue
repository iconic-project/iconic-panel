<script setup lang="ts">
import type {
  Booking,
  ClientDocumentFilters,
  ClientDocumentRow,
  Paginated
} from '../../../types/api'
import BookingPanel from '../../../components/bookings/BookingPanel.vue'
import DocumentConfirmModal from '../../../components/documents/DocumentConfirmModal.vue'
import DocumentPreviewModal from '../../../components/documents/DocumentPreviewModal.vue'
import {
  documentRowActions,
  documentStatusPillClass,
  previewTargetFor,
  type DocumentPreviewTarget
} from '../../../components/documents/documentHelpers'
import { firstApiMessage } from '../../../utils/apiForm'

type ClientDocumentsPayload = Paginated<ClientDocumentRow> & {
  meta: Paginated<ClientDocumentRow>['meta'] & {
    filters: ClientDocumentFilters
  }
}

const emptyFilters: ClientDocumentFilters = {
  kinds: [],
  statuses: []
}

const SEARCH_DEBOUNCE_MS = 300

const { t } = useI18n()
const route = useRoute()
const { useFetch, request } = useApi()
const { format } = useDates()
const toast = useToast()

const kind = ref('ALL')
const status = ref('ALL')
const searchInput = ref('')
const search = ref('')
const page = ref(1)

const panelOpen = ref(false)
const selected = ref<Booking | null>(null)

const previewOpen = ref(false)
const preview = ref<DocumentPreviewTarget | null>(null)

const resendOpen = ref(false)
const resendRow = ref<ClientDocumentRow | null>(null)
const resendSubmitting = ref(false)
const resendError = ref('')

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

watch([search, kind, status], () => {
  page.value = 1
})

const listUrl = computed(() => {
  const params = new URLSearchParams({
    page: String(page.value),
    per_page: '50'
  })

  if (kind.value !== 'ALL') {
    params.set('kind', kind.value)
  }

  if (status.value !== 'ALL') {
    params.set('status', status.value)
  }

  if (search.value !== '') {
    params.set('q', search.value)
  }

  return `/api/rms/documents?${params.toString()}`
})

const { data: listPayload, refresh } = useFetch<ClientDocumentsPayload>(listUrl)

const rows = computed(() => listPayload.value?.data ?? [])
const filters = computed(() => listPayload.value?.meta.filters ?? emptyFilters)
const meta = computed(() => listPayload.value?.meta)

function rowDate(row: ClientDocumentRow): string {
  return row.date === null ? '—' : format(row.date, 'short')
}

function rowKey(row: ClientDocumentRow): string {
  return `${String(row.booking_id)}-${row.kind}-${String(row.payment_id ?? row.reminder_days ?? 0)}`
}

async function openBooking(id: number): Promise<void> {
  selected.value = await request(`/api/rms/bookings/${String(id)}`) as Booking
  panelOpen.value = true
}

onMounted(() => {
  const raw = route.query.booking
  const id = typeof raw === 'string' ? Number(raw) : Number.NaN

  if (Number.isInteger(id) && id > 0) {
    void openBooking(id)
  }
})

function openPreview(row: ClientDocumentRow, event: Event): void {
  event.stopPropagation()
  preview.value = previewTargetFor(row)
  previewOpen.value = true
}

function startResend(row: ClientDocumentRow, event: Event): void {
  event.stopPropagation()

  if (row.document_id === null) {
    return
  }

  resendRow.value = row
  resendError.value = ''
  resendOpen.value = true
}

const resendBody = computed(() => {
  const row = resendRow.value

  if (row === null) {
    return ''
  }

  return t('bookings.docResendBody', { name: row.name, recipient: row.recipient })
})

async function submitResend(): Promise<void> {
  const row = resendRow.value

  if (row === null || row.document_id === null) {
    return
  }

  resendSubmitting.value = true
  resendError.value = ''

  try {
    await request(`/api/rms/documents/${String(row.document_id)}/send`, { method: 'POST' })
    toast.add({ title: t('bookings.docSentToast') })
    resendOpen.value = false
    resendRow.value = null
    await refresh()
  } catch (error: unknown) {
    resendError.value = firstApiMessage(error) ?? (error instanceof Error ? error.message : t('bookings.docsFailed'))
  } finally {
    resendSubmitting.value = false
  }
}

async function onPanelUpdated(): Promise<void> {
  await refresh()
}
</script>

<template>
  <div>
    <div class="panel">
      <h3>{{ t('documents.title') }}</h3>
      <div class="ebtool dep-toolbar">
        <div class="doc-chip-stack">
          <div class="fchips">
            <button
              type="button"
              class="fchip"
              :class="{ on: kind === 'ALL' }"
              @click="kind = 'ALL'"
            >
              {{ t('documents.filterAll') }}
            </button>
            <button
              v-for="option in filters.kinds"
              :key="`kind-${option.value}`"
              type="button"
              class="fchip"
              :class="{ on: kind === option.value }"
              @click="kind = option.value"
            >
              {{ option.label }}
            </button>
          </div>
          <div class="fchips">
            <button
              type="button"
              class="fchip"
              :class="{ on: status === 'ALL' }"
              @click="status = 'ALL'"
            >
              {{ t('documents.filterAll') }}
            </button>
            <button
              v-for="option in filters.statuses"
              :key="`status-${option.value}`"
              type="button"
              class="fchip"
              :class="{ on: status === option.value }"
              @click="status = option.value"
            >
              {{ option.label }}
            </button>
          </div>
        </div>
        <div class="list-filters">
          <UInput
            v-model="searchInput"
            class="bk-search"
            :placeholder="t('documents.searchPlaceholder')"
            :aria-label="t('documents.search')"
          />
        </div>
      </div>
      <div class="bk-table-wrap">
        <table class="list">
          <thead>
            <tr>
              <th>{{ t('documents.colBooking') }}</th>
              <th>{{ t('documents.colClient') }}</th>
              <th>{{ t('documents.colDocument') }}</th>
              <th>{{ t('documents.colTrigger') }}</th>
              <th>{{ t('documents.colDate') }}</th>
              <th>{{ t('documents.colStatus') }}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            <tr
              v-if="rows.length === 0"
              class="dr-empty"
            >
              <td colspan="7">
                {{ t('documents.empty') }}
              </td>
            </tr>
            <tr
              v-for="row in rows"
              :key="rowKey(row)"
              class="bk-row"
              @click="openBooking(row.booking_id)"
            >
              <td class="bk-ref">
                {{ row.booking_reference ?? '—' }}
              </td>
              <td>{{ row.client === '' ? '—' : row.client }}</td>
              <td>
                {{ row.name }}
                <div
                  v-if="row.status === 'BLOCKED' || row.status === 'FAILED'"
                  class="gmeta"
                  :class="row.status === 'FAILED' ? 'doc-error' : 'doc-blocked'"
                >
                  {{ row.error ?? row.recipient }}
                </div>
                <div
                  v-else
                  class="gmeta"
                >
                  {{ t('bookings.docTo', { recipient: row.recipient }) }}
                </div>
              </td>
              <td class="doc-trigger">
                {{ row.trigger }}
              </td>
              <td class="nw">
                {{ rowDate(row) }}
              </td>
              <td>
                <span
                  class="pill"
                  :class="documentStatusPillClass(row.status)"
                >{{ row.status }}</span>
              </td>
              <td
                class="list-actions"
                @click.stop
              >
                <button
                  v-if="documentRowActions(row).preview"
                  type="button"
                  class="mini"
                  @click="openPreview(row, $event)"
                >
                  {{ t('bookings.docPreview') }}
                </button>
                <button
                  v-if="documentRowActions(row).resend"
                  type="button"
                  class="mini"
                  @click="startResend(row, $event)"
                >
                  {{ t('bookings.docResend') }}
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div
        v-if="meta && meta.last_page > 1"
        class="list-pager"
      >
        <button
          type="button"
          :disabled="meta.current_page <= 1"
          @click="page -= 1"
        >
          {{ t('bookings.previous') }}
        </button>
        <span>{{ t('bookings.pager', { from: String(meta.from ?? 0), to: String(meta.to ?? 0), total: String(meta.total) }) }}</span>
        <button
          type="button"
          :disabled="meta.current_page >= meta.last_page"
          @click="page += 1"
        >
          {{ t('bookings.next') }}
        </button>
      </div>
      <p class="note">
        {{ t('documents.footnote') }}
      </p>
    </div>

    <BookingPanel
      v-model:open="panelOpen"
      :booking="selected"
      initial-tab="documents"
      @updated="onPanelUpdated"
    />

    <DocumentPreviewModal
      v-model:open="previewOpen"
      :title="preview?.title ?? ''"
      :html-path="preview?.htmlPath ?? null"
      :file-path="preview?.filePath ?? null"
      :file-name="preview?.fileName ?? ''"
    />

    <DocumentConfirmModal
      v-model:open="resendOpen"
      :title="t('bookings.docResendTitle')"
      :body="resendBody"
      :submitting="resendSubmitting"
      :error="resendError"
      :confirm-label="t('bookings.docResend')"
      @confirm="submitResend"
    />
  </div>
</template>
