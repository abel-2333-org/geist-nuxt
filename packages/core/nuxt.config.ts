import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

// @geist-nuxt/core — the Geist design-system Nuxt *layer*.
// Consumers do `extends: ['@geist-nuxt/core']` and inherit everything below:
// the Nuxt UI module, the Geist token stylesheet, color-mode config, and the
// theme color aliases. Components (app/components) and composables
// (app/composables) are auto-imported into every consumer by Nuxt's layer
// scanning; app.config.ts (color role -> palette mapping) is merged too.
const currentDir = dirname(fileURLToPath(import.meta.url))

export default defineNuxtConfig({
  // Nuxt UI auto-registers @nuxt/icon, @nuxt/fonts and @nuxtjs/color-mode.
  modules: ['@nuxt/ui'],

  // Geist token layer + Nuxt UI semantic variables. Resolved to an ABSOLUTE
  // path from this layer's own directory so it loads correctly no matter which
  // consuming app extends the layer (the `~` alias would resolve against the
  // consumer, not the layer).
  css: [join(currentDir, './app/assets/css/main.css')],

  // Auto-import this layer's components without a directory-name prefix, so
  // e.g. app/components/CopyButton.vue is `<CopyButton>`. Consumers keep their
  // own pathPrefix:false config for their local components.
  components: [{ path: join(currentDir, './app/components'), pathPrefix: false }],

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
