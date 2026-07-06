// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-01-01',
  devtools: { enabled: true },

  // Nuxt UI auto-registers @nuxt/icon, @nuxt/fonts and @nuxtjs/color-mode.
  modules: ['@nuxt/ui'],

  // Geist token layer + Nuxt UI semantic variables live here.
  css: ['~/assets/css/main.css'],

  // Geist visual language uses a light-first canvas; color mode is toggled
  // via the built-in @nuxtjs/color-mode integration (see ThemeToggle.vue).
  colorMode: {
    preference: 'system',
    fallback: 'light',
  },

  ui: {
    // Register the extra semantic alias so `secondary`-colored components work.
    // Geist has no cyan; its accent maps to `teal`.
    theme: {
      colors: ['primary', 'secondary', 'success', 'info', 'warning', 'error'],
    },
  },
})
