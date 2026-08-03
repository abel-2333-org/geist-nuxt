import base from './app/config/foundation/nuxt'

export default defineNuxtConfig({
  compatibilityDate: '2025-01-01',
  modules: ['@nuxt/ui'],
  css: ['./app/assets/css/main.css'],
  colorMode: base.colorMode,
  ui: {
    ...base.ui,
    fonts: false,
  },
})
