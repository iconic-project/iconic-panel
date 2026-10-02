<script setup lang="ts">
const { t } = useI18n()
</script>

<template>
  <div class="auth-layout">
    <div class="auth-theme">
      <ShellLocaleSwitch />
      <AnkThemeToggle />
    </div>

    <div class="auth-column">
      <div class="brand">
        <AnkWordmark />
        <small>{{ t('shell.brandRms') }}</small>
      </div>

      <slot />
    </div>
  </div>
</template>
