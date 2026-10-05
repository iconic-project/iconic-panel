<script setup lang="ts">
import type { RangeBlock } from './blockHelpers'
import { shortenEdge } from './blockHelpers'
import { applyApiFormError, type FormFieldErrors } from '../../utils/apiForm'

const open = defineModel<boolean>('open', { required: true })

const props = defineProps<{
  block: RangeBlock | null
}>()

const emit = defineEmits<{
  shortened: []
}>()

const { t } = useI18n()
const toast = useToast()
const { request } = useApi()

const startsOn = ref('')
const endsOn = ref('')
const reason = ref('')
const saving = ref(false)
const fieldErrors = ref<FormFieldErrors>({})
const conflict = ref('')

const edge = computed(() => {
  if (props.block === null) {
    return 'unchanged' as const
  }

  return shortenEdge(props.block, {
    starts_on: startsOn.value,
    ends_on: endsOn.value
  })
})

watch(open, (isOpen) => {
  if (!isOpen || props.block === null) {
    return
  }

  startsOn.value = props.block.starts_on
  endsOn.value = props.block.ends_on
  reason.value = ''
  fieldErrors.value = {}
  conflict.value = ''
})

async function submit(): Promise<void> {
  if (props.block === null || edge.value === 'unchanged' || edge.value === 'both') {
    return
  }

  saving.value = true
  fieldErrors.value = {}
  conflict.value = ''

  try {
    await request(`/api/rms/blocks/${props.block.id}/shorten`, {
      method: 'POST',
      body: {
        starts_on: startsOn.value,
        ends_on: endsOn.value,
        reason: reason.value.trim()
      }
    })
    toast.add({ title: t('blocks.shortened'), color: 'success' })
    open.value = false
    emit('shortened')
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
    :title="t('blocks.shortenTitle')"
    :description="block?.reference"
  >
    <template #body>
      <form
        v-if="block"
        class="stack"
        @submit.prevent="submit"
      >
        <p class="notice">
          {{ t('blocks.shortenHelp') }}
        </p>
        <UFormField
          :label="t('blocks.startsOn')"
          :error="fieldErrors.starts_on"
        >
          <UInput
            v-model="startsOn"
            type="date"
            :min="block.starts_on"
            :max="block.ends_on"
            class="w-full"
          />
        </UFormField>
        <UFormField
          :label="t('blocks.endsOn')"
          :error="fieldErrors.ends_on"
        >
          <UInput
            v-model="endsOn"
            type="date"
            :min="block.starts_on"
            :max="block.ends_on"
            class="w-full"
          />
        </UFormField>
        <p
          v-if="edge === 'both' || edge === 'unchanged'"
          class="field-error"
        >
          {{ edge === 'both' ? t('blocks.shortenOneEdge') : t('blocks.shortenUnchanged') }}
        </p>
        <UFormField
          :label="t('blocks.shortenReason')"
          :error="fieldErrors.reason"
        >
          <UTextarea
            v-model="reason"
            class="w-full"
            :rows="3"
            required
          />
        </UFormField>
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
            :disabled="(edge !== 'start' && edge !== 'end') || reason.trim() === ''"
          >
            {{ t('blocks.shorten') }}
          </UButton>
        </div>
      </form>
    </template>
  </UModal>
</template>
