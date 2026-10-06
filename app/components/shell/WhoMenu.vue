<script setup lang="ts">
const { t } = useI18n()
const { user, logout } = useAuth()

function nameParts(name: string): string[] {
  return name.trim().split(/\s+/).filter(part => /[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]/.test(part))
}

function letterInitial(part: string): string {
  return part.match(/[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]/)?.[0]?.toUpperCase() ?? ''
}

const displayName = computed(() => {
  const parts = nameParts(user.value?.name ?? '')
  const first = parts[0]
  if (!first) {
    return ''
  }

  const last = parts.length > 1 ? parts[parts.length - 1] : undefined
  const initial = last ? letterInitial(last) : ''
  return initial ? `${first} ${initial}.` : first
})

const initials = computed(() => {
  const parts = nameParts(user.value?.name ?? '')
  const first = parts[0] ? letterInitial(parts[0]) : ''
  const last = parts.length > 1 ? letterInitial(parts[parts.length - 1] ?? '') : ''
  return `${first}${last}`
})

const roleLabel = computed(() => (user.value?.role.name ?? '').toUpperCase())

const items = computed(() => [
  [
    {
      label: user.value?.email ?? '',
      disabled: true,
      class: 'who-email'
    }
  ],
  [
    {
      label: t('shell.signOut'),
      onSelect() {
        void logout()
      }
    }
  ]
])
</script>

<template>
  <UDropdownMenu
    v-if="user"
    :items="items"
  >
    <button
      type="button"
      class="who-chip"
      :aria-label="t('shell.whoAria')"
    >
      <span
        class="who-avatar"
        aria-hidden="true"
      >{{ initials }}</span>
      <span class="who-meta">
        <span class="who-name">{{ displayName }}</span>
        <span class="who-role">{{ roleLabel }}</span>
      </span>
      <svg
        class="who-chevron"
        viewBox="0 0 16 16"
        aria-hidden="true"
      >
        <path
          d="M4 6l4 4 4-4"
          fill="none"
          stroke="currentColor"
          stroke-width="1.4"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      </svg>
    </button>
  </UDropdownMenu>
</template>
