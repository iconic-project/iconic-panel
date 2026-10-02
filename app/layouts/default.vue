<script setup lang="ts">
import { visibleNav } from '../navigation/guards'

const { t } = useI18n()
const { sectionId, section, currentItem } = useSystem()
const { can, hasSection } = useAuth()
const route = useRoute()
const { openNew } = useNewReservation()
const { count: requestCount, allowed: showRequestBadge, startPolling } = useOpenRequests()
const {
  total: alertTotal,
  tone: alertTone,
  visible: showAlertBell,
  startPolling: startAlertPolling
} = useAlertCounts()

const alertsTo = computed(() => {
  return sectionId.value === 'crm' ? '/crm/engine/alerts' : '/rms/operations/alerts'
})

function onNewReservation(): void {
  if (route.path === '/rms/reservations/bookings') {
    openNew()
    return
  }

  void navigateTo({
    path: '/rms/reservations/bookings',
    query: { new: '1' }
  })
}

const nav = computed(() => visibleNav(section.value, permission => can(permission)))
const showSectionSwitch = computed(() => hasSection('rms') && hasSection('crm'))
const showNewReservation = computed(() => sectionId.value === 'rms' && can('bookings.create'))

const pageTitle = computed(() => {
  return currentItem.value ? t(currentItem.value.labelKey) : t(section.value.labelKey)
})

useHead(() => ({
  title: pageTitle.value
}))

onMounted(() => {
  startPolling()
  startAlertPolling()
})
</script>

<template>
  <div class="app">
    <aside>
      <div class="brand">
        <AnkWordmark />
        <small>{{ t(section.brandSubtitleKey) }}</small>
      </div>

      <nav class="nav-scroll">
        <template
          v-for="group in nav"
          :key="group.id"
        >
          <div class="navsec">
            {{ t(group.labelKey) }}
          </div>
          <div class="nav">
            <NuxtLink
              v-for="item in group.items"
              :key="item.id"
              :to="item.to"
              :class="{ on: item.to === $route.path }"
            >
              {{ item.glyph }} {{ t(item.labelKey) }}
              <span
                v-if="item.badge && showRequestBadge"
                class="nav-badge pill p-req"
              >{{ requestCount }}</span>
            </NuxtLink>
          </div>
        </template>
      </nav>
    </aside>

    <main>
      <div
        class="tophead"
        :class="sectionId === 'rms' ? 'tophead--rms' : 'tophead--crm'"
      >
        <h1>{{ pageTitle }}</h1>
        <div
          class="drbar-slot"
          aria-hidden="true"
        />
        <div class="who">
          <NuxtLink
            v-if="showAlertBell"
            :to="alertsTo"
            class="alert-bell"
            :aria-label="t('shell.alerts')"
          >
            <svg
              class="alert-bell-icon"
              viewBox="0 0 16 16"
              aria-hidden="true"
            >
              <path
                d="M8 1.5a4.5 4.5 0 0 0-4.5 4.5v2.2L2 10.5h12l-1.5-2.3V6A4.5 4.5 0 0 0 8 1.5z"
                fill="none"
                stroke="currentColor"
                stroke-width="1.2"
              />
              <path
                d="M6.4 12.2a1.6 1.6 0 0 0 3.2 0"
                fill="none"
                stroke="currentColor"
                stroke-width="1.2"
              />
            </svg>
            <span
              class="pill"
              :class="alertTone"
            >{{ alertTotal }}</span>
          </NuxtLink>
          <ShellSectionSwitch v-if="showSectionSwitch" />
          <span class="mono">{{ t('shell.loggedInAs') }}</span>
          <ShellWhoMenu />
          <ShellLocaleSwitch />
          <AnkThemeToggle />
          <UButton
            v-if="showNewReservation"
            color="primary"
            @click="onNewReservation"
          >
            {{ t('shell.newReservation') }}
          </UButton>
        </div>
      </div>
      <slot />
    </main>
  </div>
</template>
