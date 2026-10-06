<script setup lang="ts">
import type { ContentCompleteness } from '../../types/api'
import { completenessBar } from '../itineraries/itineraryHelpers'

const props = defineProps<{
  completeness: ContentCompleteness
}>()

const bar = computed(() => completenessBar(props.completeness))
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
