// Component tests run in the Nuxt runtime environment so auto-imports and
// Nuxt UI resolve exactly as they do in the app. Scope is limited to
// tests/component/ — the existing node --test scripts stay on `test:registry`.
import { defineVitestConfig } from '@nuxt/test-utils/config'

export default defineVitestConfig({
  test: {
    environment: 'nuxt',
    include: ['tests/component/**/*.spec.ts'],
  },
})
