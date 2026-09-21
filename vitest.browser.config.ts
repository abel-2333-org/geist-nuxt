import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

// Deliberately independent from the Nuxt runtime component-test project.
// Nuxt E2E owns Chromium; Vitest itself runs in Node, not Browser Mode.
export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  test: {
    name: 'browser-e2e',
    environment: 'node',
    environmentOptions: {},
    include: ['tests/browser/**/*.spec.ts'],
    setupFiles: [],
    globalSetup: [],
    isolate: true,
    fileParallelism: false,
    passWithNoTests: false,
    reporters: ['verbose'],
    testTimeout: 120_000,
    hookTimeout: 120_000,
    browser: { enabled: false },
  },
})
