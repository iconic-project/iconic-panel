<script setup lang="ts">
import type { PropertyContent } from '../../types/api'
import { firstApiMessage } from '../../utils/apiForm'
import CompletenessMeter from './CompletenessMeter.vue'
import {
  propertyContentPayload,
  propertyDraft,
  type PropertyDraft
} from './contentPayload'

const props = defineProps<{
  property: PropertyContent
  canManage: boolean
  roleName: string
}>()

const emit = defineEmits<{
  saved: [property: PropertyContent]
}>()

const { t } = useI18n()
const { request } = useApi()
const toast = useToast()

const draft = ref<PropertyDraft>(propertyDraft(props.property))
const saving = ref(false)
const uploading = ref(false)
const error = ref('')
const historyOpen = ref(false)
const heroInput = ref<HTMLInputElement | null>(null)

const historyUrl = computed(() => `/api/rms/properties/${props.property.id}/history`)

watch(() => props.property, (property) => {
  draft.value = propertyDraft(property)
})

async function save(): Promise<void> {
  saving.value = true
  error.value = ''

  try {
    const updated = await request(`/api/rms/properties/${props.property.id}`, {
      method: 'PATCH',
      body: propertyContentPayload(draft.value)
    }) as PropertyContent

    draft.value = propertyDraft(updated)
    toast.add({ title: t('propertyContent.saved') })
    emit('saved', updated)
  } catch (caught: unknown) {
    error.value = firstApiMessage(caught) ?? (caught instanceof Error ? caught.message : '')
  } finally {
    saving.value = false
  }
}

async function onHero(event: Event): Promise<void> {
  const target = event.target

  if (!(target instanceof HTMLInputElement)) {
    return
  }

  const file = target.files?.[0]

  if (!file) {
    return
  }

  if (file.size > 4e6) {
    error.value = t('propertyContent.photoTooLarge')
    target.value = ''
    return
  }

  const alt = draft.value.hero_alt.trim()

  if (alt === '') {
    error.value = t('propertyContent.altRequired')
    target.value = ''
    return
  }

  const body = new FormData()
  body.append('image', file)
  body.append('alt', alt)
  uploading.value = true
  error.value = ''

  try {
    const updated = await request(`/api/rms/properties/${props.property.id}/hero`, {
      method: 'POST',
      body
    }) as PropertyContent

    draft.value = propertyDraft(updated)
    emit('saved', updated)
  } catch (caught: unknown) {
    error.value = firstApiMessage(caught) ?? (caught instanceof Error ? caught.message : '')
  } finally {
    uploading.value = false
    target.value = ''
  }
}
</script>

<template>
  <div>
    <div class="ebtool">
      <div>
        <h2>{{ property.name }}</h2>
        <p class="mono">
          {{ property.code }}
        </p>
      </div>
      <UButton
        variant="outline"
        @click="historyOpen = true"
      >
        {{ t('propertyContent.history') }}
      </UButton>
    </div>

    <CompletenessMeter :completeness="property.completeness" />

    <p
      v-if="!canManage"
      class="notice"
    >
      {{ t('propertyContent.viewOnly', { role: roleName }) }}
    </p>
    <p
      v-if="error"
      class="notice"
    >
      {{ error }}
    </p>

    <form @submit.prevent="save">
      <fieldset
        class="sec"
        :disabled="!canManage || saving"
      >
        <h4>{{ t('propertyContent.basics') }}</h4>
        <div class="field">
          <label for="property-name">{{ t('propertyContent.name') }}</label>
          <input
            id="property-name"
            v-model="draft.name"
            type="text"
            required
          >
        </div>
        <div class="field">
          <label for="property-slug">{{ t('propertyContent.slug') }}</label>
          <input
            id="property-slug"
            v-model="draft.slug"
            type="text"
          >
        </div>
        <div class="field">
          <label for="property-address">{{ t('propertyContent.address') }}</label>
          <input
            id="property-address"
            v-model="draft.address_line_1"
            type="text"
          >
        </div>
        <div class="field">
          <label for="property-address-2">{{ t('propertyContent.address2') }}</label>
          <input
            id="property-address-2"
            v-model="draft.address_line_2"
            type="text"
          >
        </div>
        <div class="field">
          <label for="property-city">{{ t('propertyContent.city') }}</label>
          <input
            id="property-city"
            v-model="draft.city"
            type="text"
          >
        </div>
        <div class="field">
          <label for="property-postcode">{{ t('propertyContent.postcode') }}</label>
          <input
            id="property-postcode"
            v-model="draft.postcode"
            type="text"
          >
        </div>
        <div class="field">
          <label for="property-country">{{ t('propertyContent.country') }}</label>
          <input
            id="property-country"
            v-model="draft.country"
            type="text"
            maxlength="2"
          >
        </div>
        <div class="field">
          <label for="property-phone">{{ t('propertyContent.phone') }}</label>
          <input
            id="property-phone"
            v-model="draft.phone"
            type="text"
          >
        </div>
        <div class="field">
          <label for="property-email">{{ t('propertyContent.email') }}</label>
          <input
            id="property-email"
            v-model="draft.email"
            type="email"
          >
        </div>
        <div class="field">
          <label for="property-description">{{ t('propertyContent.description') }}</label>
          <textarea
            id="property-description"
            v-model="draft.description"
            rows="4"
          />
        </div>

        <h4>{{ t('propertyContent.hero') }}</h4>
        <div
          v-if="property.hero_image_url"
          class="itc"
        >
          <div
            class="im"
            :style="{ background: `url(${property.hero_image_url}) center / cover` }"
          />
        </div>
        <div class="field">
          <label for="property-alt">{{ t('propertyContent.alt') }}</label>
          <input
            id="property-alt"
            v-model="draft.hero_alt"
            type="text"
          >
        </div>
        <div class="field">
          <label for="property-hero">{{ t('propertyContent.hero') }}</label>
          <input
            id="property-hero"
            ref="heroInput"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            :disabled="!canManage || uploading"
            @change="onHero"
          >
          <p class="mono">
            {{ t('propertyContent.photoHint') }}
          </p>
        </div>

        <h4>{{ t('propertyContent.highlights') }}</h4>
        <div class="field">
          <label for="property-highlights">{{ t('propertyContent.highlights') }}</label>
          <textarea
            id="property-highlights"
            v-model="draft.highlights"
            rows="4"
          />
          <p class="mono">
            {{ t('propertyContent.highlightsHint') }}
          </p>
        </div>
        <div class="field">
          <label for="property-facts">{{ t('propertyContent.facts') }}</label>
          <textarea
            id="property-facts"
            v-model="draft.facts"
            rows="4"
          />
          <p class="mono">
            {{ t('propertyContent.pairsHint') }}
          </p>
        </div>
        <div class="field">
          <label for="property-faqs">{{ t('propertyContent.faqs') }}</label>
          <textarea
            id="property-faqs"
            v-model="draft.faqs"
            rows="4"
          />
          <p class="mono">
            {{ t('propertyContent.pairsHint') }}
          </p>
        </div>
        <div class="field">
          <label for="property-policies">{{ t('propertyContent.policies') }}</label>
          <textarea
            id="property-policies"
            v-model="draft.policies_text"
            rows="4"
          />
        </div>
        <div class="field">
          <label for="property-seo-title">{{ t('propertyContent.seoTitle') }}</label>
          <input
            id="property-seo-title"
            v-model="draft.meta_title"
            type="text"
            maxlength="60"
          >
        </div>
        <div class="field">
          <label for="property-seo-description">{{ t('propertyContent.seoDescription') }}</label>
          <textarea
            id="property-seo-description"
            v-model="draft.meta_description"
            rows="3"
            maxlength="155"
          />
        </div>
      </fieldset>
      <div
        v-if="canManage"
        class="acts"
      >
        <UButton
          type="submit"
          :loading="saving"
        >
          {{ t('propertyContent.save') }}
        </UButton>
      </div>
    </form>

    <HistoryDrawer
      v-model:open="historyOpen"
      :title="property.name"
      :subject-type="t('propertyContent.subject')"
      :url="historyUrl"
    />
  </div>
</template>
