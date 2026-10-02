<script setup lang="ts">
const { t } = useI18n()
const toast = useToast()
const { pending } = useForbiddenToast()

watch(pending, (value) => {
  if (!value) {
    return
  }

  toast.add({ title: t('auth.forbidden') })
  pending.value = false
}, { immediate: true })

useHead({
  meta: [
    { name: 'viewport', content: 'width=device-width, initial-scale=1' }
  ],
  htmlAttrs: {
    lang: 'en'
  }
})

useSeoMeta({
  title: 'HILO',
  description: 'HILO staff panel — RMS and CRM'
})
</script>

<template>
  <UApp>
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </UApp>
</template>
