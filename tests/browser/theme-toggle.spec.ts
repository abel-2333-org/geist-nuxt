import { writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { createPage } from '@nuxt/test-utils/e2e'
import { expect, test } from 'vitest'
import { artifacts, setupFunctionalTests, source } from './functional-support'
import type { Theme } from './functional-support'

await setupFunctionalTests()

for (const theme of ['light', 'dark'] as const) for (const width of [1440, 390]) {
  test(`${theme}/${width}: ThemeToggle resolves its name after SSR hydration and preserves keyboard preferences`, async () => {
    const page = await createPage('/kits/api-docs')
    const pageErrors: string[] = []
    const evidence: Record<string, unknown>[] = []
    let failure: string | undefined
    page.on('pageerror', error => pageErrors.push(String(error)))
    await page.context().tracing.start({ screenshots: true, snapshots: true })
    const button = page.locator('header').getByRole('button', { name: /^切换到[深浅]色模式$/ })
    const readState = () => page.evaluate(() => {
      const app = (window as any).useNuxtApp()
      const mode = app.$colorMode
      return { value: mode.value, preference: mode.preference, unknown: mode.unknown, hydrating: app.isHydrating }
    })
    async function assertMode(value: Theme, preference: Theme | 'system', step: string) {
      await expect.poll(readState, { timeout: 10_000 }).toEqual({ value, preference, unknown: false, hydrating: false })
      await expect.poll(() => page.locator('html').getAttribute('class')).toContain(value)
      await expect.poll(() => button.count()).toBe(1)
      const label = value === 'dark' ? '切换到浅色模式' : '切换到深色模式'
      await expect.poll(() => button.getAttribute('aria-label')).toBe(label)
      evidence.push({ step, state: await readState(), htmlClass: await page.locator('html').getAttribute('class'),
        label: await button.getAttribute('aria-label'), storedPreference: await page.evaluate(() => localStorage.getItem('nuxt-color-mode')) })
    }
    try {
      await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 })
      await page.emulateMedia({ colorScheme: theme })
      await page.evaluate(value => localStorage.setItem('nuxt-color-mode', value), theme)
      // Reload the SSR page with a browser-only preference. A client mount alone
      // cannot catch a stale server aria-label left behind during hydration.
      await page.reload()
      await assertMode(theme, theme, 'persisted preference after SSR hydration')
      const opposite = theme === 'light' ? 'dark' : 'light'
      await button.focus()
      await page.keyboard.press('Enter')
      await assertMode(opposite, opposite, 'Enter toggles preference')
      await page.reload()
      await assertMode(opposite, opposite, 'toggled preference survives SSR reload')
      await button.focus()
      await page.keyboard.press('Space')
      await assertMode(theme, theme, 'Space toggles preference')

      await page.emulateMedia({ colorScheme: 'dark' })
      await page.evaluate(() => localStorage.setItem('nuxt-color-mode', 'system'))
      await page.reload()
      await assertMode('dark', 'system', 'system resolves dark after SSR hydration')
      await page.emulateMedia({ colorScheme: 'light' })
      await assertMode('light', 'system', 'system follows media preference')
      await button.focus()
      await page.keyboard.press('Enter')
      await assertMode('dark', 'dark', 'keyboard chooses explicit preference from system')
      await page.emulateMedia({ colorScheme: 'dark' })
      await page.emulateMedia({ colorScheme: 'light' })
      await assertMode('dark', 'dark', 'explicit preference remains authoritative')
    } catch (error) {
      failure = String(error)
    } finally {
      const stem = `${theme}-${width}-theme-toggle-hydration`
      const browser = page.context().browser()?.version()
      await page.screenshot({ path: resolve(artifacts, `${stem}.png`) })
      await page.context().tracing.stop({ path: resolve(artifacts, `${stem}.zip`) })
      await page.context().close()
      await writeFile(resolve(artifacts, `${stem}.json`), JSON.stringify({
        source, browser, theme, width, route: '/kits/api-docs', kind: 'theme-toggle-behavior',
        pageErrors, failure, evidence,
      }, null, 2))
    }
    expect(failure, 'all SSR hydration and native keyboard states finish').toBeUndefined()
    expect(pageErrors, 'no runtime page errors').toEqual([])
  })
}
