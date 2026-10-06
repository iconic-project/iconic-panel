<script setup lang="ts">
import { COPY_CHAR_LIMIT, useEngineSettingsDraft, type EnginePanelAccess } from './engineSettingsHelpers'

const props = defineProps<EnginePanelAccess>()

const draft = useEngineSettingsDraft()
const { t } = useI18n()
</script>

<template>
  <AnkPanel :title="t('engineSettings.feesTitle')">
    <template #actions>
      <AnkPill>{{ t('engineSettings.admin') }}</AnkPill>
    </template>

    <div class="setgrid">
      <div>
        <label class="chkline">
          <input
            v-model="draft.fees.show_in_price_panel"
            type="checkbox"
            :disabled="!props.canEdit('fees.show_in_price_panel')"
          >
          {{ t('engineSettings.showFees') }}
        </label>
        <EngineField
          v-slot="{ id }"
          :label="t('engineSettings.feeNote')"
          :count="draft.fees.footnote.length"
          :max="COPY_CHAR_LIMIT"
        >
          <textarea
            :id="id"
            v-model="draft.fees.footnote"
            rows="2"
            :maxlength="COPY_CHAR_LIMIT"
            :disabled="!props.canEdit('fees.footnote')"
            :class="{ bad: props.errorsFor('fees.footnote').length > 0 }"
          />
        </EngineField>
        <p class="engine-note">
          {{ t('engineSettings.feesFootnote') }}
        </p>
      </div>
      <EnginePreviewBox :label="t('engineSettings.prevFees')" />
    </div>
  </AnkPanel>
</template>
