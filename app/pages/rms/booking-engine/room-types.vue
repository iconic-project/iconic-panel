<script setup lang="ts">
import type { PropertyContent, RoomTypeContent } from '../../../types/api'
import CompletenessMeter from '../../../components/content/CompletenessMeter.vue'
import RoomTypeDrawer from '../../../components/content/RoomTypeDrawer.vue'

const { can, user } = useAuth()
const { t } = useI18n()
const { request, useFetch } = useApi()

const { data: propertiesPayload } = useFetch<{ data: Array<PropertyContent> }>('/api/rms/properties')

const properties = computed(() => propertiesPayload.value?.data ?? [])
const propertyId = ref<number | undefined>(undefined)
const types = ref<Array<RoomTypeContent>>([])
const drawerOpen = ref(false)
const editing = ref<RoomTypeContent | null>(null)

const canManage = computed(() => can('properties.manage'))
const roleName = computed(() => user.value?.role.name ?? '')

watch(properties, (list) => {
  if (propertyId.value === undefined && list[0]) {
    propertyId.value = list[0].id
  }
}, { immediate: true })

watch(propertyId, () => {
  void loadTypes()
})

async function loadTypes(): Promise<void> {
  if (propertyId.value === undefined) {
    types.value = []
    return
  }

  const result = await request(`/api/rms/properties/${propertyId.value}/room-types`) as { data: Array<RoomTypeContent> }
  types.value = result.data
}

function openCreate(): void {
  editing.value = null
  drawerOpen.value = true
}

function openType(type: RoomTypeContent): void {
  editing.value = type
  drawerOpen.value = true
}

async function onSaved(type: RoomTypeContent): Promise<void> {
  await loadTypes()
  editing.value = types.value.find(item => item.id === type.id) ?? type
}
</script>

<template>
  <div>
    <div class="ebtool">
      <div
        v-if="properties.length > 1"
        class="field"
      >
        <label for="room-type-property">{{ t('propertyContent.title') }}</label>
        <USelect
          id="room-type-property"
          v-model="propertyId"
          :items="properties.map(property => ({ value: property.id, label: property.name }))"
        />
      </div>
      <div class="acts">
        <UButton
          v-if="canManage"
          @click="openCreate"
        >
          {{ t('roomTypes.add') }}
        </UButton>
      </div>
    </div>

    <p
      v-if="types.length === 0"
      class="notice"
    >
      {{ t('roomTypes.empty') }}
    </p>

    <div class="itgrid">
      <button
        v-for="type in types"
        :key="type.id"
        type="button"
        class="itc"
        @click="openType(type)"
      >
        <div class="bd">
          <div class="mono">
            {{ type.code }}
          </div>
          <h4>{{ type.name }}</h4>
          <p>{{ type.bed_setup }}</p>
          <CompletenessMeter :completeness="type.completeness" />
        </div>
      </button>
    </div>

    <RoomTypeDrawer
      v-model:open="drawerOpen"
      :property-id="propertyId ?? null"
      :type="editing"
      :can-manage="canManage"
      :role-name="roleName"
      @saved="onSaved"
    />
  </div>
</template>
