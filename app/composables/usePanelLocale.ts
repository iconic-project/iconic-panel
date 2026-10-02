export const PANEL_LOCALE_COOKIE = 'iconic_panel_locale'

const YEAR = 60 * 60 * 24 * 365

export function usePanelLocale() {
  const stored = useCookie<'en' | 'es' | null>(PANEL_LOCALE_COOKIE, {
    sameSite: 'lax',
    maxAge: YEAR,
    path: '/'
  })
  const { locale, setLocale, fallbackLocale } = useI18n()

  if (fallbackLocale.value !== 'en') {
    fallbackLocale.value = 'en'
  }

  async function applyStored(): Promise<void> {
    const value = stored.value

    if (value !== 'en' && value !== 'es') {
      return
    }

    if (locale.value !== value) {
      await setLocale(value)
    }
  }

  async function choose(code: 'en' | 'es'): Promise<void> {
    stored.value = code
    await setLocale(code)
  }

  return {
    stored,
    locale,
    choose,
    applyStored
  }
}
