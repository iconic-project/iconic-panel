<script setup lang="ts">
import type {
  ChangeHistoryEntry,
  Paginated,
  SurveyGuest,
  SurveyQuestion
} from '../../types/api'
import { firstApiMessage } from '../../utils/apiForm'

const open = defineModel<boolean>('open', { required: true })

const props = defineProps<{
  bookingId: number | null
}>()

const emit = defineEmits<{
  saved: []
}>()

const { t } = useI18n()
const { request } = useApi()

const guests = ref<Array<SurveyGuest>>([])
const questions = ref<Array<SurveyQuestion>>([])
const guestId = ref<number | null>(null)
const callNotes = ref('')
const draft = ref<Record<string, string>>({})
const result = ref('')
const error = ref('')
const loading = ref(false)
const submitting = ref(false)

const openGuests = computed(() => guests.value.filter(guest => !guest.responded))

const guestItems = computed(() => guests.value.map(guest => ({
  label: `${guest.name} · ${guest.room}${guest.responded ? ` · ${t('guestExperience.surveyAnswered')}` : ''}`,
  value: guest.guest_id,
  disabled: guest.responded
})))

function onGuestUpdate(value: number | string | null | undefined): void {
  guestId.value = typeof value === 'number' ? value : null
  result.value = ''
}

watch(open, (isOpen) => {
  if (isOpen) {
    void load()
  }
})

function blank(value: string | undefined): string | null {
  const trimmed = value?.trim() ?? ''

  return trimmed === '' ? null : trimmed
}

async function load(): Promise<void> {
  if (props.bookingId === null) {
    return
  }

  loading.value = true
  error.value = ''
  result.value = ''
  callNotes.value = ''
  draft.value = {}

  try {
    const [guestPayload, questionPayload] = await Promise.all([
      request(`/api/rms/bookings/${String(props.bookingId)}/survey-guests`) as Promise<{ data: Array<SurveyGuest> }>,
      request('/api/rms/guest-experience/survey-questions') as Promise<{ data: Array<SurveyQuestion> }>
    ])
    guests.value = guestPayload.data
    questions.value = questionPayload.data
    guestId.value = openGuests.value[0]?.guest_id ?? null
  } catch (caught: unknown) {
    error.value = firstApiMessage(caught) ?? t('guestExperience.loadFailed')
  } finally {
    loading.value = false
  }
}

async function save(): Promise<void> {
  if (props.bookingId === null || guestId.value === null) {
    return
  }

  const body: Record<string, string | number | null> = {
    guest_id: guestId.value,
    call_notes: blank(callNotes.value)
  }

  for (const question of questions.value) {
    const raw = blank(draft.value[question.key])

    if (question.type === 'scale') {
      body[question.key] = raw === null ? null : Number(raw)
    } else {
      body[question.key] = raw
    }
  }

  submitting.value = true
  error.value = ''
  result.value = ''

  try {
    await request(`/api/rms/bookings/${String(props.bookingId)}/guest-responses`, {
      method: 'POST',
      body
    })
    const history = await request(
      `/api/rms/bookings/${String(props.bookingId)}/history?page=1`
    ) as Paginated<ChangeHistoryEntry>
    const entry = history.data.find(row => row.event === 'booking.nps_recorded')
    const what = entry?.after?.what
    result.value = typeof what === 'string' ? what : t('guestExperience.surveySaved')
    const savedId = guestId.value
    guests.value = guests.value.map(guest => (
      guest.guest_id === savedId ? { ...guest, responded: true } : guest
    ))
    guestId.value = openGuests.value[0]?.guest_id ?? null
    draft.value = {}
    callNotes.value = ''
    emit('saved')
  } catch (caught: unknown) {
    error.value = firstApiMessage(caught) ?? t('guestExperience.surveyFailed')
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <UModal
    :open="open"
    :title="t('guestExperience.surveyTitle')"
    @update:open="open = $event"
  >
    <template #body>
      <p
        v-if="loading"
        class="note"
      >
        {{ t('bookings.docPreviewLoading') }}
      </p>
      <form
        v-else
        class="modal-form"
        @submit.prevent="save"
      >
        <div
          v-if="error !== ''"
          class="warnbox"
        >
          {{ error }}
        </div>
        <p
          v-if="result !== ''"
          class="note"
        >
          {{ result }}
        </p>
        <p
          v-if="openGuests.length === 0"
          class="note"
        >
          {{ t('guestExperience.noGuests') }}
        </p>
        <template v-else>
          <div class="field">
            <label for="survey-guest">{{ t('guestExperience.surveyGuest') }}</label>
            <USelect
              id="survey-guest"
              :model-value="guestId ?? undefined"
              class="w-full"
              :items="guestItems"
              @update:model-value="onGuestUpdate"
            />
          </div>
          <div class="field">
            <label for="survey-call">{{ t('guestExperience.callNotes') }}</label>
            <input
              id="survey-call"
              v-model="callNotes"
              type="text"
            >
          </div>
          <div
            v-for="question in questions"
            :key="question.key"
            class="field"
          >
            <label :for="`survey-${question.key}`">{{ question.label }}</label>
            <input
              v-if="question.type === 'scale'"
              :id="`survey-${question.key}`"
              v-model="draft[question.key]"
              type="number"
              :min="question.min ?? undefined"
              :max="question.max ?? undefined"
            >
            <input
              v-else
              :id="`survey-${question.key}`"
              v-model="draft[question.key]"
              type="text"
            >
          </div>
          <div class="modal-actions">
            <UButton
              type="submit"
              :loading="submitting"
              :disabled="submitting || guestId === null"
            >
              {{ t('guestExperience.saveResponse') }}
            </UButton>
          </div>
        </template>
      </form>
    </template>
  </UModal>
</template>
