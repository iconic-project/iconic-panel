<script setup lang="ts">
import type { RuleRegistryRow } from '../../types/api'
import {
  getByPath,
  isNoCap,
  rowDiffers,
  ruleFieldMeta,
  RULES_DRAFT_KEY,
  setByPath,
  setNoCap,
  sharedUnit,
  type RuleFieldMeta
} from './rulesHelpers'

const props = defineProps<{
  row: RuleRegistryRow
  canEdit: boolean
  errorsFor: (path: string) => Array<string>
}>()

const injected = inject(RULES_DRAFT_KEY)

if (injected === undefined) {
  throw new Error('RulesCurrentCell requires a provided business-rules draft')
}

const draft = computed(() => {
  const value = injected.value

  if (value === null) {
    throw new Error('RulesCurrentCell requires a business-rules draft')
  }

  return value
})

const { t } = useI18n()

const capInput = useTemplateRef<{ focus: () => void }>('capInput')
const editingCap = ref(false)

const differs = computed(() => rowDiffers(props.row, draft.value))

const isHere = computed(() => props.row.where === 'here')

const isBands = computed(() => props.row.key === 'cancellation-bands')

const isNoCapRow = computed(() => props.row.key === 'max-total-discount')

const isReminders = computed(() => props.row.key === 'balance-reminders')

const isTwoPath = computed(() => props.row.paths.length === 2)

const singlePath = computed(() => props.row.paths[0])

const capValue = computed(() => draft.value.discounts.max_total_discount_pct)

const noCapChecked = computed(() => isNoCap(capValue.value) && !editingCap.value)

watch(() => injected.value, (next) => {
  if (next === null) {
    return
  }

  editingCap.value = !isNoCap(next.discounts.max_total_discount_pct)
})

function meta(path: string): RuleFieldMeta | undefined {
  return ruleFieldMeta(path)
}

function bad(path: string): boolean {
  return props.errorsFor(path).length > 0
}

function getPathNumber(path: string): number | null {
  const value = getByPath(draft.value, path)

  return typeof value === 'number' ? value : null
}

function setPath(path: string, value: number | null): void {
  setByPath(draft.value, path, value)
}

function setSingle(value: number | null): void {
  const path = props.row.paths[0]

  if (path !== undefined) {
    setByPath(draft.value, path, value)
  }
}

function setReminder(index: number, value: number | null): void {
  draft.value.payments.balance_reminder_days[index] = value
}

async function onNoCapChange(event: Event): Promise<void> {
  const target = event.target

  if (!(target instanceof HTMLInputElement)) {
    return
  }

  if (target.checked) {
    editingCap.value = false
    draft.value.discounts.max_total_discount_pct = setNoCap()
    return
  }

  editingCap.value = true
  await nextTick()
  capInput.value?.focus()
}

function onCapInput(value: number | null): void {
  draft.value.discounts.max_total_discount_pct = value
}

const pairUnit = computed(() => sharedUnit(props.row))

const reminderMeta = computed(() => meta('payments.balance_reminder_days'))

const capMeta = computed(() => meta('discounts.max_total_discount_pct'))
</script>

<template>
  <div>
    <RulesTaxesEditor
      v-if="isHere && row.key === 'taxes'"
      :can-edit="canEdit"
      :errors-for="errorsFor"
    />

    <RulesSetsEditor
      v-else-if="isHere && row.key === 'cancellation-sets'"
      :can-edit="canEdit"
      :errors-for="errorsFor"
    />

    <RulesBandEditor
      v-else-if="isHere && isBands"
      :can-edit="canEdit"
      :errors-for="errorsFor"
    />

    <div
      v-else-if="isHere && isNoCapRow"
      class="rcell"
    >
      <ConfigNumberInput
        ref="capInput"
        :model-value="capValue"
        :min="capMeta?.min"
        :max="capMeta?.max"
        :disabled="!canEdit || noCapChecked"
        :bad="bad('discounts.max_total_discount_pct')"
        @update:model-value="onCapInput"
      />
      <span class="mono">%</span>
      <label class="chkline">
        <input
          type="checkbox"
          :checked="noCapChecked"
          :disabled="!canEdit"
          @change="onNoCapChange"
        >
        {{ t('businessRules.noCap') }}
      </label>
    </div>

    <div
      v-else-if="isHere && isReminders"
      class="rcell"
    >
      <ConfigNumberInput
        :model-value="draft.payments.balance_reminder_days[0] ?? null"
        :min="reminderMeta?.min"
        :max="reminderMeta?.max"
        :disabled="!canEdit"
        :bad="bad('payments.balance_reminder_days')"
        @update:model-value="setReminder(0, $event)"
      />
      <span class="mono">/</span>
      <ConfigNumberInput
        :model-value="draft.payments.balance_reminder_days[1] ?? null"
        :min="reminderMeta?.min"
        :max="reminderMeta?.max"
        :disabled="!canEdit"
        :bad="bad('payments.balance_reminder_days')"
        @update:model-value="setReminder(1, $event)"
      />
      <span
        v-if="reminderMeta"
        class="mono"
      >{{ reminderMeta.unit }}</span>
    </div>

    <div
      v-else-if="isHere && isTwoPath"
      class="rcell"
    >
      <template
        v-for="(path, index) in row.paths"
        :key="path"
      >
        <span
          v-if="index > 0"
          class="mono"
        >/</span>
        <span
          v-if="meta(path)?.prefix"
          class="mono"
        >{{ meta(path)?.prefix }}</span>
        <ConfigNumberInput
          :model-value="(getPathNumber(path))"
          :min="meta(path)?.min"
          :max="meta(path)?.max"
          :disabled="!canEdit"
          :bad="bad(path)"
          @update:model-value="setPath(path, $event)"
        />
        <span
          v-if="!pairUnit && meta(path) && !meta(path)?.prefix"
          class="mono"
        >{{ meta(path)?.unit }}</span>
      </template>
      <span
        v-if="pairUnit"
        class="mono"
      >{{ pairUnit }}</span>
    </div>

    <div
      v-else-if="isHere && singlePath"
      class="rcell"
    >
      <span
        v-if="meta(singlePath)?.prefix"
        class="mono"
      >{{ meta(singlePath)?.prefix }}</span>
      <ConfigNumberInput
        :model-value="getPathNumber(singlePath)"
        :min="meta(singlePath)?.min"
        :max="meta(singlePath)?.max"
        :disabled="!canEdit"
        :bad="bad(singlePath)"
        @update:model-value="setSingle($event)"
      />
      <span
        v-if="meta(singlePath) && !meta(singlePath)?.prefix"
        class="mono"
      >{{ meta(singlePath)?.unit }}</span>
    </div>

    <span v-else>{{ row.current_display }}</span>

    <div
      v-if="row.lock_reason"
      class="yoy"
    >
      🔒 {{ row.lock_reason }}
    </div>

    <div
      v-if="differs"
      class="rflag"
    >
      {{ t('businessRules.differs') }}
    </div>
  </div>
</template>
