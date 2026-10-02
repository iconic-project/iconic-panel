import { existsSync } from 'node:fs'
import { resolve } from 'node:path'

function isUiLayer(cwd: string): boolean {
  return existsSync(resolve(cwd, 'app/types/engine.ts'))
}

const localUi = resolve(import.meta.dirname, '../iconic-ui')
const uiLayer = existsSync(localUi)
  ? '../iconic-ui'
  : 'github:iconic-project/iconic-ui#dev'

export default defineNuxtConfig({
  extends: [uiLayer],

  modules: [
    (_options, nuxt) => {
      const layer = nuxt.options._layers.find(item =>
        item.cwd !== nuxt.options.rootDir && isUiLayer(item.cwd)
      )
      if (layer) {
        nuxt.options.alias['#iconic-ui'] = layer.cwd
      }
    },
    '@nuxt/ui',
    '@nuxt/eslint'
  ],

  ssr: false,

  css: ['~/assets/css/shell.css', '~/assets/css/lists.css', '~/assets/css/config.css', '~/assets/css/inventory.css', '~/assets/css/bookings.css', '~/assets/css/documents.css', '~/assets/css/crm.css'],

  runtimeConfig: {
    public: {
      apiBase: 'http://localhost:8000'
    }
  },

  alias: existsSync(localUi)
    ? { '#iconic-ui': localUi }
    : {},

  devServer: {
    port: 3001
  },

  compatibilityDate: '2026-06-30',

  eslint: {
    config: {
      stylistic: {
        commaDangle: 'never',
        braceStyle: '1tbs'
      }
    }
  },

  i18n: {
    locales: [
      { code: 'en', language: 'en', file: 'en.json' },
      { code: 'es', language: 'es', file: 'es.json' }
    ],
    detectBrowserLanguage: false,
    vueI18n: './i18n.config.ts'
  }
})
