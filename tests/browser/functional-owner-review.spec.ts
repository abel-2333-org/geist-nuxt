import { resolve } from 'node:path'
import { expect, test } from 'vitest'
import type { Locator } from 'playwright-core'
import { artifacts, scenario, settle, setupFunctionalTests, snapshot } from './functional-support'
import type { Capture } from './functional-support'

await setupFunctionalTests()

// Only OperationHeader's own anatomy is selected: its trailing default slot
// can contain an OperationTarget with additional code nodes and controls.
async function captureHeader(header: Locator, capture: Capture, identity: string, heading: 'h2' | 'h4') {
  expect(await header.count()).toBe(1)
  const meta = { component: 'OperationHeader', identity, state: 'visible', surface: 'actual component layers' }
  await capture(header.locator(':scope > div').first().locator(':scope > [data-slot="base"]'), { ...meta, slot: 'kind badge' })
  await capture(header.locator(':scope > div').first().locator(':scope > code'), { ...meta, slot: 'identifier' })
  await capture(header.locator(`:scope > div > ${heading}`), { ...meta, slot: 'summary' })
  await capture(header.locator(':scope > div.max-w-prose'), { ...meta, slot: 'description' })
  const lifecycle = header.locator(':scope > div').nth(1).locator(':scope > [data-slot="base"]')
  if (identity === 'gallery-webhook') expect(await lifecycle.count()).toBe(0)
  else await capture(lifecycle, { ...meta, slot: 'lifecycle badge' })
}

for (const theme of ['light', 'dark'] as const) for (const width of [1440, 390]) {
  test(`${theme}/${width}: SiteSearch PUT route and native interaction states`, () => scenario(theme, width, 'owner-search-put', async (page, capture, evidence) => {
    await page.getByRole('button', { name: 'Search docs', exact: true }).click()
    const dialog = page.getByRole('dialog', { name: 'Search documentation', exact: true })
    await dialog.waitFor(); await settle(dialog)
    const options = dialog.getByRole('option')
    expect(await options.count()).toBe(2)
    const observedRoutes = new Set<string>()
    async function captureOption(option: Locator, state: string) {
      const href = await option.getAttribute('href')
      expect(href).toBeTruthy()
      const routeState = new URL(href!, page.url()).pathname === new URL(page.url()).pathname ? 'route-active' : 'route-inactive'
      observedRoutes.add(routeState)
      const result = await snapshot(option)
      if (state === 'hover') expect(result.hover).toBe(true)
      if (state === 'keyboard-highlighted') expect(result.highlighted).toBe(true)
      const badge = option.locator('[data-slot="base"]').filter({ hasText: /^PUT$/ })
      expect(await badge.count()).toBe(1)
      await capture(badge, { component: 'SiteSearch', method: 'PUT', state, routeState, result })
      await page.screenshot({ path: resolve(artifacts, `${theme}-${width}-owner-put-${routeState}-${state}.png`) })
    }
    for (let index = 0; index < await options.count(); index++) {
      const option = options.nth(index)
      await page.mouse.move(0, 0); await settle(option)
      await captureOption(option, 'visible')
      await option.hover(); await settle(option)
      await captureOption(option, 'hover')
    }
    await page.mouse.move(0, 0)
    await dialog.getByPlaceholder('Search guides and endpoints…', { exact: true }).click()
    const seen = new Set<string>()
    for (let step = 0; step < await options.count() + 1; step++) {
      await page.keyboard.press('ArrowDown')
      const highlighted = dialog.locator('[role="option"][data-highlighted]')
      expect(await highlighted.count()).toBe(1)
      const href = await highlighted.getAttribute('href')
      if (seen.has(href!)) continue
      seen.add(href!)
      await settle(highlighted)
      await captureOption(highlighted, 'keyboard-highlighted')
    }
    expect([...observedRoutes].sort()).toEqual(['route-active', 'route-inactive'])
    expect(seen.size).toBe(await options.count())
    evidence.push({ component: 'SiteSearch', measuredKeyboardDestinations: [...seen],
      selection: 'ariaSelected and highlighted are observed independently; no synthetic selected attribute is injected' })
    await page.keyboard.press('Escape'); await dialog.waitFor({ state: 'hidden' })
  }, '/__functional-contrast?case=owner-review'))

  test(`${theme}/${width}: OperationHeader remaining default branches`, () => scenario(theme, width, 'owner-operation-presets', async (page, capture) => {
    for (const method of ['GET', 'PUT', 'PATCH', 'DELETE']) {
      await captureHeader(page.locator(`[data-operation="${method}"]`), capture, method, 'h2')
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width)
  }, '/__functional-contrast?case=owner-review'))

  test(`${theme}/${width}: existing endpoint and webhook OperationHeader anatomy`, () => scenario(theme, width, 'owner-operation-gallery', async (page, capture) => {
    for (const [summary, identity] of [['创建结算会话', 'gallery-endpoint'], ['支付成功', 'gallery-webhook']] as const) {
      const header = page.locator('header').filter({ has: page.getByRole('heading', { level: 4, name: summary, exact: true }) })
      await captureHeader(header, capture, identity, 'h4')
    }
  }, '/kits/api-docs'))
}
