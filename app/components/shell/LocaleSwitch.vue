<script setup lang="ts">
const { t, locale } = useI18n()
const { choose, applyStored, stored } = usePanelLocale()

useHead({
  htmlAttrs: {
    lang: locale
  }
})

function onChoose(code: 'en' | 'es'): void {
  void choose(code)
}

onMounted(() => {
  void applyStored()
})

defineExpose({
  choose,
  applyStored,
  stored
})
</script>

<template>
  <div
    class="panel-locale"
    role="group"
    :aria-label="t('shell.localeAria')"
  >
    <button
      type="button"
      class="shell-seg shell-seg--quiet"
      data-locale="en"
      :class="{ on: locale === 'en' }"
      :aria-pressed="locale === 'en'"
      @click="onChoose('en')"
    >
      EN
    </button>
    <button
      type="button"
      class="shell-seg shell-seg--quiet"
      data-locale="es"
      :class="{ on: locale === 'es' }"
      :aria-pressed="locale === 'es'"
      @click="onChoose('es')"
    >
      ES
    </button>
  </div>
</template>
