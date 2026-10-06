<script setup lang="ts">
import type { PropertyContent } from '../../../types/api'
import PropertyEditor from '../../../components/content/PropertyEditor.vue'

const { can, user } = useAuth()
const { t } = useI18n()
const { useFetch } = useApi()

const { data, refresh } = useFetch<{ data: Array<PropertyContent> }>('/api/rms/properties')

const properties = computed(() => data.value?.data ?? [])
const selectedId = ref<number | undefined>(undefined)

watch(properties, (list) => {
  if (selectedId.value === undefined && list[0]) {
    selectedId.value = list[0].id
  }
}, { immediate: true })

const selected = computed(() => properties.value.find(property => property.id === selectedId.value) ?? null)
const canManage = computed(() => can('properties.manage'))
const roleName = computed(() => user.value?.role.name ?? '')

async function onSaved(): Promise<void> {
  await refresh()
}
</script>

<template>
  <div>
    <div
      v-if="properties.length > 1"
      class="field"
    >
      <label for="property-pick">{{ t('propertyContent.title') }}</label>
      <USelect
        id="property-pick"
        v-model="selectedId"
        :items="properties.map(property => ({ value: property.id, label: property.name }))"
        class="w-full"
      />
    </div>

    <PropertyEditor
      v-if="selected"
      :property="selected"
      :can-manage="canManage"
      :role-name="roleName"
      @saved="onSaved"
    />
  </div>
</template>
