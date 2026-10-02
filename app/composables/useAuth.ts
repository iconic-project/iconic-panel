import { LAST_PATH_KEYS } from '../sections'
import type { Me, Permission } from '../types/api'
import type { SectionId } from '../navigation/types'

const USER_STATE = 'iconic.auth.user'
const FETCHED_STATE = 'iconic.auth.fetched'

let fetchPromise: Promise<void> | null = null

export function useAuth() {
  const user = useState<Me | null>(USER_STATE, () => null)
  const fetched = useState(FETCHED_STATE, () => false)
  const { request } = useApi()

  const isSignedIn = computed(() => user.value !== null)

  function can(permission: Permission): boolean {
    return user.value?.permissions.includes(permission) ?? false
  }

  function hasSection(id: SectionId): boolean {
    return user.value?.sections.includes(id) ?? false
  }

  async function fetchMe(): Promise<void> {
    try {
      user.value = await request('/api/auth/me') as Me
    } catch {
      user.value = null
    } finally {
      fetched.value = true
    }
  }

  function ensureMe(): Promise<void> {
    if (fetched.value) {
      return Promise.resolve()
    }

    if (!fetchPromise) {
      fetchPromise = fetchMe().finally(() => {
        fetchPromise = null
      })
    }

    return fetchPromise
  }

  async function login(email: string, password: string): Promise<Me> {
    const me = await request('/api/auth/login', {
      method: 'POST',
      body: { email, password }
    }) as Me

    user.value = me
    fetched.value = true

    return me
  }

  function clearSession(): void {
    user.value = null

    if (import.meta.client) {
      localStorage.removeItem(LAST_PATH_KEYS.rms)
      localStorage.removeItem(LAST_PATH_KEYS.crm)
    }

    clearNuxtData()
  }

  async function logout(): Promise<void> {
    user.value = null

    if (import.meta.client) {
      localStorage.removeItem(LAST_PATH_KEYS.rms)
      localStorage.removeItem(LAST_PATH_KEYS.crm)
    }

    try {
      await request('/api/auth/logout', { method: 'POST' })
    } catch {
      // Session may already be gone.
    }

    clearNuxtData()
    await navigateTo('/login')
  }

  function setUser(me: Me): void {
    user.value = me
    fetched.value = true
  }

  return {
    user,
    isSignedIn,
    can,
    hasSection,
    fetchMe,
    ensureMe,
    login,
    logout,
    setUser,
    clearSession
  }
}
