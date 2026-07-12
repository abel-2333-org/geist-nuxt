// https://nuxt.com/docs/api/configuration/nuxt-config
// (inline rich text is rendered by a synchronous tokenizer in ProseText.vue,
//  so no markdown/MDC module is needed here.)
export default defineNuxtConfig({
  compatibilityDate: '2025-01-01',
  devtools: { enabled: true },

  // Nuxt UI auto-registers @nuxt/icon, @nuxt/fonts and @nuxtjs/color-mode.
  modules: ['@nuxt/ui'],

  // Register components by bare filename (no directory prefix), so a file at
  // `components/reference/FieldItem.vue` is used as `<FieldItem>` rather than
  // `<ReferenceFieldItem>`. Directories still organize the source; they just
  // don't leak into component names. Basenames are kept unique to avoid clashes.
  components: [{ path: '~/components', pathPrefix: false }],

  // Geist token layer + Nuxt UI semantic variables live here.
  css: ['~/assets/css/main.css'],

  // Geist visual language uses a light-first canvas; color mode is toggled
  // via the built-in @nuxtjs/color-mode integration (see ThemeToggle.vue).
  colorMode: {
    preference: 'system',
    fallback: 'light',
  },

  ui: {
    // Force-register the prose component set (UProseCode, etc.) even though
    // @nuxt/content is not installed — these are plain Vue components with no
    // content-pipeline dependency, so we can reuse them without the MDC/SQLite
    // layer. See InlineCode.vue for the one we consume.
    prose: true,

    // Register the extra semantic alias so `secondary`-colored components work.
    // Geist has no cyan; its accent maps to `teal`.
    theme: {
      colors: ['primary', 'secondary', 'success', 'info', 'warning', 'error'],
    },
  },
})
