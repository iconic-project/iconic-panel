<script setup lang="ts">
import type { AutomationRow, Journey, JourneyUpdate, MessageTemplate } from '../../../types/api'
import JourneyEnrolmentsDrawer from '../../../components/crm/JourneyEnrolmentsDrawer.vue'
import JourneyTemplatePanel from '../../../components/crm/JourneyTemplatePanel.vue'
import {
  confirmSentence,
  disabledCatalogueSwitches,
  kindPillClass,
  severalBranches,
  stepsByBranch,
  templateByKey
} from '../../../components/crm/journeyHelpers'
import { firstApiMessage } from '../../../utils/apiForm'

const { t } = useI18n()
const { can } = useAuth()
const { request } = useApi()
const route = useRoute()
const router = useRouter()
const toast = useToast()

const canManage = computed(() => can('rules.manage'))
const journeys = ref<Array<Journey>>([])
const automations = ref<Array<AutomationRow>>([])
const templates = ref<Array<MessageTemplate>>([])
const loadError = ref('')
const enrolKey = ref<string | null>(null)
const enrolName = ref('')
const enrolOpen = ref(false)
const templateKey = ref<string | null>(null)
const templateOpen = ref(false)
const confirmOpen = ref(false)
const pending = ref<{ key: string, active: boolean, sentence: string } | null>(null)
const saving = ref(false)

const selectedTemplate = computed(() => {
  if (templateKey.value === null) {
    return null
  }

  return templateByKey(templateKey.value, templates.value)
})

onMounted(() => {
  void load()
})

async function load(): Promise<void> {
  try {
    const [journeyPage, automationPage, templatePage] = await Promise.all([
      request('/api/crm/journeys') as Promise<{ data: Array<Journey> }>,
      request('/api/crm/automations') as Promise<{ data: Array<AutomationRow> }>,
      request('/api/crm/templates') as Promise<{ data: Array<MessageTemplate> }>
    ])
    journeys.value = journeyPage.data
    automations.value = automationPage.data
    templates.value = templatePage.data
    loadError.value = ''
    openTemplateFromQuery()
  } catch (error: unknown) {
    loadError.value = firstApiMessage(error) ?? t('crmJourneys.failed')
  }
}

function queryTemplate(): string | null {
  const raw = route.query.template
  const key = Array.isArray(raw) ? raw[0] : raw

  return typeof key === 'string' ? key : null
}

function openTemplateFromQuery(): void {
  const key = queryTemplate()

  if (key === null || templateByKey(key, templates.value) === null) {
    return
  }

  templateKey.value = key
  templateOpen.value = true
}

watch(() => route.query.template, () => {
  openTemplateFromQuery()
})

watch(templateOpen, (isOpen) => {
  if (isOpen || route.query.template === undefined) {
    return
  }

  const query = { ...route.query }
  delete query.template
  void router.replace({ query })
})

function askToggle(journey: Journey, event: Event): void {
  const input = event.target

  if (!(input instanceof HTMLInputElement)) {
    return
  }

  input.checked = journey.active
  pending.value = {
    key: journey.key,
    active: !journey.active,
    sentence: confirmSentence(journey)
  }
  confirmOpen.value = true
}

function cancelToggle(): void {
  confirmOpen.value = false
  pending.value = null
}

async function applyToggle(): Promise<void> {
  if (pending.value === null) {
    return
  }

  saving.value = true
  const body: JourneyUpdate = { active: pending.value.active }

  try {
    const saved = await request(`/api/crm/journeys/${encodeURIComponent(pending.value.key)}`, {
      method: 'PATCH',
      body
    }) as Journey
    journeys.value = journeys.value.map(item => item.key === saved.key ? saved : item)
    toast.add({ title: t('crmJourneys.updated') })
    confirmOpen.value = false
    pending.value = null
  } catch (error: unknown) {
    loadError.value = firstApiMessage(error) ?? t('crmJourneys.failed')
  } finally {
    saving.value = false
  }
}

function openEnrolments(journey: Journey): void {
  enrolKey.value = journey.key
  enrolName.value = journey.name
  enrolOpen.value = true
}

function openTemplate(key: string): void {
  templateKey.value = key
  templateOpen.value = true
  void router.replace({ query: { ...route.query, template: key } })
}
</script>

<template>
  <div>
    <p
      v-if="loadError"
      class="warnbox"
    >
      {{ loadError }}
    </p>

    <article
      v-for="journey in journeys"
      :id="journey.key"
      :key="journey.key"
      class="journey"
      :data-kind="journey.kind"
    >
      <div class="jh">
        <div>
          <div class="jh-title">
            <h3>{{ journey.name }}</h3>
            <span
              class="pill"
              :class="kindPillClass(journey.kind)"
            >{{ journey.kind }}</span>
          </div>
          <div class="goal">
            {{ journey.goal }}
          </div>
          <div
            v-if="journey.contract"
            class="contract"
          >
            {{ journey.contract }}
          </div>
        </div>
        <div class="jh-side">
          <div class="trigger">
            {{ t('crmJourneys.trigger', { line: journey.trigger }) }}
          </div>
          <label
            v-if="canManage"
            class="crm-check"
          >
            <input
              type="checkbox"
              :checked="journey.active"
              :aria-label="t('crmJourneys.active')"
              @change="askToggle(journey, $event)"
            >
            {{ journey.active ? t('crmJourneys.active') : t('crmJourneys.inactive') }}
          </label>
          <span
            v-else
            class="mono"
          >{{ journey.active ? t('crmJourneys.active') : t('crmJourneys.inactive') }}</span>
          <UButton
            variant="outline"
            @click="openEnrolments(journey)"
          >
            {{ t('crmJourneys.enrolments') }}
          </UButton>
        </div>
      </div>

      <template
        v-for="group in stepsByBranch(journey.steps)"
        :key="`${journey.key}-${group.branch}`"
      >
        <p
          v-if="severalBranches(journey.steps)"
          class="jbranch"
        >
          {{ group.branch }}
        </p>
        <div class="jsteps">
          <div
            v-for="step in group.steps"
            :key="`${group.branch}-${String(step.position)}`"
            class="jstep"
          >
            <div class="sn">
              {{ step.timing }}
            </div>
            <button
              v-if="templateByKey(step.template_key, templates)"
              type="button"
              class="lnk sl"
              @click="openTemplate(step.template_key)"
            >
              {{ step.name }}
            </button>
            <div
              v-else
              class="sl"
            >
              {{ step.name }}
            </div>
            <div class="sa">
              {{ step.action }}
            </div>
            <div class="sc">
              {{ t('crmJourneys.enrolled', { count: step.count }) }}
            </div>
            <p
              v-for="row in disabledCatalogueSwitches(step.catalogue_keys, automations)"
              :key="row.key"
              class="joff"
            >
              <span class="mono">{{ t('crmJourneys.catalogueOff') }}</span>
              <NuxtLink to="/crm/engine/automations">
                {{ row.name }}
              </NuxtLink>
              <span v-if="row.disabled_reason">{{ row.disabled_reason }}</span>
            </p>
          </div>
        </div>
      </template>

      <div class="jfoot">
        <span><b>{{ journey.exit_sentence }}</b></span>
        <span>{{ journey.suppression_sentence }}</span>
      </div>
    </article>

    <UModal
      :open="confirmOpen"
      :title="pending?.active ? t('crmJourneys.confirmOn') : t('crmJourneys.confirmOff')"
      @update:open="confirmOpen = $event"
    >
      <template #body>
        <div class="modal-form">
          <p>{{ pending?.sentence }}</p>
          <div class="modal-actions">
            <UButton
              variant="outline"
              :disabled="saving"
              @click="cancelToggle"
            >
              {{ t('bookings.cancel') }}
            </UButton>
            <UButton
              :loading="saving"
              :disabled="saving || pending === null"
              @click="applyToggle"
            >
              {{ pending?.active ? t('crmJourneys.turnOn') : t('crmJourneys.turnOff') }}
            </UButton>
          </div>
        </div>
      </template>
    </UModal>

    <JourneyEnrolmentsDrawer
      v-model:open="enrolOpen"
      :journey-key="enrolKey"
      :journey-name="enrolName"
    />
    <JourneyTemplatePanel
      v-model:open="templateOpen"
      :template="selectedTemplate"
      @saved="load"
    />
  </div>
</template>
