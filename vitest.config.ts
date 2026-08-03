// Component tests run in the Nuxt runtime environment so auto-imports and
// Nuxt UI resolve exactly as they do in the app. Scope is limited to
// tests/component/ — the existing node --test scripts stay on `test:registry`.
import { defineVitestConfig } from '@nuxt/test-utils/config'

export default defineVitestConfig({
  test: {
    environment: 'nuxt',
    environmentOptions: {
      nuxt: {
        // Component assertions do not cover font delivery. Keep their Nuxt
        // bootstrap independent from remote provider discovery.
        overrides: { ui: { fonts: false } },
      },
    },
    // `@nuxt/test-utils` boots Nuxt in a file-level hook. Cold CI workers need
    // more than Vitest's 10-second default even when no remote providers run.
    hookTimeout: 30_000,
    include: ['tests/component/**/*.spec.ts'],
  },
})
