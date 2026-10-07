<script setup lang="ts">
import type {
  DealStage,
  DealType,
  MoveDealInput,
  Paginated,
  PipelineColumn,
  PipelineDeal,
  PipelineKpis,
  StageMapRow,
  UserListItem
} from '../../../types/api'
import ReasonModal from '../../../components/bookings/ReasonModal.vue'
import DealDrawer from '../../../components/crm/DealDrawer.vue'
import NewDealModal from '../../../components/crm/NewDealModal.vue'
import { canDropOn, SELECT_ALL, slaBadge, withSelectAll } from '../../../components/crm/salesHelpers'
import { firstApiMessage } from '../../../utils/apiForm'

type PipelinePayload = {
  columns: Array<PipelineColumn>
  meta: {
    kpis: PipelineKpis
  }
}

const MOVES: Array<MoveDealInput['stage']> = ['NEW_LEAD', 'QUALIFYING', 'QUOTED', 'NEGOTIATION', 'LOST']
const TYPES: Array<DealType> = ['FIT', 'GROUP', 'CHARTER', 'AGENCY']

const emptyKpis: PipelineKpis = {
  collected: 0,
  scheduled_in: 0,
  awaiting_first_payment: 0,
  open_pipeline_count: 0,
  open_pipeline_value: 0,
  weighted_forecast: 0,
  overdue: 0
}

const { t } = useI18n()
const { request } = useApi()
const { format } = useMoney()
const { can } = useAuth()
const toast = useToast()

const owner = ref(SELECT_ALL)
const type = ref(SELECT_ALL)
const q = ref('')
const columns = ref<Array<PipelineColumn>>([])
const kpis = ref<PipelineKpis | null>(null)
const stageMap = ref<Array<StageMapRow>>([])
const users = ref<Array<UserListItem>>([])
const loadError = ref('')
const draggingId = ref<number | null>(null)
const drawerOpen = ref(false)
const drawerId = ref<number | null>(null)
const revision = ref(0)
const newOpen = ref(false)
const lostOpen = ref(false)
const lostSubmitting = ref(false)
const lostError = ref('')
const pendingMove = ref<{ id: number, stage: MoveDealInput['stage'] } | null>(null)

const shown = computed(() => kpis.value ?? emptyKpis)
const canMove = computed(() => can('pipeline.move_stage'))

const ownerItems = computed(() => withSelectAll(t('crmPipeline.ownerAll'), [
  { label: t('crmPipeline.ownerMe'), value: 'me' },
  { label: t('crmPipeline.unassigned'), value: 'unassigned' },
  ...users.value.map(user => ({
    label: user.name,
    value: String(user.id)
  }))
]))

const typeItems = computed(() => withSelectAll(
  t('crmPipeline.typeAll'),
  TYPES.map(item => ({
    label: t(`crmPipeline.types.${item}`),
    value: item
  }))
))

const moveItems = computed(() => MOVES.map(stage => ({
  label: t(`crmPipeline.stages.${stage}`),
  value: stage
})))

onMounted(() => {
  void load()
  void loadMap()
  void request('/api/rms/users?per_page=100').then((page) => {
    users.value = (page as Paginated<UserListItem>).data
  }).catch(() => {
    users.value = []
  })
})

watch([owner, type], () => {
  void load()
})

async function load(): Promise<void> {
  const params = new URLSearchParams()

  if (owner.value !== SELECT_ALL) {
    params.set('owner', owner.value)
  }

  if (type.value !== SELECT_ALL) {
    params.set('type', type.value)
  }

  if (q.value.trim() !== '') {
    params.set('q', q.value.trim())
  }

  const query = params.toString()

  try {
    const payload = await request(query === '' ? '/api/crm/pipeline' : `/api/crm/pipeline?${query}`) as PipelinePayload
    columns.value = payload.columns
    kpis.value = payload.meta.kpis
    loadError.value = ''
    revision.value += 1
  } catch (error: unknown) {
    loadError.value = firstApiMessage(error) ?? t('crmPipeline.moveFailed')
  }
}

async function loadMap(): Promise<void> {
  const payload = await request('/api/crm/pipeline/stage-map') as { data: Array<StageMapRow> }
  stageMap.value = payload.data
}

function cardById(id: number): PipelineDeal | undefined {
  return columns.value.flatMap(column => column.deals).find(deal => deal.id === id)
}

function openDeal(id: number): void {
  drawerId.value = id
  drawerOpen.value = true
}

function onDragStart(deal: PipelineDeal, event: DragEvent): void {
  draggingId.value = deal.id
  event.dataTransfer?.setData('text/plain', String(deal.id))
}

function onDragEnd(): void {
  draggingId.value = null
}

function highlight(stage: DealStage): boolean {
  if (draggingId.value === null) {
    return false
  }

  const card = cardById(draggingId.value)

  return card !== undefined && canDropOn(stage, card)
}

async function dropOn(stage: DealStage, event: DragEvent): Promise<void> {
  event.preventDefault()
  const raw = event.dataTransfer?.getData('text/plain')
  const id = raw !== undefined && raw !== '' ? Number(raw) : draggingId.value
  draggingId.value = null

  if (id === null || !Number.isFinite(id) || !MOVES.includes(stage as MoveDealInput['stage'])) {
    return
  }

  const card = cardById(id)

  if (!card) {
    return
  }

  const next = stage as MoveDealInput['stage']

  if (card.may_move && next === 'LOST') {
    pendingMove.value = { id, stage: next }
    lostError.value = ''
    lostOpen.value = true
    return
  }

  await move(id, next, null)
}

async function move(id: number, stage: MoveDealInput['stage'], reason: string | null): Promise<boolean> {
  try {
    await request(`/api/crm/deals/${String(id)}/stage`, {
      method: 'PATCH',
      body: { stage, reason }
    })
    await load()
    return true
  } catch (error: unknown) {
    const message = firstApiMessage(error) ?? t('crmPipeline.moveFailed')

    if (lostOpen.value) {
      lostError.value = message
    } else {
      toast.add({ title: message })
    }

    return false
  }
}

async function submitLost(reason: string): Promise<void> {
  if (pendingMove.value === null) {
    return
  }

  lostSubmitting.value = true
  lostError.value = ''
  const ok = await move(pendingMove.value.id, pendingMove.value.stage, reason)
  lostSubmitting.value = false

  if (ok) {
    lostOpen.value = false
    pendingMove.value = null
  }
}

function onKeyboardMove(deal: PipelineDeal, stage: string | number | boolean | null | undefined): void {
  if (typeof stage !== 'string' || stage === '') {
    return
  }

  if (!deal.may_move || !MOVES.includes(stage as MoveDealInput['stage'])) {
    return
  }

  const next = stage as MoveDealInput['stage']

  if (next === 'LOST') {
    pendingMove.value = { id: deal.id, stage: next }
    lostError.value = ''
    lostOpen.value = true
    return
  }

  void move(deal.id, next, null)
}
</script>

<template>
  <div>
    <div class="krow">
      <AnkKpi
        :label="t('crmPipeline.kpiCollected')"
        :sub="t('crmPipeline.kpiCollectedSub')"
      >
        {{ format(shown.collected) }}
      </AnkKpi>
      <AnkKpi
        :label="t('crmPipeline.kpiScheduled')"
        :sub="t('crmPipeline.kpiScheduledSub')"
      >
        {{ format(shown.scheduled_in) }}
      </AnkKpi>
      <AnkKpi
        :label="t('crmPipeline.kpiAwaiting')"
        :sub="t('crmPipeline.kpiAwaitingSub')"
      >
        {{ format(shown.awaiting_first_payment) }}
      </AnkKpi>
      <AnkKpi
        :label="t('crmPipeline.kpiOpen')"
        :sub="t('crmPipeline.kpiOpenSub', { count: String(shown.open_pipeline_count) })"
      >
        {{ format(shown.open_pipeline_value) }}
      </AnkKpi>
      <AnkKpi
        :label="t('crmPipeline.kpiWeighted')"
        :sub="t('crmPipeline.kpiWeightedSub')"
      >
        <span class="crm-kpi-alert">{{ format(shown.weighted_forecast) }}</span>
      </AnkKpi>
      <AnkKpi
        :label="t('crmPipeline.kpiOverdue')"
        :sub="t('crmPipeline.kpiOverdueSub')"
      >
        <span class="crm-kpi-alert">{{ format(shown.overdue) }}</span>
      </AnkKpi>
    </div>

    <p
      v-if="loadError"
      class="warnbox"
    >
      {{ loadError }}
    </p>

    <div class="panel">
      <div class="bk-toolbar pipe-head">
        <h3>{{ t('crmPipeline.title') }}</h3>
        <UButton
          v-if="canMove"
          @click="newOpen = true"
        >
          {{ t('crmPipeline.newDeal') }}
        </UButton>
      </div>
      <div class="ebtool dep-toolbar pipe-filters">
        <USelect
          v-model="owner"
          size="sm"
          :items="ownerItems"
        />
        <USelect
          v-model="type"
          size="sm"
          :items="typeItems"
        />
        <input
          v-model="q"
          class="pipe-search"
          type="search"
          :placeholder="t('crmPipeline.search')"
          @keydown.enter="load"
        >
      </div>

      <div class="pipe">
        <section
          v-for="column in columns"
          :key="column.stage"
          class="col"
          :data-stage="column.stage"
          :class="{ drop: highlight(column.stage) }"
          @dragover.prevent
          @drop="dropOn(column.stage, $event)"
        >
          <h3>
            {{ column.label }}
            <span class="sla">{{ column.sla }}</span>
            <span class="money">{{ format(column.total) }} · {{ column.weighted_total === null ? '—' : format(column.weighted_total) }}</span>
          </h3>
          <div class="cards">
            <article
              v-for="deal in column.deals"
              :key="deal.id"
              class="card"
              :class="{ dragging: draggingId === deal.id }"
              draggable="true"
              @dragstart="onDragStart(deal, $event)"
              @dragend="onDragEnd"
            >
              <span
                v-if="!deal.may_move"
                class="lock"
              >{{ t('crmPipeline.locked') }}</span>
              <span
                v-if="slaBadge(deal.sla_state)"
                class="slabadge"
                :class="deal.sla_state ?? 'ok'"
              >{{ slaBadge(deal.sla_state) }}</span>
              <button
                type="button"
                class="nm"
                @click="openDeal(deal.id)"
              >
                {{ deal.title }}
              </button>
              <span class="mono">{{ deal.type }} · {{ deal.owner?.name ?? t('crmPipeline.unassigned') }}</span>
              <span
                class="rmsref"
                :class="{ none: deal.booking === null }"
              >{{ deal.booking?.reference ?? t('crmPipeline.noRmsYet') }}</span>
              <span class="val">{{ format(deal.value) }} {{ deal.value_label }}</span>
              <span class="mono">{{ deal.contact.name }}</span>
              <USelect
                v-if="deal.may_move"
                :model-value="undefined"
                class="move"
                size="sm"
                :placeholder="t('crmPipeline.moveTo')"
                :items="moveItems"
                @update:model-value="onKeyboardMove(deal, $event)"
                @click.stop
              />
            </article>
          </div>
        </section>
      </div>
    </div>

    <div class="panel">
      <div class="bk-toolbar">
        <h3>{{ t('crmPipeline.stageMap') }}</h3>
      </div>
      <table class="list">
        <thead>
          <tr>
            <th>{{ t('crmPipeline.stage') }}</th>
            <th>{{ t('crmPipeline.owner') }}</th>
            <th>{{ t('crmPipeline.enters') }}</th>
            <th>{{ t('crmPipeline.leaves') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="row in stageMap"
            :key="row.stage"
          >
            <td>{{ row.label }}</td>
            <td>{{ row.owner }}</td>
            <td>{{ row.enters_when }}</td>
            <td>{{ row.leaves_when }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <DealDrawer
      v-model:open="drawerOpen"
      :deal-id="drawerId"
      :revision="revision"
      @changed="load"
    />
    <NewDealModal
      v-model:open="newOpen"
      @created="load"
    />
    <ReasonModal
      v-model:open="lostOpen"
      :title="t('crmPipeline.lostTitle')"
      hint="required"
      :submitting="lostSubmitting"
      :error="lostError"
      @submit="submitLost"
    />
  </div>
</template>
