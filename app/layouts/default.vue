<script setup lang="ts">
import { visibleNav } from '../navigation/guards'

const { t } = useI18n()
const { sectionId, section, currentItem } = useSystem()
const { can, hasSection } = useAuth()
const route = useRoute()
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
  void navigateTo({
    path: '/rms/reservations/bookings',
    query: { ...route.query, new: '1' }
  })
}

const nav = computed(() => visibleNav(section.value, permission => can(permission)))
const showSectionSwitch = computed(() => hasSection('rms') && hasSection('crm'))
const showNewReservation = computed(() => sectionId.value === 'rms' && can('bookings.create'))

const colorMode = useColorMode()

const pageTitle = computed(() => {
  return currentItem.value ? t(currentItem.value.labelKey) : t(section.value.labelKey)
})

const themeIsDark = computed(() => colorMode.value === 'dark')

function toggleTheme(): void {
  colorMode.preference = colorMode.value === 'dark' ? 'light' : 'dark'
}

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
        <AnkWordmark size="lg" />
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
              {{ t(item.labelKey) }}
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
        <div class="tophead-title">
          <h1>{{ pageTitle }}</h1>
        </div>
        <div
          class="drbar-slot"
          aria-hidden="true"
        />
        <div class="who">
          <ShellSectionSwitch v-if="showSectionSwitch" />
          <ShellLocaleSwitch />
          <button
            type="button"
            class="shell-icon"
            :aria-label="t('theme.toggleAria')"
            @click="toggleTheme"
          >
            <svg
              v-if="themeIsDark"
              viewBox="0 0 16 16"
              aria-hidden="true"
            >
              <circle
                cx="8"
                cy="8"
                r="2.6"
                fill="none"
                stroke="currentColor"
                stroke-width="1.3"
              />
              <path
                d="M8 1.6v1.6M8 12.8v1.6M1.6 8h1.6M12.8 8h1.6M3.4 3.4l1.1 1.1M11.5 11.5l1.1 1.1M12.6 3.4l-1.1 1.1M4.5 11.5l-1.1 1.1"
                fill="none"
                stroke="currentColor"
                stroke-width="1.3"
                stroke-linecap="round"
              />
            </svg>
            <svg
              v-else
              viewBox="0 0 16 16"
              aria-hidden="true"
            >
              <path
                d="M9.2 1.6a5.6 5.6 0 1 0 5.2 7.6A4.6 4.6 0 0 1 9.2 1.6z"
                fill="none"
                stroke="currentColor"
                stroke-width="1.3"
                stroke-linejoin="round"
              />
            </svg>
          </button>
          <NuxtLink
            v-if="showAlertBell"
            :to="alertsTo"
            class="shell-icon"
            :aria-label="t('shell.alerts')"
          >
            <svg
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
              v-if="alertTotal > 0"
              class="alert-count"
              :class="alertTone"
            >{{ alertTotal }}</span>
          </NuxtLink>
          <ShellWhoMenu />
          <UButton
            v-if="showNewReservation"
            color="primary"
            class="shell-new"
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
