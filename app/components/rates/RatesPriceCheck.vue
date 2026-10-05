<script setup lang="ts">
import type { StayRange } from '#iconic-ui/app/components/AnkStayInput.vue'
import type { PriceCheckQuote, PriceCheckRow, StayQuote } from '../../types/api'
import {
  blankStay,
  isStayQuote,
  quoteMessages,
  shownTaxes,
  type StayEditor
} from './stayRates'

const props = defineProps<{
  rows: Array<PriceCheckRow>
  stays: Array<StayEditor>
  stale: boolean
  roomTypes: Array<{ code: string, name: string }>
  plans: Array<{ code: string, name: string }>
}>()

const emit = defineEmits<{
  'update:stays': [value: Array<StayEditor>]
}>()

const { t } = useI18n()
const { format } = useMoney()

const roomItems = computed(() => props.roomTypes.map(type => ({
  label: `${type.name} (${type.code})`,
  value: type.code
})))

const planItems = computed(() => props.plans.map(plan => ({
  label: plan.name === '' ? plan.code : `${plan.name} (${plan.code})`,
  value: plan.code
})))

function replace(next: Array<StayEditor>): void {
  emit('update:stays', next)
}

function patch(index: number, stay: StayEditor): void {
  replace(props.stays.map((item, itemIndex) => itemIndex === index ? stay : item))
}

function rowFor(stay: StayEditor): PriceCheckRow | undefined {
  return props.rows.find(row => row.key === stay.key)
}

function rangeOf(stay: StayEditor): StayRange | null {
  if (stay.check_in === '' || stay.check_out === '') {
    return null
  }

  return { check_in: stay.check_in, check_out: stay.check_out }
}

function onRange(index: number, stay: StayEditor, value: StayRange | null): void {
  patch(index, {
    ...stay,
    check_in: value?.check_in ?? '',
    check_out: value?.check_out ?? ''
  })
}

function onRoom(index: number, stay: StayEditor, value: string | number | null | undefined): void {
  if (typeof value === 'string') {
    patch(index, { ...stay, room_type: value })
  }
}

function onPlan(index: number, stay: StayEditor, value: string | number | null | undefined): void {
  if (typeof value === 'string') {
    patch(index, { ...stay, rate_plan: value })
  }
}

function onAdults(index: number, stay: StayEditor, value: number | null): void {
  patch(index, { ...stay, adults: value })
}

function onAges(index: number, stay: StayEditor, event: Event): void {
  const target = event.target

  if (target instanceof HTMLInputElement) {
    patch(index, { ...stay, child_ages: target.value })
  }
}

function addStay(): void {
  replace([
    ...props.stays,
    blankStay(props.stays.length + 1, props.roomTypes[0]?.code ?? '', props.plans[0]?.code ?? '')
  ])
}

function removeStay(index: number): void {
  replace(props.stays.filter((_, item) => item !== index))
}

function quoteOf(stay: StayEditor): PriceCheckQuote | null {
  return rowFor(stay)?.draft ?? null
}

function draftQuote(stay: StayEditor): StayQuote | null {
  const quote = quoteOf(stay)

  return quote !== null && isStayQuote(quote) ? quote : null
}

function messagesFor(stay: StayEditor): Array<string> {
  const quote = quoteOf(stay)

  return quote === null ? [] : quoteMessages(quote)
}

function publishedTotal(stay: StayEditor): string {
  const quote = rowFor(stay)?.published

  if (quote === undefined) {
    return '—'
  }

  return isStayQuote(quote) ? format(quote.total) : t('rates.noRate')
}

function differenceText(difference: number | null | undefined): string {
  if (difference === null || difference === undefined) {
    return '—'
  }

  if (difference === 0) {
    return t('rates.noChange')
  }

  const sign = difference > 0 ? '+' : '−'

  return `${sign}${format(Math.abs(difference))}`
}

function differenceClass(difference: number | null | undefined): string {
  if (difference === null || difference === undefined || difference === 0) {
    return 'price-check-same'
  }

  return difference > 0 ? 'price-check-up' : 'price-check-down'
}
</script>

<template>
  <AnkPanel :title="t('rates.priceCheckTitle')">
    <p
      v-if="stale"
      class="note"
    >
      {{ t('rates.priceCheckStale') }}
    </p>

    <article
      v-for="(stay, index) in stays"
      :key="stay.key"
      class="price-stay"
      :class="{ 'price-check-dimmed': stale }"
    >
      <div class="rhelp">
        <span class="mono">{{ rowFor(stay)?.label ?? stay.key }}</span>
        <span :class="differenceClass(rowFor(stay)?.difference)">
          {{ differenceText(rowFor(stay)?.difference) }}
        </span>
        <button
          type="button"
          class="mini"
          @click="removeStay(index)"
        >
          {{ t('rates.remove') }}
        </button>
      </div>

      <div class="price-stay-fields">
        <AnkStayInput
          :model-value="rangeOf(stay)"
          :min-nights="1"
          :max-nights="366"
          @update:model-value="onRange(index, stay, $event)"
        />
        <USelect
          :model-value="stay.room_type"
          :items="roomItems"
          :placeholder="t('rates.roomType')"
          @update:model-value="onRoom(index, stay, $event)"
        />
        <label class="price-stay-ages">
          <span class="mono">{{ t('rates.adults') }}</span>
          <ConfigNumberInput
            :model-value="stay.adults"
            min="0"
            @update:model-value="onAdults(index, stay, $event)"
          />
        </label>
        <label class="price-stay-ages">
          <span class="mono">{{ t('rates.childAges') }}</span>
          <input
            class="field"
            :value="stay.child_ages"
            :placeholder="t('rates.childAgesHint')"
            @change="onAges(index, stay, $event)"
          >
        </label>
        <USelect
          :model-value="stay.rate_plan"
          :items="planItems"
          :placeholder="t('rates.plan')"
          @update:model-value="onPlan(index, stay, $event)"
        />
      </div>

      <p
        v-for="message in messagesFor(stay)"
        :key="message"
        class="rflag"
      >
        {{ message }}
      </p>

      <template v-if="draftQuote(stay)">
        <div class="rates-scroll">
          <table class="list">
            <thead>
              <tr>
                <th>{{ t('rates.night') }}</th>
                <th>{{ t('rates.season') }}</th>
                <th>{{ t('rates.nightTotal') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="night in draftQuote(stay)!.night_lines"
                :key="night.night"
              >
                <td class="mono">
                  {{ night.night }}
                </td>
                <td>{{ night.season }}</td>
                <td>{{ format(night.total) }}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="rates-scroll">
          <table class="list">
            <tbody>
              <tr
                v-for="line in draftQuote(stay)!.lines"
                :key="line.code"
              >
                <td>{{ line.label }}</td>
                <td>{{ format(line.amount) }}</td>
              </tr>
              <tr
                v-for="tax in shownTaxes(draftQuote(stay)!)"
                :key="tax.code"
              >
                <td>
                  {{ tax.label }}
                  <span
                    v-if="!tax.charged"
                    class="mono"
                  >{{ t('rates.notCharged') }}</span>
                </td>
                <td>{{ format(tax.amount) }}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <p class="note">
          {{ t('rates.roomTotal') }} {{ format(draftQuote(stay)!.total) }}
          · {{ t('rates.amountDue') }} {{ format(draftQuote(stay)!.total_including_charged_taxes) }}
          · {{ t('rates.depositShown', { pct: draftQuote(stay)!.deposit_pct, amount: format(draftQuote(stay)!.deposit) }) }}
          <template v-if="draftQuote(stay)!.terms.cancellation_set">
            · {{ t('rates.cancellationShown', { set: draftQuote(stay)!.terms.cancellation_set }) }}
          </template>
          · {{ t('rates.published') }} {{ publishedTotal(stay) }}
        </p>
      </template>
    </article>

    <div class="rhelp">
      <UButton
        variant="outline"
        @click="addStay"
      >
        {{ t('rates.addStay') }}
      </UButton>
    </div>
  </AnkPanel>
</template>
