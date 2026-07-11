import { createResolver } from '@nuxt/kit'

// @geist-nuxt/kit-api-docs — an optional *domain* layer for API-reference
// pages. It extends the core design system and adds the API-docs components
// (CodeBlock / RequestExample / ResponseExample) plus the useCodeWrap
// composable. Consumers do `extends: ['@geist-nuxt/kit-api-docs']` (which in
// turn pulls in @geist-nuxt/core), or extend both explicitly.
const { resolve } = createResolver(import.meta.url)

export default defineNuxtConfig({
  extends: ['@geist-nuxt/core'],

  // Auto-import this layer's API-docs components with directory-name prefixing
  // (Nuxt default). Current files sit at the root, so names stay bare
  // (ApiDocsSection, CodeBlock…). See references/foundations/conventions.md.
  components: [{ path: resolve('./app/components'), pathPrefix: true }],
})
