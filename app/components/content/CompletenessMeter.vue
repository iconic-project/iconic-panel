<script setup lang="ts">
import type { ContentCompleteness } from '../../types/api'

const props = defineProps<{
  completeness: ContentCompleteness
}>()

const bar = computed(() => {
  const completeness = props.completeness
  const barColor = completeness.pct === 100
    ? 'var(--ok)'
    : completeness.blocking.length > 0
      ? 'var(--coral)'
      : 'var(--sand)'
  const labelColor = completeness.missing.length > 0 ? 'var(--coral-400)' : 'var(--ok)'
  const missing = completeness.missing.length > 0
    ? ` · MISSING: ${completeness.missing.join(', ').toUpperCase()}`
    : ''

  return {
    barColor,
    labelColor,
    label: `${completeness.pct}% COMPLETE${missing}`
  }
})
</script>

<template>
  <div>
    <div class="cmp">
      <i :style="{ width: `${completeness.pct}%`, background: bar.barColor }" />
    </div>
    <div
      class="mono itin-complete"
      :style="{ color: bar.labelColor }"
    >
      {{ bar.label }}
    </div>
  </div>
</template>
