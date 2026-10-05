<script setup lang="ts">
import type { BlockReason } from '../../types/api'
import { firstApiMessage } from '../../utils/apiForm'
import { confirmUnsaved } from '../../composables/useUnsavedGuard'
import HistoryDrawer from '../history/HistoryDrawer.vue'
import { BLOCK_REASONS, reasonLabelKey, type RangeBlock } from './blockHelpers'

const isOpen = defineModel<boolean>('open', { required: true })

const props = defineProps<{
  source: RangeBlock | null
  canManage: boolean
  roleName: string
}>()

const emit = defineEmits<{
  saved: [block: RangeBlock]
}>()

const { t } = useI18n()
const { request } = useApi()
const { format } = useDates()
const toast = useToast()

const reason = ref<BlockReason>('FAM_TRIP')
const notes = ref('')
const snapshot = ref('')
const warn = ref('')
const saving = ref(false)
const historyOpen = ref(false)

const canEdit = computed(() => props.canManage && props.source !== null && props.source.released_at === null)

const reasonItems = computed(() => BLOCK_REASONS.map(item => ({
  label: t(reasonLabelKey(item)),
  value: item
})))

const dirty = computed(() => {
  if (!canEdit.value) {
    return false
  }

  return `${reason.value}\0${notes.value}` !== snapshot.value
})

const historyUrl = computed(() => {
  return props.source ? `/api/rms/blocks/${props.source.id}/history` : null
})

const lines = computed(() => {
  if (props.source === null) {
    return []
  }

  const stay = `${format(props.source.starts_on, 'short')} – ${format(props.source.ends_on, 'short')}`
  const rooms = props.source.rooms.map(room => room.label).join(', ')

  return [props.source.scope_summary, stay, rooms].filter(line => line !== '')
})

watch(
  () => [isOpen.value, props.source] as const,
  ([open, source]) => {
    if (!open || source === null) {
      return
    }

    reason.value = source.reason
    notes.value = source.notes ?? ''
    snapshot.value = `${source.reason}\0${source.notes ?? ''}`
    warn.value = ''
    historyOpen.value = false
  }
)

useUnsavedGuard(dirty, () => t('blocks.leaveUnsaved'))

function onUpdateOpen(next: boolean): void {
  if (!next && dirty.value && !confirmUnsaved(t('blocks.leaveUnsaved'))) {
    return
  }

  isOpen.value = next
}

function actorName(actor: { name: string } | null): string {
  return actor?.name ?? t('blocks.system')
}

async function save(): Promise<void> {
  if (props.source === null || !canEdit.value) {
    return
  }

  saving.value = true
  warn.value = ''

  try {
    const updated = await request(`/api/rms/blocks/${props.source.id}`, {
      method: 'PATCH',
      body: {
        reason: reason.value,
        notes: notes.value === '' ? null : notes.value
      }
    }) as RangeBlock

    snapshot.value = `${updated.reason}\0${updated.notes ?? ''}`
    reason.value = updated.reason
    notes.value = updated.notes ?? ''
    toast.add({ title: t('blocks.saved') })
    emit('saved', updated)
  } catch (error: unknown) {
    warn.value = firstApiMessage(error) ?? (error instanceof Error ? error.message : '')
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <USlideover
    :open="isOpen"
    class="history-drawer"
    @update:open="onUpdateOpen"
  >
    <template #header>
      <div class="itin-header">
        <div>
          <h2>{{ source?.reference }}</h2>
          <div
            v-if="source"
            class="bid"
          >
            <span class="pill">{{ source.reason_label }}</span>
          </div>
        </div>
        <UButton
          v-if="source"
          variant="outline"
          @click="historyOpen = true"
        >
          {{ t('blocks.history') }}
        </UButton>
      </div>
    </template>

    <template #body>
      <p
        v-if="!canManage"
        class="notice"
      >
        {{ t('blocks.viewOnly', { role: roleName }) }}
      </p>

      <template v-if="source">
        <div class="sec">
          <h4>{{ t('blocks.scope') }}</h4>
          <p
            v-for="line in lines"
            :key="line"
            class="blk-scope"
          >
            {{ line }}
          </p>
        </div>

        <fieldset
          v-if="canEdit"
          class="edfs"
        >
          <div class="sec">
            <h4>{{ t('blocks.reason') }}</h4>
            <p class="notice">
              {{ t('blocks.scopeChange') }}
            </p>
            <div class="field">
              <USelect
                v-model="reason"
                :items="reasonItems"
                class="w-full"
              />
            </div>
            <div class="field">
              <label>
                {{ t('blocks.notes') }}
                <span class="cnt">· {{ t('blocks.notesCounter', { n: String(notes.length) }) }}</span>
              </label>
              <textarea
                v-model="notes"
                maxlength="500"
                rows="3"
              />
            </div>
          </div>
        </fieldset>
        <div
          v-else
          class="sec"
        >
          <h4>{{ t('blocks.notes') }}</h4>
          <p class="blk-scope">
            {{ source.notes || '—' }}
          </p>
        </div>

        <p class="blk-meta">
          {{ t('blocks.created', {
            date: format(source.created_at, 'short'),
            name: actorName(source.created_by)
          }) }}
        </p>
        <p
          v-if="source.released_at"
          class="blk-meta"
        >
          {{ t('blocks.releasedBy', {
            date: format(source.released_at, 'short'),
            name: actorName(source.released_by)
          }) }}
        </p>

        <div
          v-if="warn"
          class="warnbox"
        >
          {{ warn }}
        </div>

        <div class="transbtns">
          <UButton
            v-if="canEdit"
            :disabled="saving || !dirty"
            :loading="saving"
            @click="save"
          >
            {{ t('blocks.save') }}
          </UButton>
          <UButton
            variant="outline"
            @click="onUpdateOpen(false)"
          >
            {{ canManage ? t('blocks.cancel') : t('blocks.close') }}
          </UButton>
        </div>
      </template>
    </template>
  </USlideover>

  <HistoryDrawer
    v-model:open="historyOpen"
    :title="source?.reference ?? ''"
    :subject-type="t('blocks.subject')"
    :url="historyUrl"
  />
</template>
