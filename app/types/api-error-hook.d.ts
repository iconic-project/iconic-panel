import type { ApiError } from '#iconic-ui/app/composables/useApi'

declare module '#app' {
  interface RuntimeNuxtHooks {
    'iconic:api-error': (error: ApiError) => void
  }
}

export {}
