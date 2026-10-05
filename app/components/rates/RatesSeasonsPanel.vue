<script setup lang="ts">
import { monthCoverage, seasonYears, type MonthCoverage } from './stayRates'
import { useRatesDraft } from './rateHelpers'

defineProps<{
  canPublish: boolean
  errorsFor: (path: string) => Array<string>
  warningsFor: (path: string) => Array<string>
}>()

const draft = useRatesDraft('RatesSeasonsPanel')
const { t } = useI18n()

const stripYear = ref<number | null>(null)

const years = computed(() => seasonYears(draft.value.seasons, new Date().getFullYear()))

watch(years, (next) => {
  if (stripYear.value === null || !next.includes(stripYear.value)) {
    stripYear.value = next[0] ?? null
  }
}, { immediate: true })

const months = computed((): Array<MonthCoverage> => {
  if (stripYear.value === null) {
    return []
  }

  return monthCoverage(draft.value.seasons, stripYear.value)
})

const yearItems = computed(() => years.value.map(year => ({
  label: String(year),
  value: year
})))

function addSeason(): void {
  draft.value.seasons.push({ code: '', name: '', from: '', to: '' })
}

function removeSeason(index: number): void {
  draft.value.seasons.splice(index, 1)
}

function onYear(value: string | number | null | undefined): void {
  if (typeof value === 'number') {
    stripYear.value = value
  }
}
</script>

<template>
  <AnkPanel :title="t('rates.seasonsTitle')">
    <div class="rates-scroll">
      <table class="list">
        <thead>
          <tr>
            <th>{{ t('rates.code') }}</th>
            <th>{{ t('rates.name') }}</th>
            <th>{{ t('rates.from') }}</th>
            <th>{{ t('rates.to') }}</th>
            <th />
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="(season, index) in draft.seasons"
            :key="index"
          >
            <td>
              <input
                v-model="season.code"
                class="field"
                :disabled="!canPublish"
                :class="{ bad: errorsFor(`seasons.${index}.code`).length > 0 }"
              >
            </td>
            <td>
              <input
                v-model="season.name"
                class="field"
                :disabled="!canPublish"
                :class="{ bad: errorsFor(`seasons.${index}.name`).length > 0 }"
              >
            </td>
            <td>
              <input
                v-model="season.from"
                class="field"
                type="date"
                :disabled="!canPublish"
                :class="{ bad: errorsFor(`seasons.${index}.from`).length > 0 }"
              >
            </td>
            <td>
              <input
                v-model="season.to"
                class="field"
                type="date"
                :disabled="!canPublish"
                :class="{ bad: errorsFor(`seasons.${index}.to`).length > 0 }"
              >
            </td>
            <td>
              <button
                v-if="canPublish"
                type="button"
                class="mini"
                @click="removeSeason(index)"
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
        @click="addSeason"
      >
        {{ t('rates.addSeason') }}
      </UButton>
    </div>

    <div class="rhelp">
      <span class="mono">{{ t('rates.coverageYear') }}</span>
      <USelect
        :model-value="stripYear ?? undefined"
        :items="yearItems"
        @update:model-value="onYear"
      />
    </div>

    <div
      class="season-strip"
      :aria-label="t('rates.coverageStrip')"
    >
      <div
        v-for="month in months"
        :key="month.month"
        class="season-month"
        :class="{ 'is-gap': month.gap, 'is-partial': !month.gap && month.covered < month.nights }"
      >
        <span class="mono">{{ month.label }}</span>
        <span class="season-month-note">
          {{ month.gap ? t('rates.gap') : t('rates.coveredNights', { covered: month.covered, nights: month.nights }) }}
        </span>
      </div>
    </div>

    <p
      v-for="message in errorsFor('seasons')"
      :key="message"
      class="rflag"
    >
      {{ message }}
    </p>
    <p
      v-for="message in [...warningsFor('seasons'), ...warningsFor('stay_restrictions')]"
      :key="message"
      class="rwarn"
    >
      ⚠ {{ message }}
    </p>
  </AnkPanel>
</template>
