<script setup lang="ts">
import { addBand, MAX_BANDS, removeBand, RULES_DRAFT_KEY, type BandDraft } from './rulesHelpers'

defineProps<{
  canEdit: boolean
  errorsFor: (path: string) => Array<string>
}>()

const injected = inject(RULES_DRAFT_KEY)

if (injected === undefined) {
  throw new Error('RulesSetsEditor requires a provided business-rules draft')
}

const draft = computed(() => {
  const value = injected.value

  if (value === null) {
    throw new Error('RulesSetsEditor requires a business-rules draft')
  }

  return value
})

const { t } = useI18n()
const newCode = ref('')

const setRows = computed(() => draft.value.cancellation.sets ?? {})

function sets(): Record<string, Array<BandDraft>> {
  if (!draft.value.cancellation.sets) {
    draft.value.cancellation.sets = {}
  }

  return draft.value.cancellation.sets
}

function codes(): Array<string> {
  return Object.keys(setRows.value)
}

function addSet(): void {
  const code = newCode.value.trim()

  if (code === '' || code in sets()) {
    return
  }

  sets()[code] = [{ min_days: null, penalty_pct: null }]
  newCode.value = ''
}

function removeSet(code: string): void {
  const next: Record<string, Array<BandDraft>> = {}

  for (const [key, bands] of Object.entries(sets())) {
    if (key !== code) {
      next[key] = bands
    }
  }

  draft.value.cancellation.sets = next
}

function setDays(code: string, index: number, value: number | null): void {
  const band = sets()[code]?.[index]

  if (band) {
    band.min_days = value
  }
}

function setPct(code: string, index: number, value: number | null): void {
  const band = sets()[code]?.[index]

  if (band) {
    band.penalty_pct = value
  }
}
</script>

<template>
  <div class="sets-editor">
    <div
      v-for="code in codes()"
      :key="code"
      class="set-block"
    >
      <div class="rhelp">
        <span class="mono">{{ code }}</span>
        <button
          v-if="canEdit"
          type="button"
          class="mini"
          @click="removeSet(code)"
        >
          {{ t('rates.remove') }}
        </button>
      </div>
      <div
        v-for="(band, index) in sets()[code]"
        :key="index"
        class="rcell"
      >
        <span class="mono">≥</span>
        <ConfigNumberInput
          :model-value="band.min_days"
          :disabled="!canEdit"
          :bad="errorsFor(`cancellation.sets.${code}.${index}.min_days`).length > 0"
          @update:model-value="setDays(code, index, $event)"
        />
        <span class="mono">{{ t('businessRules.daysTo') }}</span>
        <ConfigNumberInput
          :model-value="band.penalty_pct"
          :disabled="!canEdit"
          :bad="errorsFor(`cancellation.sets.${code}.${index}.penalty_pct`).length > 0"
          @update:model-value="setPct(code, index, $event)"
        />
        <span class="mono">%</span>
        <button
          v-if="canEdit && (sets()[code]?.length ?? 0) > 1"
          type="button"
          class="mini"
          @click="sets()[code] = removeBand(sets()[code] ?? [], index)"
        >
          {{ t('businessRules.removeBand') }}
        </button>
      </div>
      <button
        v-if="canEdit && (sets()[code]?.length ?? 0) < MAX_BANDS"
        type="button"
        class="mini"
        @click="sets()[code] = addBand(sets()[code] ?? [])"
      >
        {{ t('businessRules.addBand') }}
      </button>
    </div>
    <div
      v-if="canEdit"
      class="rcell"
    >
      <input
        v-model="newCode"
        class="field"
        :placeholder="t('businessRules.setCode')"
      >
      <button
        type="button"
        class="mini"
        @click="addSet"
      >
        {{ t('businessRules.addSet') }}
      </button>
    </div>
  </div>
</template>
