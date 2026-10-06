<script setup lang="ts">
import type { SectionId } from '../../navigation/types'

const { t } = useI18n()
const { sectionId, switchTo } = useSystem()

const options: Array<{ id: SectionId, labelKey: string }> = [
  { id: 'rms', labelKey: 'shell.rms' },
  { id: 'crm', labelKey: 'shell.crm' }
]

function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
    event.preventDefault()
    switchTo(sectionId.value === 'rms' ? 'crm' : 'rms')
    return
  }

  if (event.key === 'Enter' || event.key === ' ') {
    const target = event.target as HTMLElement | null
    const id = target?.dataset.section as SectionId | undefined
    if (id) {
      event.preventDefault()
      switchTo(id)
    }
  }
}
</script>

<template>
  <div
    class="section-switch"
    role="radiogroup"
    :aria-label="t('shell.switchAria')"
    @keydown="onKeydown"
  >
    <button
      v-for="option in options"
      :key="option.id"
      type="button"
      role="radio"
      class="shell-seg"
      :class="{ on: sectionId === option.id }"
      :aria-checked="sectionId === option.id"
      :data-section="option.id"
      :tabindex="sectionId === option.id ? 0 : -1"
      @click="switchTo(option.id)"
    >
      {{ t(option.labelKey) }}
    </button>
  </div>
</template>
