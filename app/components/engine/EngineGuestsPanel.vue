<script setup lang="ts">
import { UNDER_AGE_LIMIT, useEngineSettingsDraft, type EnginePanelAccess } from './engineSettingsHelpers'

const props = defineProps<EnginePanelAccess>()

const draft = useEngineSettingsDraft()
const { t } = useI18n()
</script>

<template>
  <AnkPanel :title="t('engineSettings.guestsTitle')">
    <template #actions>
      <AnkPill>{{ t('engineSettings.admin') }}</AnkPill>
    </template>

    <div class="setgrid">
      <div>
        <EngineField
          v-slot="{ id }"
          :label="t('engineSettings.maxPerProperty')"
        >
          <ConfigNumberInput
            :id="id"
            v-model="draft.guests.max_per_property"
            variant="field"
            :disabled="!props.canEdit('guests.max_per_property')"
            :bad="props.errorsFor('guests.max_per_property').length > 0"
            min="1"
            max="36"
            step="1"
          />
        </EngineField>
        <div class="cols2">
          <EngineField
            v-slot="{ id }"
            :label="t('engineSettings.childFrom')"
          >
            <ConfigNumberInput
              :id="id"
              v-model="draft.guests.child_min_age"
              variant="field"
              :disabled="!props.canEdit('guests.child_min_age')"
              :bad="props.errorsFor('guests.child_min_age').length > 0"
              min="0"
              max="17"
              step="1"
            />
          </EngineField>
          <EngineField
            v-slot="{ id }"
            :label="t('engineSettings.childTo')"
          >
            <ConfigNumberInput
              :id="id"
              v-model="draft.guests.child_max_age"
              variant="field"
              :disabled="!props.canEdit('guests.child_max_age')"
              :bad="props.errorsFor('guests.child_max_age').length > 0"
              min="0"
              max="17"
              step="1"
            />
          </EngineField>
        </div>
        <EngineField
          v-slot="{ id }"
          :label="t('engineSettings.underAge')"
          :count="draft.guests.under_age_message.length"
          :max="UNDER_AGE_LIMIT"
        >
          <input
            :id="id"
            v-model="draft.guests.under_age_message"
            type="text"
            :maxlength="UNDER_AGE_LIMIT"
            :disabled="!props.canEdit('guests.under_age_message')"
            :class="{ bad: props.errorsFor('guests.under_age_message').length > 0 }"
          >
        </EngineField>
        <label class="chkline">
          <input
            v-model="draft.guests.adult_required_with_children"
            type="checkbox"
            :disabled="!props.canEdit('guests.adult_required_with_children')"
          >
          {{ t('engineSettings.adultRequired') }}
        </label>
        <p class="engine-note">
          {{ t('engineSettings.guestsNote') }}
        </p>
      </div>
      <EnginePreviewBox :label="t('engineSettings.prevGuests')" />
    </div>
  </AnkPanel>
</template>
