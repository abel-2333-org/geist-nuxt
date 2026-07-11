// https://nuxt.com/docs/api/configuration/nuxt-config
// @geist-nuxt/gallery — the design-system showcase app. It extends the core
// layer (tokens, fonts, color mode, base components/composables) and the
// api-docs kit (CodeBlock / RequestExample / ResponseExample), so all of the
// design system is available here without any local duplication.
export default defineNuxtConfig({
  compatibilityDate: '2025-01-01',
  devtools: { enabled: true },

  extends: ['@geist-nuxt/core', '@geist-nuxt/kit-api-docs'],

  // Local components auto-import with directory-name prefixing (scene = subdir
  // = prefix). Root: AppHeader.vue -> `<AppHeader>`; scene: gallery/Entry.vue
  // -> `<GalleryEntry>`. See references/foundations/conventions.md.
  components: [{ path: '~/components', pathPrefix: true }],
})
