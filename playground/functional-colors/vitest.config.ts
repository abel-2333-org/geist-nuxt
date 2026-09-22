import { defineConfig } from 'vitest/config'
import browserConfig from '../../vitest.browser.config'
// Reuse the existing Node/Chromium runner settings; run this audit explicitly.
// Array-merging include would accidentally launch the separate #148 suite.
export default defineConfig({
  ...browserConfig,
  test: { ...browserConfig.test, include: ['playground/functional-colors/audit.spec.ts'], testTimeout: 1200000 },
})
