<script setup lang="ts">
import type { ManifestVersion } from '../../types/api'
import { downloadDocumentFile } from '../documents/documentFetch'

const props = defineProps<{
  departureId: number
}>()

const { t } = useI18n()
const { request } = useApi()
const versions = ref<ManifestVersion[]>([])
const error = ref('')

try {
  const loaded = await request(`/api/rms/departures/${props.departureId}/manifests`) as { data: ManifestVersion[] }
  versions.value = loaded.data
} catch {
  versions.value = []
}

async function download(version: ManifestVersion, format: 'pdf' | 'csv'): Promise<void> {
  error.value = ''

  try {
    await downloadDocumentFile(
      `/api/rms/departures/${props.departureId}/manifests/${version.id}/file/${format}`,
      `${version.kind}-v${String(version.version)}.${format}`
    )
  } catch (caught: unknown) {
    error.value = caught instanceof Error ? caught.message : t('bookings.manifestDownloadFailed')
  }
}
</script>

<template>
  <section>
    <p class="history-note">
      {{ t('bookings.pastManifests') }}
    </p>
    <p
      v-if="versions.length === 0"
      class="history-note"
    >
      {{ t('bookings.pastManifestsEmpty') }}
    </p>
    <ul v-else>
      <li
        v-for="version in versions"
        :key="version.id"
      >
        <span>{{ version.kind }} v{{ version.version }}</span>
        <UButton
          size="sm"
          variant="outline"
          @click="download(version, 'pdf')"
        >
          {{ t('bookings.manifestDownload', { format: 'PDF' }) }}
        </UButton>
        <UButton
          v-if="version.kind !== 'CAPTAIN'"
          size="sm"
          variant="outline"
          @click="download(version, 'csv')"
        >
          {{ t('bookings.manifestDownload', { format: 'CSV' }) }}
        </UButton>
      </li>
    </ul>
    <p
      v-if="error"
      class="field-error"
    >
      {{ error }}
    </p>
  </section>
</template>
