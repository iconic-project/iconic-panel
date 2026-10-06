<script setup lang="ts">
import {
  ENGINE_SETTINGS_DRAFT_KEY,
  engineFieldLabels,
  type EngineSettingsDraft
} from '../../../components/engine/engineSettingsHelpers'
import type { ConfigValueFormat } from '../../../utils/formatConfigValue'
import { canEditPath } from '../../../utils/canEditPath'

const { can, user } = useAuth()
const { t } = useI18n()

const editor = useConfigEditor('engine-settings')
const draft = computed(() => editor.draft as EngineSettingsDraft | null)

provide(ENGINE_SETTINGS_DRAFT_KEY, draft)

useUnsavedGuard(() => editor.dirty, () => t('config.leaveUnsaved'))

const copyPaths = computed(() => editor.current?.copy_paths ?? [])

function canEdit(path: string): boolean {
  return canEditPath(path, copyPaths.value, can)
}

const canPublish = computed(() => {
  return can('engine_settings.manage') || can('engine_copy.manage')
})

const approvalRequired = computed(() => editor.validation.rule_fields_changed)

const blockedReason = computed(() => {
  if (
    can('engine_copy.manage')
    && !can('engine_settings.manage')
    && editor.validation.rule_fields_changed
  ) {
    return t('engineSettings.blockedReason')
  }

  return null
})

const readOnlyText = computed(() => {
  return t('engineSettings.viewOnly', {
    role: (user.value?.role.name ?? '').toUpperCase()
  })
})

const labels = engineFieldLabels()

const formats: Record<string, ConfigValueFormat> = {
  'fees.tct_pp': 'money',
  'fees.png': 'money'
}
</script>

<template>
  <div v-if="draft">
    <p class="notice engine-notice">
      {{ t('engineSettings.noticeBefore') }}<b>{{ t('engineSettings.noticeRules') }}</b>{{ t('engineSettings.noticeRulesAfter') }}<b>{{ t('engineSettings.noticeCopy') }}</b>{{ t('engineSettings.noticeCopyAfter') }}<NuxtLink
        class="lnk"
        to="/rms/commercial/rates"
      >
        {{ t('engineSettings.noticeRates') }}
      </NuxtLink>{{ t('engineSettings.noticeAfter') }}
    </p>

    <ConfigPublishBar
      :editor="editor"
      :can-publish="canPublish"
      :approval-required="approvalRequired"
      :read-only-text="readOnlyText"
      :confirm-note="t('config.confirmNeutral')"
      :formats="formats"
      :labels="labels"
      :blocked-reason="blockedReason"
    />

    <EngineGuestsPanel
      :can-edit="canEdit"
      :errors-for="editor.errorsFor"
    />

    <EngineCalendarPanel
      :can-edit="canEdit"
      :errors-for="editor.errorsFor"
    />

    <EngineLocalePanel />

    <EngineCopyPanel
      :can-edit="canEdit"
      :errors-for="editor.errorsFor"
    />

    <EngineConfirmationPanel
      :can-edit="canEdit"
      :errors-for="editor.errorsFor"
    />

    <EngineFeesPanel
      :can-edit="canEdit"
      :errors-for="editor.errorsFor"
    />

    <ConfigHistoryPanel
      :title="t('engineSettings.historyTitle')"
      :empty-text="t('engineSettings.historyEmpty')"
      :versions="editor.versions"
      :has-more="editor.hasMore"
      :loading="editor.historyLoading"
      :formats="formats"
      @load-older="editor.loadOlder()"
    />
  </div>
</template>
