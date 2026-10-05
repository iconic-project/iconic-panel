<script setup lang="ts">
import { RULES_DRAFT_KEY, type TaxBasisCode, type TaxDraft } from './rulesHelpers'

defineProps<{
  canEdit: boolean
  errorsFor: (path: string) => Array<string>
}>()

const injected = inject(RULES_DRAFT_KEY)

if (injected === undefined) {
  throw new Error('RulesTaxesEditor requires a provided business-rules draft')
}

const draft = computed(() => {
  const value = injected.value

  if (value === null) {
    throw new Error('RulesTaxesEditor requires a business-rules draft')
  }

  return value
})

const { t } = useI18n()

const bases: Array<{ label: string, value: TaxBasisCode }> = [
  { label: t('businessRules.basisPerStay'), value: 'PER_STAY' },
  { label: t('businessRules.basisPerNight'), value: 'PER_NIGHT' },
  { label: t('businessRules.basisPerPerson'), value: 'PER_PERSON_PER_NIGHT' },
  { label: t('businessRules.basisPct'), value: 'PCT_OF_ROOM' }
]

const taxRows = computed(() => draft.value.taxes ?? [])

function list(): Array<TaxDraft> {
  if (!draft.value.taxes) {
    draft.value.taxes = []
  }

  return draft.value.taxes
}

function addTax(): void {
  list().push({
    code: '',
    label: '',
    basis: 'PER_STAY',
    amount: null,
    child_exempt_under_age: null,
    charged: true,
    shown_in_price_panel: true
  })
}

function setBasis(index: number, value: string | number | null | undefined): void {
  const tax = list()[index]

  if (!tax) {
    return
  }

  if (value === 'PER_STAY' || value === 'PER_NIGHT' || value === 'PER_PERSON_PER_NIGHT' || value === 'PCT_OF_ROOM') {
    tax.basis = value
  }
}
</script>

<template>
  <div class="tax-editor">
    <div
      v-for="(tax, index) in taxRows"
      :key="index"
      class="tax-row"
    >
      <input
        v-model="tax.code"
        class="field"
        :placeholder="t('rates.code')"
        :disabled="!canEdit"
        :class="{ bad: errorsFor(`taxes.${index}.code`).length > 0 }"
      >
      <input
        v-model="tax.label"
        class="field"
        :placeholder="t('rates.label')"
        :disabled="!canEdit"
      >
      <USelect
        :model-value="tax.basis"
        :items="bases"
        :disabled="!canEdit"
        @update:model-value="setBasis(index, $event)"
      />
      <ConfigNumberInput
        v-model="tax.amount"
        :disabled="!canEdit"
        min="0"
        :bad="errorsFor(`taxes.${index}.amount`).length > 0"
      />
      <label class="chkline">
        <input
          v-model="tax.charged"
          type="checkbox"
          :disabled="!canEdit"
        >
        {{ t('businessRules.charged') }}
      </label>
      <label class="chkline">
        <input
          v-model="tax.shown_in_price_panel"
          type="checkbox"
          :disabled="!canEdit"
        >
        {{ t('businessRules.shownInPrice') }}
      </label>
      <button
        v-if="canEdit"
        type="button"
        class="mini"
        @click="list().splice(index, 1)"
      >
        {{ t('rates.remove') }}
      </button>
    </div>
    <button
      v-if="canEdit"
      type="button"
      class="mini"
      @click="addTax"
    >
      {{ t('businessRules.addTax') }}
    </button>
    <p
      v-for="message in errorsFor('taxes')"
      :key="message"
      class="rflag"
    >
      {{ message }}
    </p>
  </div>
</template>
