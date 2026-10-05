<script setup lang="ts">
import { applyApiFormError } from '../../utils/apiForm'
import type { RangeBlock } from './blockHelpers'

const props = defineProps<{
  open: boolean
  block: RangeBlock | null
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  'released': [block: RangeBlock]
}>()

const { t } = useI18n()
const { request } = useApi()
const toast = useToast()

const note = ref('')
const submitting = ref(false)
const conflict = ref('')

watch(() => props.open, (isOpen) => {
  if (isOpen) {
    note.value = ''
    conflict.value = ''
  }
})

async function submit(): Promise<void> {
  const releaseNote = note.value.trim()

  if (props.block === null || releaseNote === '') {
    return
  }

  submitting.value = true
  conflict.value = ''

  try {
    const released = await request(`/api/rms/blocks/${props.block.id}/release`, {
      method: 'POST',
      body: {
        note: releaseNote
      }
    }) as RangeBlock

    toast.add({
      title: t('blocks.releasedToast', { reference: released.reference })
    })
    emit('released', released)
    emit('update:open', false)
  } catch (error: unknown) {
    if (!applyApiFormError(error, (_fields, message) => {
      conflict.value = message
    })) {
      throw error
    }
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <UModal
    :open="open"
    :title="t('blocks.releaseTitle', { reference: block?.reference ?? '' })"
    @update:open="emit('update:open', $event)"
  >
    <template #body>
      <form
        class="modal-form"
        @submit.prevent="submit"
      >
        <div
          v-if="conflict"
          class="warnbox"
        >
          {{ conflict }}
        </div>
        <div class="field">
          <label>{{ t('blocks.releaseNote') }}</label>
          <textarea
            v-model="note"
            maxlength="500"
            rows="3"
          />
        </div>
        <div class="modal-actions">
          <UButton
            variant="outline"
            :disabled="submitting"
            @click="emit('update:open', false)"
          >
            {{ t('blocks.cancel') }}
          </UButton>
          <UButton
            type="submit"
            :loading="submitting"
            :disabled="submitting || note.trim() === ''"
          >
            {{ t('blocks.releaseConfirm') }}
          </UButton>
        </div>
      </form>
    </template>
  </UModal>
</template>
