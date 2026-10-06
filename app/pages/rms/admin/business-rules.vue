<script setup lang="ts">
import {
  RULES_DRAFT_KEY,
  ruleChipState,
  ruleFieldLabels,
  type BusinessRulesDraft,
  type RuleChip
} from '../../../components/rules/rulesHelpers'
import type { RuleRegistryCounts } from '../../../types/api'
import type { ConfigValueFormat } from '../../../utils/formatConfigValue'

const { can, user } = useAuth()
const { t } = useI18n()

const editor = useConfigEditor('business-rules')
const draft = computed(() => editor.draft as BusinessRulesDraft | null)

provide(RULES_DRAFT_KEY, draft)

useUnsavedGuard(() => editor.dirty, () => t('config.leaveUnsaved'))

const canPublish = computed(() => can('rules.manage'))

const readOnlyText = computed(() => {
  return t('businessRules.viewOnly', {
    role: (user.value?.role.name ?? '').toUpperCase()
  })
})

const labels = ruleFieldLabels()

const formats: Record<string, ConfigValueFormat> = {
  modification_fee_usd: 'money'
}

const chip = ref<RuleChip>('ALL')

const live = computed(() => {
  if (draft.value === null || editor.current === null) {
    return null
  }

  return ruleChipState(editor.current.registry, draft.value, chip.value)
})

const chips: Array<{ id: RuleChip, labelKey: string, countKey: keyof RuleRegistryCounts }> = [
  { id: 'ALL', labelKey: 'businessRules.chipAll', countKey: 'all' },
  { id: 'HERE', labelKey: 'businessRules.chipHere', countKey: 'here' },
  { id: 'TABS', labelKey: 'businessRules.chipTabs', countKey: 'other_pages' },
  { id: 'LOCK', labelKey: 'businessRules.chipLock', countKey: 'locked' },
  { id: 'DIFF', labelKey: 'businessRules.chipDiff', countKey: 'differs_or_flagged' }
]
</script>

<template>
  <div v-if="draft && live">
    <div class="krow">
      <AnkKpi
        :label="t('businessRules.kpiTracked')"
        :sub="t('businessRules.kpiTrackedSub')"
      >
        {{ live.counts.all }}
      </AnkKpi>
      <AnkKpi
        :label="t('businessRules.kpiHere')"
        :sub="t('businessRules.kpiHereSub')"
      >
        {{ live.counts.here }}
      </AnkKpi>
      <AnkKpi
        :label="t('businessRules.kpiTabs')"
        :sub="t('businessRules.kpiTabsSub')"
      >
        {{ live.counts.other_pages }}
      </AnkKpi>
      <AnkKpi
        :label="t('businessRules.kpiDiff')"
        :sub="t('businessRules.kpiDiffSub')"
      >
        <span :class="live.counts.differs_or_flagged > 0 ? 'rules-kpi-flag' : 'rules-kpi-ok'">
          {{ live.counts.differs_or_flagged }}
        </span>
      </AnkKpi>
    </div>

    <ConfigPublishBar
      :editor="editor"
      :can-publish="canPublish"
      :approval-required="true"
      :read-only-text="readOnlyText"
      :confirm-note="t('config.confirmNeutral')"
      :formats="formats"
      :labels="labels"
    />

    <div class="rules-chips">
      <button
        v-for="item in chips"
        :key="item.id"
        type="button"
        class="fchip"
        :class="{ on: chip === item.id }"
        @click="chip = item.id"
      >
        {{ t(item.labelKey) }} ({{ live.counts[item.countKey] }})
      </button>
    </div>

    <RulesGroupPanel
      v-for="group in live.groups"
      :key="group.label"
      :title="group.label"
      :rows="group.rows"
      :can-edit="canPublish"
      :errors-for="editor.errorsFor"
    />

    <ConfigHistoryPanel
      :title="t('businessRules.historyTitle')"
      :empty-text="t('businessRules.historyEmpty')"
      :versions="editor.versions"
      :has-more="editor.hasMore"
      :loading="editor.historyLoading"
      :formats="formats"
      @load-older="editor.loadOlder()"
    />
  </div>
</template>
