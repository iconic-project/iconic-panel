<script setup lang="ts">
import { nightlyFor, withNightly } from './stayRates'
import { useRatesDraft } from './rateHelpers'

const props = defineProps<{
  canPublish: boolean
  roomTypes: Array<{ code: string, name: string }>
  errorsFor: (path: string) => Array<string>
  warningsFor: (path: string) => Array<string>
}>()

const draft = useRatesDraft('RatesRoomMatrix')
const { t } = useI18n()

const rows = computed(() => {
  const names = new Map<string, string>()

  for (const type of props.roomTypes) {
    names.set(type.code, type.name)
  }

  for (const rate of draft.value.room_rates) {
    if (!names.has(rate.room_type)) {
      names.set(rate.room_type, rate.room_type)
    }
  }

  return [...names.entries()].map(([code, name]) => ({ code, name }))
})

function cell(roomType: string, season: string): number | null {
  return nightlyFor(draft.value.room_rates, roomType, season)
}

function setCell(roomType: string, season: string, nightly: number | null): void {
  draft.value.room_rates = withNightly(draft.value.room_rates, roomType, season, nightly)
}
</script>

<template>
  <AnkPanel :title="t('rates.roomRatesTitle')">
    <p
      v-if="draft.seasons.length === 0 || rows.length === 0"
      class="note"
    >
      {{ t('rates.roomRatesEmpty') }}
    </p>

    <div
      v-else
      class="rates-scroll"
    >
      <table class="list">
        <thead>
          <tr>
            <th>{{ t('rates.roomType') }}</th>
            <th
              v-for="season in draft.seasons"
              :key="season.code || season.name"
            >
              {{ season.name || season.code }}
            </th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="row in rows"
            :key="row.code"
          >
            <td>{{ row.name }} <span class="mono">({{ row.code }})</span></td>
            <td
              v-for="season in draft.seasons"
              :key="`${row.code}-${season.code}`"
            >
              <div class="rcell">
                <span class="mono">USD</span>
                <ConfigNumberInput
                  :model-value="cell(row.code, season.code)"
                  :disabled="!canPublish || season.code === ''"
                  min="1"
                  step="1"
                  :aria-label="t('rates.nightlyFor', { room: row.code, season: season.code })"
                  @update:model-value="setCell(row.code, season.code, $event)"
                />
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <p
      v-for="message in errorsFor('room_rates')"
      :key="message"
      class="rflag"
    >
      {{ message }}
    </p>
    <p
      v-for="message in warningsFor('room_rates')"
      :key="message"
      class="rwarn"
    >
      ⚠ {{ message }}
    </p>
  </AnkPanel>
</template>
