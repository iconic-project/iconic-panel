<script setup lang="ts">
import { WEEKDAYS } from './stayRates'
import { useRatesDraft } from './rateHelpers'

defineProps<{
  canPublish: boolean
  errorsFor: (path: string) => Array<string>
}>()

const draft = useRatesDraft('RatesOccupancyPanel')
const { t } = useI18n()
</script>

<template>
  <AnkPanel :title="t('rates.occupancyTitle')">
    <div class="rates-scroll">
      <table class="list">
        <tbody>
          <tr>
            <td>{{ t('rates.extraAdult') }}</td>
            <td>
              <div class="rcell">
                <span class="mono">USD</span>
                <ConfigNumberInput
                  v-model="draft.occupancy.extra_adult_nightly"
                  :disabled="!canPublish"
                  min="0"
                  :bad="errorsFor('occupancy.extra_adult_nightly').length > 0"
                />
              </div>
            </td>
          </tr>
          <tr>
            <td>{{ t('rates.extraChild') }}</td>
            <td>
              <div class="rcell">
                <span class="mono">USD</span>
                <ConfigNumberInput
                  v-model="draft.occupancy.extra_child_nightly"
                  :disabled="!canPublish"
                  min="0"
                  :bad="errorsFor('occupancy.extra_child_nightly').length > 0"
                />
              </div>
            </td>
          </tr>
          <tr>
            <td>{{ t('rates.singleOccupancy') }}</td>
            <td>
              <div class="rcell">
                <ConfigNumberInput
                  v-model="draft.occupancy.single_occupancy_pct"
                  :disabled="!canPublish"
                  :bad="errorsFor('occupancy.single_occupancy_pct').length > 0"
                />
                <span class="mono">%</span>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </AnkPanel>

  <AnkPanel :title="t('rates.dayOfWeekTitle')">
    <div class="rates-scroll">
      <table class="list">
        <thead>
          <tr>
            <th
              v-for="day in WEEKDAYS"
              :key="day"
            >
              {{ t(`rates.weekday${day}`) }}
            </th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td
              v-for="day in WEEKDAYS"
              :key="day"
            >
              <div class="rcell">
                <ConfigNumberInput
                  v-model="draft.day_of_week[day]"
                  :disabled="!canPublish"
                  :bad="errorsFor(`day_of_week.${day}`).length > 0"
                  :aria-label="t(`rates.weekday${day}`)"
                />
                <span class="mono">%</span>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </AnkPanel>
</template>
