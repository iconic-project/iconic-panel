import { loginTarget } from '../navigation/guards'

export default defineNuxtPlugin(async () => {
  const { ensureMe, user } = useAuth()
  const { showForbiddenToast } = useForbiddenToast()

  await ensureMe()

  const nuxtApp = useNuxtApp()

  nuxtApp.hook('iconic:api-error', (error) => {
    if (error.status === 401) {
      if (user.value === null) {
        return
      }

      user.value = null
      clearNuxtData()
      void navigateTo(loginTarget(useRoute().fullPath))
      return
    }

    if (error.status === 403) {
      showForbiddenToast()
    }
  })
})
