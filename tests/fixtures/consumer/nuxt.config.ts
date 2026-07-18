import { geistNuxtConfig } from './app/config/geist-nuxt'

export default defineNuxtConfig({
  compatibilityDate: '2025-01-01',
  modules: ['@nuxt/ui'],
  css: ['./app/assets/css/main.css', './app/assets/css/geist.css'],
  colorMode: geistNuxtConfig.colorMode,
  ui: geistNuxtConfig.ui,
})
