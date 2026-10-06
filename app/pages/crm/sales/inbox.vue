<script setup lang="ts">
import type { ContactBooking, ContactProfile, Conversation, ConversationMessage, ConversationReplyInput, ConversationStatus, Paginated } from '../../../types/api'
import ConversationLinkSearch from '../../../components/crm/ConversationLinkSearch.vue'
import { firstApiMessage } from '../../../utils/apiForm'

const { t } = useI18n()
const { request } = useApi()
const { format } = useDates()
const toast = useToast()

const page = ref(1)
const statusFilter = ref<'ALL' | ConversationStatus>('ALL')
const unreadFilter = ref<'ALL' | '1'>('ALL')
const rows = ref<Array<Conversation>>([])
const meta = ref<Paginated<Conversation>['meta'] | null>(null)
const loadError = ref('')
const selectedId = ref<number | null>(null)
const thread = ref<Conversation | null>(null)
const threadError = ref('')
const loadingThread = ref(false)
const draft = ref('')
const saving = ref(false)
const contact = ref<ContactProfile | null>(null)
const bookingNote = ref('')
const whatsappLocked = ref(false)
const msgsEl = ref<HTMLElement | null>(null)
let requestToken = 0

const statusItems = computed(() => [
  { label: t('crmInbox.statusAll'), value: 'ALL' as const },
  { label: t('crmInbox.statusOpen'), value: 'OPEN' as const },
  { label: t('crmInbox.statusClosed'), value: 'CLOSED' as const }
])

const unreadItems = computed(() => [
  { label: t('crmInbox.unreadAll'), value: 'ALL' as const },
  { label: t('crmInbox.unreadOnly'), value: '1' as const }
])

const messages = computed(() => thread.value?.messages ?? [])
const canSend = computed(() => draft.value.trim() !== '' && !saving.value && !whatsappLocked.value)

const linkedBooking = computed((): ContactBooking | null => {
  return contact.value?.bookings.find(row => row.display_reference !== null && row.display_reference !== '') ?? null
})

const bookingTo = computed((): string | null => {
  const reference = linkedBooking.value?.display_reference

  if (reference === null || reference === undefined || reference === '') {
    return null
  }

  return bookingHref(reference)
})

const threadMeta = computed(() => {
  if (thread.value === null) {
    return ''
  }

  const parts = [thread.value.subject, thread.value.status]

  if (thread.value.last_message_at !== null) {
    parts.push(format(thread.value.last_message_at, 'dateTime'))
  }

  if (contact.value !== null) {
    parts.push(t('crmInbox.prefers', { channel: contact.value.preferred_channel }))
  }

  return parts.join(' · ')
})

function rowName(row: Conversation): string {
  return row.contact_name ?? row.from ?? '—'
}

function previewText(row: Conversation): string {
  const text = row.preview.trim()

  if (text === '') {
    return '—'
  }

  return text.length > 44 ? `${text.slice(0, 44)}…` : text
}

function isAutomation(message: ConversationMessage): boolean {
  return message.direction === 'OUT' && message.staff_id === null
}

function bubbleClass(message: ConversationMessage): string {
  if (message.direction === 'IN') {
    return 'in'
  }

  return isAutomation(message) ? 'auto' : 'out'
}

function htmlBody(message: ConversationMessage): string {
  return message.body_html.trim()
}

function bookingHref(reference: string): string {
  return `/rms/reservations/bookings?open=${encodeURIComponent(reference)}`
}

async function load(): Promise<void> {
  const params = new URLSearchParams({
    page: String(page.value)
  })

  if (statusFilter.value !== 'ALL') {
    params.set('status', statusFilter.value)
  }

  if (unreadFilter.value === '1') {
    params.set('unread', '1')
  }

  try {
    const result = await request(`/api/crm/conversations?${params.toString()}`) as Paginated<Conversation>
    rows.value = result.data
    meta.value = result.meta
    loadError.value = ''
  } catch (caught: unknown) {
    loadError.value = firstApiMessage(caught) ?? t('crmInbox.failed')
  }
}

watch([statusFilter, unreadFilter], () => {
  if (page.value !== 1) {
    page.value = 1
    return
  }

  void load()
})

watch(page, () => {
  void load()
})

onMounted(() => {
  void load()
})

function applyConversation(previousId: number, next: Conversation): void {
  const dropBecauseUnread = unreadFilter.value === '1' && !next.unread

  if (dropBecauseUnread) {
    rows.value = rows.value.filter(row => row.id !== previousId && row.id !== next.id)
  } else {
    const survivorElsewhere = rows.value.some(row => row.id === next.id && row.id !== previousId)

    if (survivorElsewhere) {
      rows.value = rows.value
        .filter(row => row.id !== previousId)
        .map(row => row.id === next.id ? next : row)
    } else {
      rows.value = rows.value.map(row => row.id === previousId ? next : row)
    }
  }

  if (selectedId.value === previousId) {
    selectedId.value = next.id
  }
}

async function loadContact(id: number, token: number): Promise<void> {
  try {
    const profile = await request(`/api/crm/contacts/${String(id)}`) as ContactProfile

    if (token !== requestToken) {
      return
    }

    contact.value = profile
  } catch {
    if (token !== requestToken) {
      return
    }

    contact.value = null
  }
}

async function openRow(id: number): Promise<void> {
  const token = ++requestToken
  selectedId.value = id
  loadingThread.value = true
  threadError.value = ''
  bookingNote.value = ''
  whatsappLocked.value = false
  contact.value = null

  try {
    const result = await request(`/api/crm/conversations/${String(id)}`) as Conversation

    if (token !== requestToken) {
      return
    }

    thread.value = result
    applyConversation(id, result)

    if (result.contact_id !== null) {
      await loadContact(result.contact_id, token)
    }
  } catch (caught: unknown) {
    if (token !== requestToken) {
      return
    }

    threadError.value = firstApiMessage(caught) ?? t('crmInbox.failed')
  } finally {
    if (token === requestToken) {
      loadingThread.value = false
    }
  }
}

function explainBooking(): void {
  bookingNote.value = t('crmInbox.noBooking')
}

function lockWhatsapp(): void {
  whatsappLocked.value = true
}

function useEmail(): void {
  whatsappLocked.value = false
}

async function sendReply(): Promise<void> {
  if (selectedId.value === null || !canSend.value) {
    return
  }

  const previousId = selectedId.value
  saving.value = true
  threadError.value = ''
  const body: ConversationReplyInput = { message: draft.value.trim() }

  try {
    const saved = await request(`/api/crm/conversations/${String(previousId)}/reply`, {
      method: 'POST',
      body
    }) as Conversation
    thread.value = saved
    draft.value = ''
    toast.add({ title: t('crmInbox.sent') })
    applyConversation(previousId, saved)
  } catch (caught: unknown) {
    threadError.value = firstApiMessage(caught) ?? t('crmInbox.failed')
  } finally {
    saving.value = false
  }
}

function onLinked(next: Conversation): void {
  const previousId = selectedId.value

  if (previousId === null) {
    return
  }

  thread.value = next
  toast.add({ title: t('crmInbox.linked') })
  applyConversation(previousId, next)

  if (next.contact_id !== null) {
    void loadContact(next.contact_id, requestToken)
  }
}

watch(messages, async () => {
  await nextTick()

  if (msgsEl.value !== null) {
    msgsEl.value.scrollTop = msgsEl.value.scrollHeight
  }
})
</script>

<template>
  <div class="inbox-page">
    <p
      v-if="loadError"
      class="warnbox"
    >
      {{ loadError }}
    </p>

    <div class="inbox-filters crm-filters">
      <USelect
        v-model="statusFilter"
        size="sm"
        :items="statusItems"
      />
      <USelect
        v-model="unreadFilter"
        size="sm"
        :items="unreadItems"
      />
    </div>

    <div class="inboxgrid">
      <div class="convcol">
        <div class="convlist">
          <p
            v-if="rows.length === 0"
            class="conv-empty"
          >
            {{ t('crmInbox.empty') }}
          </p>
          <button
            v-for="row in rows"
            :key="row.id"
            type="button"
            class="conv"
            :class="{ cur: row.id === selectedId }"
            @click="openRow(row.id)"
          >
            <span class="cn">
              <span :class="{ 'inbox-unmatched': row.contact_id === null }">{{ rowName(row) }}</span>
              <span
                v-if="row.unread"
                class="unread"
              />
            </span>
            <span class="cp">{{ previewText(row) }}</span>
            <span class="ctags">
              <span class="chtag em">{{ t('crmInbox.email') }}</span>
            </span>
          </button>
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
      </div>

      <div class="thread">
        <div class="thhead">
          <div>
            <span class="tn">{{ thread ? rowName(thread) : '—' }}</span>
            <span class="th-meta">{{ threadMeta }}</span>
            <ConversationLinkSearch
              v-if="thread && thread.contact_id === null"
              :conversation-id="thread.id"
              @linked="onLinked"
            />
          </div>
          <div class="th-actions">
            <NuxtLink
              v-if="bookingTo"
              class="btn o"
              :to="bookingTo"
            >
              {{ t('crmInbox.openBooking') }}
            </NuxtLink>
            <button
              v-else
              type="button"
              class="btn o"
              :disabled="thread === null"
              @click="explainBooking"
            >
              {{ t('crmInbox.openBooking') }}
            </button>
            <p
              v-if="bookingNote"
              class="booking-note"
            >
              {{ bookingNote }}
            </p>
          </div>
        </div>

        <p
          v-if="threadError"
          class="warnbox"
        >
          {{ threadError }}
        </p>
        <p
          v-if="loadingThread && thread === null"
          class="conv-empty"
        >
          {{ t('crmInbox.title') }}
        </p>
        <div
          v-else
          ref="msgsEl"
          class="msgs"
        >
          <p
            v-if="thread && messages.length === 0"
            class="conv-empty"
          >
            {{ t('crmInbox.noMessages') }}
          </p>
          <article
            v-for="message in messages"
            :key="message.id"
            class="msg"
            :class="bubbleClass(message)"
          >
            <iframe
              v-if="message.body_text.trim() === '' && htmlBody(message) !== ''"
              sandbox=""
              :srcdoc="message.body_html"
              :title="message.subject"
            />
            <p v-else>
              {{ message.body_text }}
            </p>
            <div class="mt">
              <span class="chtag em">{{ t('crmInbox.email') }}</span>
              <span>{{ format(message.sent_at, 'dateTime') }}</span>
              <span v-if="isAutomation(message)">{{ t('crmInbox.automation') }}</span>
            </div>
          </article>
        </div>

        <form
          class="composer"
          @submit.prevent="sendReply"
        >
          <div class="comprow">
            <span class="send-via">{{ t('crmInbox.sendVia') }}</span>
            <button
              type="button"
              class="chbtn"
              :class="{ on: !whatsappLocked }"
              @click="useEmail"
            >
              {{ t('crmInbox.emailLabel') }}
            </button>
            <button
              type="button"
              class="chbtn"
              :class="{ on: whatsappLocked }"
              @click="lockWhatsapp"
            >
              {{ t('crmInbox.whatsapp') }}
            </button>
          </div>
          <div class="crow2">
            <label
              class="sr-only"
              for="inbox-reply"
            >{{ t('crmInbox.reply') }}</label>
            <input
              id="inbox-reply"
              v-model="draft"
              type="text"
              :disabled="thread === null || whatsappLocked"
              :placeholder="whatsappLocked ? t('crmInbox.whatsappLockedPlaceholder') : t('crmInbox.replyPlaceholder')"
              @keydown.enter.prevent="sendReply"
            >
            <button
              type="submit"
              class="btn"
              :disabled="!canSend"
            >
              {{ t('crmInbox.send') }}
            </button>
          </div>
          <p
            v-if="whatsappLocked"
            class="walock"
          >
            {{ t('crmInbox.whatsappLocked') }}
          </p>
        </form>
      </div>
    </div>
  </div>
</template>
