<script setup lang="ts">
import type {
  AgencyListItem,
  BusinessRulesVersion,
  ChannelOfOriginGroup,
  ReportDefinition,
  ReportRun,
  ReportSubscription,
  RunReportInput,
  UpdateSubscriptionInput
} from '../../../types/api'
import { downloadDocumentFile } from '../../../components/documents/documentFetch'
import { calendarYear, resolveDateRange } from '../../../components/lists/dateRange'
import { SELECT_ALL, selectedId, withSelectAll } from '../../../components/commercial/dashboardHelpers'
import { isScheduledRun, retentionDays } from '../../../components/commercial/reportHelpers'
import { firstApiMessage } from '../../../utils/apiForm'

const CHANNELS: Array<ChannelOfOriginGroup> = [
  'Direct',
  'Marketing',
  'Trade, corporate & groups',
  'Distribution, partners & other'
]

const POLL_MS = 1000

const { can } = useAuth()
const { t } = useI18n()
const { useFetch, request } = useApi()
const { format } = useDates()

const today = computed(() => format(new Date(), 'iso'))
const yearWindow = resolveDateRange(`y${calendarYear(today.value)}`, today.value)

const definitions = ref<Array<ReportDefinition>>([])
const runs = ref<Array<ReportRun>>([])
const subscriptions = ref<Array<ReportSubscription>>([])
const loadError = ref('')
const actionError = ref('')
const openKey = ref<string | null>(null)
const runFrom = ref<string | null>(yearWindow.from)
const runTo = ref<string | null>(yearWindow.to)
const channel = ref(SELECT_ALL)
const agencyId = ref(SELECT_ALL)
const posting = ref(false)

const { data: agenciesPayload } = useFetch<{ data: Array<AgencyListItem> }>('/api/rms/agencies')
const { data: rulesPayload } = useFetch<BusinessRulesVersion>('/api/rms/business-rules', {
  immediate: can('rules.view')
})

const agencies = computed(() => agenciesPayload.value?.data ?? [])
const fileDays = computed(() => retentionDays(rulesPayload.value?.document))

const channelItems = computed(() => withSelectAll(
  t('dashboard.allChannels'),
  CHANNELS.map(group => ({
    label: group,
    value: group
  }))
))

const agencyItems = computed(() => withSelectAll(
  t('dashboard.allAgencies'),
  agencies.value.map(agency => ({
    label: agency.name,
    value: String(agency.id)
  }))
))

let pollTimer: ReturnType<typeof setTimeout> | undefined

onMounted(() => {
  void loadAll()
})

onUnmounted(() => {
  clearTimeout(pollTimer)
})

function titleFor(key: string): string {
  return definitions.value.find(definition => definition.key === key)?.title ?? key
}

function scheduleLine(subscription: ReportSubscription): string {
  if (subscription.cadence === 'WEEKLY' && subscription.weekday !== null) {
    return t('reports.scheduleWeekly', {
      cadence: subscription.cadence,
      time: subscription.send_at,
      weekday: subscription.weekday
    })
  }

  if (subscription.day_of_month !== null && (subscription.cadence === 'MONTHLY' || subscription.cadence === 'QUARTERLY')) {
    return t('reports.scheduleMonthly', {
      cadence: subscription.cadence,
      time: subscription.send_at,
      day: subscription.day_of_month
    })
  }

  return t('reports.scheduleDaily', {
    cadence: subscription.cadence,
    time: subscription.send_at
  })
}

function pillClass(status: ReportRun['status']): string {
  if (status === 'FAILED') {
    return 'pill p-over'
  }

  if (status === 'QUEUED') {
    return 'pill p-pend'
  }

  return 'pill'
}

function purgedLine(): string {
  if (fileDays.value === null) {
    return t('reports.purgedUnknown')
  }

  return t('reports.purged', { n: fileDays.value })
}

async function loadAll(): Promise<void> {
  try {
    const [definitionPayload, runPayload, subscriptionPayload] = await Promise.all([
      request('/api/rms/reports') as Promise<{ data: Array<ReportDefinition> }>,
      request('/api/rms/reports/runs') as Promise<{ data: Array<ReportRun> }>,
      request('/api/rms/reports/subscriptions') as Promise<{ data: Array<ReportSubscription> }>
    ])

    definitions.value = definitionPayload.data
    runs.value = runPayload.data
    subscriptions.value = subscriptionPayload.data
    loadError.value = ''
    schedulePoll()
  } catch (error: unknown) {
    loadError.value = firstApiMessage(error) ?? t('reports.loadError')
  }
}

function schedulePoll(): void {
  clearTimeout(pollTimer)

  if (!runs.value.some(run => run.status === 'QUEUED')) {
    return
  }

  pollTimer = setTimeout(() => {
    void refreshRuns()
  }, POLL_MS)
}

async function refreshRuns(): Promise<void> {
  try {
    const payload = await request('/api/rms/reports/runs') as { data: Array<ReportRun> }
    runs.value = payload.data
    schedulePoll()
  } catch (error: unknown) {
    actionError.value = firstApiMessage(error) ?? t('reports.loadError')
  }
}

function openRun(definition: ReportDefinition): void {
  openKey.value = openKey.value === definition.key ? null : definition.key
  actionError.value = ''
}

async function submitRun(definition: ReportDefinition): Promise<void> {
  if (runFrom.value === null || runTo.value === null) {
    actionError.value = t('reports.windowRequired')

    return
  }

  const body: RunReportInput = {
    from: runFrom.value,
    to: runTo.value
  }

  const agency = selectedId(agencyId.value)

  if (channel.value !== SELECT_ALL) {
    const group = CHANNELS.find(item => item === channel.value)

    if (group !== undefined) {
      body.channel = group
    }
  }

  if (agency !== null) {
    body.agency = agency
  }

  posting.value = true
  actionError.value = ''

  try {
    await request(`/api/rms/reports/${definition.key}/runs`, {
      method: 'POST',
      body
    })
    openKey.value = null
    await refreshRuns()
  } catch (error: unknown) {
    actionError.value = firstApiMessage(error) ?? t('reports.loadError')
  } finally {
    posting.value = false
  }
}

async function download(run: ReportRun, fileFormat: ReportRun['formats'][number]): Promise<void> {
  actionError.value = ''

  try {
    await downloadDocumentFile(
      `/api/rms/reports/runs/${String(run.id)}/file/${fileFormat}`,
      `${run.definition_key}.${fileFormat}`
    )
  } catch (error: unknown) {
    actionError.value = error instanceof Error ? error.message : t('reports.loadError')
  }
}

async function patchSubscription(subscription: ReportSubscription, changes: UpdateSubscriptionInput): Promise<void> {
  actionError.value = ''

  try {
    const updated = await request(`/api/rms/reports/subscriptions/${String(subscription.id)}`, {
      method: 'PATCH',
      body: changes
    }) as { data: ReportSubscription }

    subscriptions.value = subscriptions.value.map(row => row.id === subscription.id ? updated.data : row)
  } catch (error: unknown) {
    actionError.value = firstApiMessage(error) ?? t('reports.loadError')
  }
}

function onActive(subscription: ReportSubscription, event: Event): void {
  const active = (event.target as HTMLInputElement).checked
  void patchSubscription(subscription, { active })
}

function onSendAt(subscription: ReportSubscription, event: Event): void {
  const sendAt = (event.target as HTMLInputElement).value

  if (sendAt === '') {
    return
  }

  void patchSubscription(subscription, { send_at: sendAt })
}

async function runNow(subscription: ReportSubscription): Promise<void> {
  posting.value = true
  actionError.value = ''

  try {
    await request(`/api/rms/reports/subscriptions/${String(subscription.id)}/run-now`, {
      method: 'POST'
    })
    await refreshRuns()
  } catch (error: unknown) {
    actionError.value = firstApiMessage(error) ?? t('reports.loadError')
  } finally {
    posting.value = false
  }
}
</script>

<template>
  <div>
    <p
      v-if="loadError !== ''"
      class="notice"
    >
      {{ loadError }}
    </p>
    <p
      v-if="actionError !== ''"
      class="notice"
    >
      {{ actionError }}
    </p>

    <div class="panel">
      <h3>{{ t('reports.definitionsTitle') }}</h3>
      <div class="bk-table-wrap">
        <table class="list">
          <thead>
            <tr>
              <th>{{ t('reports.colDefinition') }}</th>
              <th>{{ t('reports.formats') }}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            <template
              v-for="definition in definitions"
              :key="definition.key"
            >
              <tr>
                <td>
                  <div>{{ definition.title }}</div>
                  <p class="mono">
                    {{ definition.sentence }}
                  </p>
                </td>
                <td class="mono">
                  {{ definition.formats.join(' ') }}
                </td>
                <td>
                  <UButton
                    v-if="definition.allowed"
                    type="button"
                    @click="openRun(definition)"
                  >
                    {{ t('reports.run') }}
                  </UButton>
                </td>
              </tr>
              <tr v-if="openKey === definition.key && definition.allowed">
                <td colspan="3">
                  <div class="drbar">
                    <label>
                      {{ t('reports.from') }}
                      <AnkDateInput
                        v-model="runFrom"
                        size="sm"
                      />
                    </label>
                    <label>
                      {{ t('reports.to') }}
                      <AnkDateInput
                        v-model="runTo"
                        size="sm"
                      />
                    </label>
                    <USelect
                      v-model="channel"
                      size="sm"
                      :items="channelItems"
                      :aria-label="t('dashboard.allChannels')"
                    />
                    <USelect
                      v-model="agencyId"
                      size="sm"
                      :items="agencyItems"
                      :aria-label="t('dashboard.allAgencies')"
                    />
                    <UButton
                      type="button"
                      :disabled="posting"
                      @click="submitRun(definition)"
                    >
                      {{ t('reports.run') }}
                    </UButton>
                  </div>
                </td>
              </tr>
            </template>
          </tbody>
        </table>
      </div>
    </div>

    <div class="panel">
      <h3>{{ t('reports.runsTitle') }}</h3>
      <div class="bk-table-wrap">
        <table class="list">
          <thead>
            <tr>
              <th>{{ t('reports.colDefinition') }}</th>
              <th>{{ t('reports.colWindow') }}</th>
              <th>{{ t('reports.colRequested') }}</th>
              <th>{{ t('reports.colWhen') }}</th>
              <th>{{ t('reports.colRows') }}</th>
              <th>{{ t('reports.colStatus') }}</th>
              <th>{{ t('reports.colFile') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-if="runs.length === 0"
              class="dr-empty"
            >
              <td colspan="7">
                {{ t('reports.runsEmpty') }}
              </td>
            </tr>
            <tr
              v-for="run in runs"
              :key="run.id"
            >
              <td>{{ titleFor(run.definition_key) }}</td>
              <td class="mono nw">
                {{ run.window_from }} – {{ run.window_to }}
              </td>
              <td>{{ isScheduledRun(run.requested_by) ? t('reports.scheduled') : t('reports.manual') }}</td>
              <td class="nw">
                {{ run.generated_at === null ? t('dashboard.dash') : format(run.generated_at, 'short') }}
              </td>
              <td>{{ run.rows }}</td>
              <td>
                <span :class="pillClass(run.status)">{{ run.status }}</span>
                <p
                  v-if="run.status === 'FAILED' && run.error !== null"
                  class="mono"
                >
                  {{ run.error }}
                </p>
              </td>
              <td>
                <p
                  v-if="run.purged_at !== null"
                  class="mono"
                >
                  {{ purgedLine() }}
                </p>
                <template v-else>
                  <UButton
                    v-for="fileFormat in run.formats"
                    :key="fileFormat"
                    type="button"
                    @click="download(run, fileFormat)"
                  >
                    {{ t('reports.download', { format: fileFormat }) }}
                  </UButton>
                </template>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <div class="panel">
      <h3>{{ t('reports.subscriptionsTitle') }}</h3>
      <div class="bk-table-wrap">
        <table class="list">
          <thead>
            <tr>
              <th>{{ t('reports.colDefinition') }}</th>
              <th>{{ t('reports.colCadence') }}</th>
              <th>{{ t('reports.colNext') }}</th>
              <th>{{ t('reports.colActive') }}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="subscription in subscriptions"
              :key="subscription.id"
            >
              <td>
                <div>{{ titleFor(subscription.definition_key) }}</div>
                <p class="mono">
                  {{ t('reports.recipients', { permission: definitions.find(definition => definition.key === subscription.definition_key)?.permission ?? '' }) }}
                </p>
              </td>
              <td>{{ subscription.cadence }}</td>
              <td>
                {{ scheduleLine(subscription) }}
                <label v-if="can('rules.manage')">
                  {{ t('reports.sendAt') }}
                  <input
                    type="time"
                    :value="subscription.send_at"
                    @change="onSendAt(subscription, $event)"
                  >
                </label>
              </td>
              <td>
                <input
                  type="checkbox"
                  :checked="subscription.active"
                  :disabled="!can('rules.manage')"
                  :aria-label="t('reports.colActive')"
                  @change="onActive(subscription, $event)"
                >
              </td>
              <td>
                <UButton
                  v-if="can('rules.manage')"
                  type="button"
                  :disabled="posting"
                  @click="runNow(subscription)"
                >
                  {{ t('reports.runNow') }}
                </UButton>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>
