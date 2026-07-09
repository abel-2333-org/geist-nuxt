// https://nuxt.com/docs/api/configuration/nuxt-config
// @geist-nuxt/starter — a clean, empty scaffold. It extends ONLY the core
// design-system layer, so you inherit the Geist tokens, fonts, color mode, and
// base components (CopyButton / SplitPane / ThemeToggle) without any showcase
// or api-docs content. Build your app under app/pages and app/components.
export default defineNuxtConfig({
  compatibilityDate: '2025-01-01',
  devtools: { enabled: true },

  extends: ['@geist-nuxt/core'],

  // Local components auto-import without a directory-name prefix.
  components: [{ path: '~/components', pathPrefix: false }],
})
