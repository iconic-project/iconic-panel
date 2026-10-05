<script setup lang="ts">
import type { MealPlanCode, PlanDraft, SupplementBasis } from './rateHelpers'
import { useRatesDraft } from './rateHelpers'

defineProps<{
  canPublish: boolean
  errorsFor: (path: string) => Array<string>
  warningsFor: (path: string) => Array<string>
}>()

const draft = useRatesDraft('RatesStayRulesPanel')
const { t } = useI18n()

const bases: Array<{ label: string, value: SupplementBasis }> = [
  { label: t('rates.basisRoom'), value: 'ROOM' },
  { label: t('rates.basisPerson'), value: 'PERSON' }
]

const meals: Array<{ label: MealPlanCode, value: MealPlanCode }> = [
  { label: 'RO', value: 'RO' },
  { label: 'BB', value: 'BB' },
  { label: 'HB', value: 'HB' },
  { label: 'FB', value: 'FB' }
]

function addLength(): void {
  draft.value.length_of_stay.push({ min_nights: null, discount_pct: null })
}

function addSupplement(): void {
  draft.value.supplements.push({
    code: '',
    label: '',
    from: '',
    to: '',
    per_night: null,
    basis: 'ROOM'
  })
}

function addPlan(): void {
  const plan: PlanDraft = {
    code: '',
    name: '',
    default: draft.value.rate_plans.length === 0,
    adjust_pct: 0,
    refundable: true,
    deposit_pct: null,
    balance_days: null,
    cancellation: '',
    meal_plan: 'RO'
  }

  draft.value.rate_plans.push(plan)
}

function setDefault(index: number): void {
  draft.value.rate_plans.forEach((plan, item) => {
    plan.default = item === index
  })
}

function setBasis(index: number, value: string | number | null | undefined): void {
  const supplement = draft.value.supplements[index]

  if (supplement && (value === 'ROOM' || value === 'PERSON')) {
    supplement.basis = value
  }
}

function setMeal(index: number, value: string | number | null | undefined): void {
  const plan = draft.value.rate_plans[index]

  if (plan && (value === 'RO' || value === 'BB' || value === 'HB' || value === 'FB')) {
    plan.meal_plan = value
  }
}
</script>

<template>
  <AnkPanel :title="t('rates.lengthTitle')">
    <div class="rates-scroll">
      <table class="list">
        <thead>
          <tr>
            <th>{{ t('rates.minNights') }}</th>
            <th>{{ t('rates.discountPct') }}</th>
            <th />
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="(band, index) in draft.length_of_stay"
            :key="index"
          >
            <td>
              <ConfigNumberInput
                v-model="band.min_nights"
                :disabled="!canPublish"
                min="2"
                :bad="errorsFor(`length_of_stay.${index}.min_nights`).length > 0"
              />
            </td>
            <td>
              <div class="rcell">
                <ConfigNumberInput
                  v-model="band.discount_pct"
                  :disabled="!canPublish"
                  :bad="errorsFor(`length_of_stay.${index}.discount_pct`).length > 0"
                />
                <span class="mono">%</span>
              </div>
            </td>
            <td>
              <button
                v-if="canPublish"
                type="button"
                class="mini"
                @click="draft.length_of_stay.splice(index, 1)"
              >
                {{ t('rates.remove') }}
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <div
      v-if="canPublish"
      class="rhelp"
    >
      <UButton
        variant="outline"
        @click="addLength"
      >
        {{ t('rates.addLength') }}
      </UButton>
    </div>
    <p
      v-for="message in errorsFor('length_of_stay')"
      :key="message"
      class="rflag"
    >
      {{ message }}
    </p>
  </AnkPanel>

  <AnkPanel :title="t('rates.supplementsTitle')">
    <div class="rates-scroll">
      <table class="list">
        <thead>
          <tr>
            <th>{{ t('rates.code') }}</th>
            <th>{{ t('rates.label') }}</th>
            <th>{{ t('rates.from') }}</th>
            <th>{{ t('rates.to') }}</th>
            <th>{{ t('rates.perNight') }}</th>
            <th>{{ t('rates.basis') }}</th>
            <th />
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="(supplement, index) in draft.supplements"
            :key="index"
          >
            <td>
              <input
                v-model="supplement.code"
                class="field"
                :disabled="!canPublish"
              >
            </td>
            <td>
              <input
                v-model="supplement.label"
                class="field"
                :disabled="!canPublish"
              >
            </td>
            <td>
              <input
                v-model="supplement.from"
                class="field"
                type="date"
                :disabled="!canPublish"
              >
            </td>
            <td>
              <input
                v-model="supplement.to"
                class="field"
                type="date"
                :disabled="!canPublish"
              >
            </td>
            <td>
              <div class="rcell">
                <span class="mono">USD</span>
                <ConfigNumberInput
                  v-model="supplement.per_night"
                  :disabled="!canPublish"
                  min="0"
                />
              </div>
            </td>
            <td>
              <USelect
                :model-value="supplement.basis"
                :items="bases"
                :disabled="!canPublish"
                @update:model-value="setBasis(index, $event)"
              />
            </td>
            <td>
              <button
                v-if="canPublish"
                type="button"
                class="mini"
                @click="draft.supplements.splice(index, 1)"
              >
                {{ t('rates.remove') }}
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <div
      v-if="canPublish"
      class="rhelp"
    >
      <UButton
        variant="outline"
        @click="addSupplement"
      >
        {{ t('rates.addSupplement') }}
      </UButton>
    </div>
    <p
      v-for="message in errorsFor('supplements')"
      :key="message"
      class="rflag"
    >
      {{ message }}
    </p>
    <p
      v-for="message in warningsFor('supplements')"
      :key="message"
      class="rwarn"
    >
      ⚠ {{ message }}
    </p>
  </AnkPanel>

  <AnkPanel :title="t('rates.plansTitle')">
    <div class="rates-scroll">
      <table class="list">
        <thead>
          <tr>
            <th>{{ t('rates.code') }}</th>
            <th>{{ t('rates.name') }}</th>
            <th>{{ t('rates.defaultPlan') }}</th>
            <th>{{ t('rates.adjustPct') }}</th>
            <th>{{ t('rates.refundable') }}</th>
            <th>{{ t('rates.deposit') }}</th>
            <th>{{ t('rates.balanceDays') }}</th>
            <th>{{ t('rates.cancellationSet') }}</th>
            <th>{{ t('rates.mealPlan') }}</th>
            <th />
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="(plan, index) in draft.rate_plans"
            :key="index"
          >
            <td>
              <input
                v-model="plan.code"
                class="field"
                :disabled="!canPublish"
              >
            </td>
            <td>
              <input
                v-model="plan.name"
                class="field"
                :disabled="!canPublish"
              >
            </td>
            <td>
              <input
                type="radio"
                name="default-rate-plan"
                :checked="plan.default"
                :disabled="!canPublish"
                @change="setDefault(index)"
              >
            </td>
            <td>
              <div class="rcell">
                <ConfigNumberInput
                  v-model="plan.adjust_pct"
                  :disabled="!canPublish"
                />
                <span class="mono">%</span>
              </div>
            </td>
            <td>
              <input
                v-model="plan.refundable"
                type="checkbox"
                :disabled="!canPublish"
              >
            </td>
            <td>
              <div class="rcell">
                <ConfigNumberInput
                  v-model="plan.deposit_pct"
                  :disabled="!canPublish"
                  min="0"
                  max="100"
                />
                <span class="mono">%</span>
              </div>
            </td>
            <td>
              <ConfigNumberInput
                v-model="plan.balance_days"
                :disabled="!canPublish"
                min="0"
              />
            </td>
            <td>
              <input
                v-model="plan.cancellation"
                class="field"
                :disabled="!canPublish"
              >
            </td>
            <td>
              <USelect
                :model-value="plan.meal_plan"
                :items="meals"
                :disabled="!canPublish"
                @update:model-value="setMeal(index, $event)"
              />
            </td>
            <td>
              <button
                v-if="canPublish"
                type="button"
                class="mini"
                @click="draft.rate_plans.splice(index, 1)"
              >
                {{ t('rates.remove') }}
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <div
      v-if="canPublish"
      class="rhelp"
    >
      <UButton
        variant="outline"
        @click="addPlan"
      >
        {{ t('rates.addPlan') }}
      </UButton>
    </div>
    <p
      v-for="message in errorsFor('rate_plans')"
      :key="message"
      class="rflag"
    >
      {{ message }}
    </p>
  </AnkPanel>
</template>
