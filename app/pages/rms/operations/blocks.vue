<script setup lang="ts">
import type { BusinessRulesVersion } from '../../../types/api'
import DateRangeFilter from '../../../components/lists/DateRangeFilter.vue'
import BlockDrawer from '../../../components/blocks/BlockDrawer.vue'
import NewBlockModal from '../../../components/blocks/NewBlockModal.vue'
import ReleaseBlockModal from '../../../components/blocks/ReleaseBlockModal.vue'
import ShortenBlockModal from '../../../components/blocks/ShortenBlockModal.vue'
import {
  blockToOpen,
  readStayBounds,
  STATUS_LABEL_KEYS,
  type BlockListStatus,
  type RangeBlock
} from '../../../components/blocks/blockHelpers'

type PropertyOption = {
  id: number
  code: string
  name: string
}

const STATUSES: Array<BlockListStatus> = ['active', 'released', 'all']

const { can, user } = useAuth()
const { t } = useI18n()
const { useFetch, request } = useApi()
const { format } = useDates()
const route = useRoute()

const from = ref<string | null>(null)
const to = ref<string | null>(null)
const status = ref<BlockListStatus>('active')
const propertyId = ref<number | null>(null)
const drawerOpen = ref(false)
const createOpen = ref(false)
const releaseOpen = ref(false)
const shortenOpen = ref(false)
const selected = ref<RangeBlock | null>(null)
const releasing = ref<RangeBlock | null>(null)
const shortening = ref<RangeBlock | null>(null)
const openedFromQuery = ref(false)
const today = computed(() => format(new Date(), 'iso'))

const canManage = computed(() => can('blocks.manage'))
const roleName = computed(() => user.value?.role.name ?? '')

const { data: propertiesPayload } = useFetch<{ data: Array<PropertyOption> }>('/api/rms/properties')
const properties = computed(() => propertiesPayload.value?.data ?? [])

const { data: rulesPayload } = useFetch<BusinessRulesVersion>('/api/rms/business-rules')
const stay = computed(() => readStayBounds(rulesPayload.value?.document))

const listUrl = computed(() => {
  const params = new URLSearchParams({ status: status.value })

  if (propertyId.value !== null) {
    params.set('property_id', String(propertyId.value))
  }

  if (from.value !== null) {
    params.set('from', from.value)
  }

  if (to.value !== null) {
    params.set('to', to.value)
  }

  return `/api/rms/blocks?${params.toString()}`
})

const { data: listPayload, refresh } = useFetch<{ data: Array<RangeBlock> }>(listUrl)

const blocks = computed(() => listPayload.value?.data ?? [])
const total = computed(() => blocks.value.length)

function actorName(block: RangeBlock): string {
  return block.created_by?.name ?? t('blocks.system')
}

function openDrawer(block: RangeBlock): void {
  selected.value = block
  drawerOpen.value = true
}

function openRelease(block: RangeBlock, event: Event): void {
  event.stopPropagation()
  releasing.value = block
  releaseOpen.value = true
}

function openShorten(block: RangeBlock, event: Event): void {
  event.stopPropagation()
  shortening.value = block
  shortenOpen.value = true
}

async function onSaved(block: RangeBlock): Promise<void> {
  await refresh()
  selected.value = blocks.value.find(item => item.id === block.id) ?? block
}

async function onCreated(): Promise<void> {
  await refresh()
}

async function onReleased(): Promise<void> {
  await refresh()
}

async function onShortened(): Promise<void> {
  await refresh()
}

watch(
  [listPayload, () => route.query.open],
  async ([payload, open]) => {
    if (openedFromQuery.value || payload === undefined) {
      return
    }

    const fromList = blockToOpen(open as string | Array<string> | undefined, payload.data)

    if (fromList !== null) {
      openDrawer(fromList)
      openedFromQuery.value = true
      return
    }

    const reference = Array.isArray(open) ? open[0] : open

    if (typeof reference !== 'string' || reference === '') {
      openedFromQuery.value = true
      return
    }

    const all = await request('/api/rms/blocks?status=all') as { data: Array<RangeBlock> }
    const found = blockToOpen(reference, all.data)

    if (found !== null) {
      openDrawer(found)
    }

    openedFromQuery.value = true
  }
)
</script>

<template>
  <div>
    <DateRangeFilter
      v-model:from="from"
      v-model:to="to"
      :field-label="t('blocks.fieldLabel')"
      :noun="t('blocks.noun')"
      :total="total"
      :today="today"
    />

    <div class="panel">
      <h3>{{ t('blocks.panelTitle') }}</h3>
      <div class="ebtool dep-toolbar">
        <USelect
          v-model="propertyId"
          :items="[{ value: null, label: t('blocks.allProperties') }, ...properties.map(property => ({ value: property.id, label: property.name }))]"
          class="w-full"
        />
        <div class="fchips">
          <button
            v-for="item in STATUSES"
            :key="item"
            type="button"
            class="fchip"
            :class="{ on: status === item }"
            @click="status = item"
          >
            {{ t(STATUS_LABEL_KEYS[item]) }}
          </button>
        </div>
      </div>
      <div class="dep-table-wrap">
        <table class="list">
          <thead>
            <tr>
              <th>{{ t('blocks.colStay') }}</th>
              <th>{{ t('blocks.colNights') }}</th>
              <th>{{ t('blocks.colScope') }}</th>
              <th>{{ t('blocks.colReason') }}</th>
              <th>{{ t('blocks.colCreatedBy') }}</th>
              <th>{{ t('blocks.colNotes') }}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            <tr
              v-if="blocks.length === 0"
              class="dr-empty"
            >
              <td colspan="7">
                {{ t('blocks.empty') }}
              </td>
            </tr>
            <tr
              v-for="row in blocks"
              :key="row.id"
              class="dep-row"
              @click="openDrawer(row)"
            >
              <td>{{ format(row.starts_on, 'short') }} – {{ format(row.ends_on, 'short') }}</td>
              <td>{{ row.nights }}</td>
              <td>{{ row.scope_summary }}</td>
              <td>
                <span class="pill">{{ row.reason_label }}</span>
              </td>
              <td>{{ actorName(row) }}</td>
              <td>{{ row.notes }}</td>
              <td class="list-actions">
                <UButton
                  v-if="canManage && row.released_at === null"
                  variant="outline"
                  @click="openShorten(row, $event)"
                >
                  {{ t('blocks.shorten') }}
                </UButton>
                <UButton
                  v-if="canManage && row.released_at === null"
                  variant="outline"
                  @click="openRelease(row, $event)"
                >
                  {{ t('blocks.release') }}
                </UButton>
                <span
                  v-else-if="row.released_at"
                  class="blk-released"
                >
                  {{ t('blocks.releasedBy', {
                    date: format(row.released_at, 'short'),
                    name: row.released_by?.name ?? t('blocks.system')
                  }) }}
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <UButton
      v-if="canManage"
      class="blk-new"
      variant="outline"
      @click="createOpen = true"
    >
      {{ t('blocks.new') }}
    </UButton>

    <BlockDrawer
      v-model:open="drawerOpen"
      :source="selected"
      :can-manage="canManage"
      :role-name="roleName"
      @saved="onSaved"
    />

    <NewBlockModal
      v-model:open="createOpen"
      :properties="properties"
      :stay="stay"
      :prefill="null"
      @created="onCreated"
    />

    <ShortenBlockModal
      v-model:open="shortenOpen"
      :block="shortening"
      @shortened="onShortened"
    />

    <ReleaseBlockModal
      v-model:open="releaseOpen"
      :block="releasing"
      @released="onReleased"
    />
  </div>
</template>
