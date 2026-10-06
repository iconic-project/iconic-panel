<script setup lang="ts">
import type { ExtrasCatalogue, PriceCheckRow } from '../../../types/api'
import type { ConfigValueFormat } from '../../../utils/formatConfigValue'
import { rateFieldLabels, RATES_DRAFT_KEY, type RatesDraft } from '../../../components/rates/rateHelpers'
import { stayEditorsFrom, stayRequests, type StayEditor } from '../../../components/rates/stayRates'
import {
  EXTRAS_DRAFT_KEY,
  extrasFieldLabels,
  extrasFormats,
  publishedCodes,
  type ExtrasDraft
} from '../../../components/extras/extrasCatalogueHelpers'
import { cloneDocument } from '../../../utils/documentsEqual'
import RatesPromotionsPanel from '../../../components/offers/RatesPromotionsPanel.vue'

const { can } = useAuth()
const { t } = useI18n()
const { request } = useApi()

const editor = useConfigEditor('rates')
const extrasEditor = useConfigEditor('extras')
const canPublish = computed(() => can('rates.manage'))
const canPublishExtras = computed(() => can('extras.manage'))
const draft = computed(() => editor.draft as RatesDraft | null)
const extrasDraft = computed(() => extrasEditor.draft as ExtrasDraft | null)

provide(RATES_DRAFT_KEY, draft)
provide(EXTRAS_DRAFT_KEY, extrasDraft)

useUnsavedGuard(() => editor.dirty || extrasEditor.dirty, () => t('config.leaveUnsaved'))

const extrasLabels = computed(() => {
  return extrasDraft.value ? extrasFieldLabels(extrasDraft.value) : {}
})

const extrasValueFormats = computed(() => {
  return extrasDraft.value ? extrasFormats(extrasDraft.value) : {}
})

const extrasPublishedCodes = computed(() => {
  const document = extrasEditor.current?.document as ExtrasCatalogue | undefined

  return document === undefined ? new Set<string>() : publishedCodes(document)
})

const priceCheckRows = ref<Array<PriceCheckRow>>([])
const priceCheckStays = ref<Array<StayEditor>>([])
const priceCheckStale = ref(false)
let priceCheckSeq = 0

type RoomTypeOption = {
  code: string
  name: string
  status: string
}

const roomTypes = ref<Array<{ code: string, name: string }>>([])

const planOptions = computed(() => {
  return draft.value?.rate_plans.map(plan => ({ code: plan.code, name: plan.name })) ?? []
})

const labels = computed(() => {
  return draft.value ? rateFieldLabels(draft.value) : {}
})

const formats: Record<string, ConfigValueFormat> = {
  room_rates: 'money',
  supplements: 'money'
}

onMounted(async () => {
  const properties = await request('/api/rms/properties') as { data: Array<{ id: number }> }
  const lists = await Promise.all(properties.data.map(property =>
    request(`/api/rms/properties/${property.id}/room-types`) as Promise<{ data: Array<RoomTypeOption> }>
  ))

  roomTypes.value = lists
    .flatMap(list => list.data)
    .filter(type => type.status === 'ACTIVE')
    .map(type => ({ code: type.code, name: type.name }))
})

watch(priceCheckStays, () => {
  void runPriceCheck()
}, { deep: true })

watch(
  () => [editor.loading, editor.validating, editor.hasErrors] as const,
  () => {
    void runPriceCheck()
  }
)

async function runPriceCheck(): Promise<void> {
  if (editor.loading || editor.validating || draft.value === null) {
    return
  }

  if (editor.hasErrors) {
    priceCheckStale.value = true
    return
  }

  const id = ++priceCheckSeq
  const document = cloneDocument(toRaw(draft.value))
  const stays = stayRequests(priceCheckStays.value)

  try {
    const body = await request('/api/rms/rates/price-check', {
      method: 'POST',
      body: stays.length === 0 ? { document } : { document, stays }
    }) as { scenarios: Array<PriceCheckRow> }

    if (id !== priceCheckSeq) {
      return
    }

    priceCheckRows.value = body.scenarios

    if (priceCheckStays.value.length === 0) {
      priceCheckStays.value = stayEditorsFrom(body.scenarios)
    }

    priceCheckStale.value = false
  } catch {
    if (id === priceCheckSeq) {
      priceCheckStale.value = true
    }
  }
}
</script>

<template>
  <div v-if="draft">
    <ConfigPublishBar
      :editor="editor"
      :can-publish="canPublish"
      :approval-required="true"
      :read-only-text="t('rates.viewOnly')"
      :confirm-note="t('config.confirmRates')"
      :formats="formats"
      :labels="labels"
    />

    <RatesSeasonsPanel
      :can-publish="canPublish"
      :errors-for="editor.errorsFor"
      :warnings-for="editor.warningsFor"
    />

    <RatesRoomMatrix
      :can-publish="canPublish"
      :room-types="roomTypes"
      :errors-for="editor.errorsFor"
      :warnings-for="editor.warningsFor"
    />

    <RatesOccupancyPanel
      :can-publish="canPublish"
      :errors-for="editor.errorsFor"
    />

    <RatesStayRulesPanel
      :can-publish="canPublish"
      :errors-for="editor.errorsFor"
      :warnings-for="editor.warningsFor"
    />

    <RatesPriceCheck
      :rows="priceCheckRows"
      :stays="priceCheckStays"
      :stale="priceCheckStale"
      :room-types="roomTypes"
      :plans="planOptions"
      @update:stays="priceCheckStays = $event"
    />

    <ConfigHistoryPanel
      :title="t('rates.historyTitle')"
      :empty-text="t('rates.historyEmpty')"
      :versions="editor.versions"
      :has-more="editor.hasMore"
      :loading="editor.historyLoading"
      :formats="formats"
      @load-older="editor.loadOlder()"
    />

    <template v-if="extrasDraft">
      <ConfigPublishBar
        :editor="extrasEditor"
        :can-publish="canPublishExtras"
        :approval-required="true"
        :read-only-text="t('rates.extrasViewOnly')"
        :confirm-note="t('rates.confirmExtras')"
        :formats="extrasValueFormats"
        :labels="extrasLabels"
      />

      <ExtrasCataloguePanel
        :can-publish="canPublishExtras"
        :published-codes="extrasPublishedCodes"
        :errors-for="extrasEditor.errorsFor"
      />

      <ConfigHistoryPanel
        :title="t('rates.extrasHistoryTitle')"
        :empty-text="t('rates.extrasHistoryEmpty')"
        :versions="extrasEditor.versions"
        :has-more="extrasEditor.hasMore"
        :loading="extrasEditor.historyLoading"
        :formats="extrasValueFormats"
        @load-older="extrasEditor.loadOlder()"
      />
    </template>

    <RatesPromotionsPanel />
  </div>
</template>
