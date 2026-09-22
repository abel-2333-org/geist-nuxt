import { expect, test } from 'vitest'
import type { Locator, Page } from 'playwright-core'
import { prepare, scenario, settle, setupFunctionalTests, snapshot } from './functional-support'

await setupFunctionalTests()
const responseRoot = '[class~="@container/response"]'
const methodBadge = '[data-slot="base"]'
const methodNames = /^(?:GET|POST|PUT|PATCH|DELETE)$/
// Source-backed page applicability, not a zero-node fallback. The directory page
// consumes every F1–F9 preset; endpoint-reference has the listed field semantics;
// webhook-reference exposes required fields and the payload's Beta lifecycle
// after its real disclosure opens. Missing required samples always fail.
const pageSamples: Record<string, ReadonlySet<string>> = {
  index: new Set(['F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8', 'F9', 'response-statusText', 'actual-page-alert']),
  'endpoint-reference': new Set(['F1', 'F2', 'F3', 'F4', 'F5', 'F5-field-caveat', 'F9']),
  'webhook-reference': new Set(['F1', 'F5']),
}

// Read available options from the real consumer, then select through its native
// wide select or compact popover. No fixture data is substituted for the page.
async function responseControl(page: Page, response: Locator, label: string) {
  const compact = response.locator('[data-response-compact-trigger]')
  const isCompact = await compact.isVisible()
  if (isCompact && await compact.getAttribute('data-state') !== 'open') await compact.click()
  const scope = isCompact ? page.locator('[data-reka-popper-content-wrapper] [data-slot="content"]').filter({ visible: true }) : response
  if (isCompact) { await scope.waitFor(); await settle(scope) }
  return { scope, isCompact, compact }
}
async function closeResponseControl(page: Page, response: Locator) {
  const compact = response.locator('[data-response-compact-trigger]')
  if (await compact.getAttribute('data-state') === 'open') {
    const popup = page.locator('[data-reka-popper-content-wrapper] [data-slot="content"]').filter({ visible: true })
    await page.keyboard.press('Escape')
    await expect.poll(() => compact.getAttribute('data-state')).toBe('closed')
    await popup.waitFor({ state: 'hidden' })
  }
}
async function readOptions(page: Page, response: Locator, label: string) {
  const { scope } = await responseControl(page, response, label)
  const select = scope.getByRole('combobox', { name: label, exact: true }).filter({ visible: true })
  let options: string[] = []
  if (await select.count()) {
    await select.click()
    const list = page.getByRole('listbox').filter({ visible: true })
    await list.waitFor(); await settle(list)
    options = (await list.getByRole('option').allTextContents()).map(text => text.trim())
    await page.keyboard.press('Escape'); await list.waitFor({ state: 'hidden' })
  } else {
    // The installed primitive puts its legend on the nested fieldset; the
    // outer radiogroup is intentionally unnamed. Use the native group name.
    const group = scope.getByRole('group', { name: label, exact: true })
    if (await group.count()) options = (await group.locator('[data-slot="label"]').allTextContents()).map(text => text.trim())
  }
  // Every multiple-choice dimension also has a wide USelect in the real
  // component, even when a container query hides it. It proves that a compact
  // lookup returning zero options is a test/UI failure, not a single-value case.
  const hasDimension = await response.getByRole('combobox', { name: label, exact: true, includeHidden: true }).count()
  if (hasDimension) expect(options.length, `${label}: existing control dimension must expose all selectable options`).toBeGreaterThan(1)
  expect(options.every(option => option.length > 0), `${label}: options must have accessible text`).toBe(true)
  await closeResponseControl(page, response)
  return options
}
async function chooseOption(page: Page, response: Locator, label: string, option: string) {
  const { scope } = await responseControl(page, response, label)
  const select = scope.getByRole('combobox', { name: label, exact: true }).filter({ visible: true })
  if (await select.count()) {
    await select.click()
    await page.getByRole('option', { name: option, exact: true }).click()
    await page.getByRole('listbox').waitFor({ state: 'hidden' })
  } else {
    const radio = scope.getByRole('group', { name: label, exact: true }).getByRole('radio', { name: option, exact: true })
    await radio.click()
    expect(await radio.getAttribute('aria-checked')).toBe('true')
  }
  await closeResponseControl(page, response)
  await settle(response)
}

for (const theme of ['light', 'dark'] as const) for (const width of [1440, 390]) {
  for (const name of ['index', 'endpoint-reference', 'webhook-reference']) {
    const route = name === 'index' ? '/kits/api-docs' : `/kits/api-docs/${name}`
    test(`${theme}/${width}: real ${name} F1–F9`, () => scenario(theme, width, `route-${name}`, async (page, capture, evidence) => {
      if (name === 'webhook-reference') await page.locator('#payload_data button[aria-expanded]').first().click()
      const meta = { surface: 'actual page layers', state: 'visible idle' }
      for (const [selector, id, role] of [
        ['[data-field-requiredness].text-error', 'F1', 'error'],
        ['[data-field-requiredness].text-warning', 'F2', 'warning'],
        ['[data-field-caveat] > span', 'F5-field-caveat', 'warning'],
        ['[data-value-caveat] > span', 'value-caveat', 'warning'],
      ]) {
        const targets = page.locator(selector!).filter({ visible: true })
        if (pageSamples[name]!.has(id!) || await targets.count()) await capture(targets, { ...meta, id, role })
        else evidence.push({ id, route, applicability: 'no corresponding field semantics in this page', matched: 0 })
      }
      for (const [id, role, text] of [
        ['F3', 'info', 'GET'], ['F4', 'success', 'POST|New|Active'], ['F5', 'warning', 'PUT|Beta|Maintenance'],
        ['F6', 'secondary', 'PATCH'], ['F7', 'error', 'DELETE'], ['F8', 'error', 'Sunsetting'],
      ]) {
        const target = page.locator('[data-slot="base"]').filter({ hasText: new RegExp(`^\\s*(?:${text})\\s*$`), visible: true })
        if (pageSamples[name]!.has(id!) || await target.count()) await capture(target, { ...meta, id, role })
        else evidence.push({ id, route, applicability: 'this preset is not consumed by this page', matched: 0 })
      }
      if (name === 'webhook-reference') {
        expect(await page.locator(responseRoot).count(), 'Webhook does not contain ResponseExample').toBe(0)
        evidence.push({ id: 'F9', route, applicability: 'not applicable', matched: 0,
          history: 'Stage 1 generic collector retained one unverified zero-node F9 row. Webhook HTTP status 200 belongs to a different documentation component and is not a replacement F9 sample.' })
      } else {
        await capture(page.locator(`${responseRoot} [data-slot="base"] > span.font-mono`).filter({ visible: true }), { ...meta, id: 'F9', component: 'ResponseExample', slot: 'status' })
        const text = page.locator(`${responseRoot} [data-slot="base"] > span.font-sans`).filter({ visible: true })
        if (pageSamples[name]!.has('response-statusText') || await text.count()) await capture(text, { ...meta, id: 'response-statusText', component: 'ResponseExample' })
      }
      const alert = page.locator('[data-slot="root"][data-orientation] [data-slot="title"], [data-slot="root"][data-orientation] [data-slot="description"]').filter({ visible: true })
      if (pageSamples[name]!.has('actual-page-alert') || await alert.count()) await capture(alert, { ...meta, id: 'actual-page-alert' })
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width)
    }, route))
  }

  for (const name of ['index', 'endpoint-reference']) {
    const route = name === 'index' ? '/kits/api-docs' : `/kits/api-docs/${name}`
    test(`${theme}/${width}: ${name} ResponseExample native scenario/status/media switching`, () => scenario(theme, width, `response-dynamic-${name}`, async (page, capture, evidence) => {
      const response = name === 'index'
        ? page.locator(responseRoot).filter({ has: page.locator('[data-response-compact-trigger][aria-label^="响应选项"]') })
        : page.locator(responseRoot)
      expect(await response.count()).toBe(1)
      const labels = name === 'index' ? ['场景', '状态', '媒体类型'] : ['Scenario', 'Status', 'Media type']
      const compact = response.locator('[data-response-compact-trigger]')
      if (width === 390) expect(await compact.isVisible(), '390px uses the real compact selector').toBe(true)
      const scenarios = await readOptions(page, response, labels[0]!)
      expect(scenarios.length, 'real page exposes business scenarios').toBeGreaterThan(1)
      for (const selectedScenario of scenarios) {
        await chooseOption(page, response, labels[0]!, selectedScenario)
        const statuses = await readOptions(page, response, labels[1]!)
        for (const selectedStatus of statuses.length ? statuses : [null]) {
          if (selectedStatus) await chooseOption(page, response, labels[1]!, selectedStatus)
          const bodies = await readOptions(page, response, labels[2]!)
          for (const selectedBody of bodies.length ? bodies : [null]) {
            if (selectedBody) await chooseOption(page, response, labels[2]!, selectedBody)
            const badge = response.locator('[data-slot="base"] > span.font-mono')
            const actualStatus = (await badge.textContent())?.trim()
            if (selectedStatus) expect(selectedStatus.startsWith(actualStatus!)).toBe(true)
            const meta = { id: 'F9', component: 'ResponseExample', state: 'native selection', scenario: selectedScenario, selectedStatus, selectedBody, compact: await compact.isVisible() }
            await capture(badge, { ...meta, slot: 'status' })
            const text = response.locator('[data-slot="base"] > span.font-sans')
            if (await text.count()) await capture(text, { ...meta, slot: 'statusText' })
            evidence.push({ ...meta, actualStatus, announcement: await response.locator('[data-response-announcement]').textContent() })
          }
        }
      }
      // Returning to the first real scenario proves the controls remain usable
      // after empty/unavailable/file panels and body cardinality changes.
      await chooseOption(page, response, labels[0]!, scenarios[0]!)
      await capture(response.locator('[data-slot="base"] > span.font-mono'), { id: 'F9', state: 'restored initial scenario' })
    }, route))
  }

  test(`${theme}/${width}: Sidebar and SiteSearch real method badge states`, () => scenario(theme, width, 'navigation', async (page, capture, evidence) => {
    async function openNavigation() {
      if (width === 390) await page.getByRole('button', { name: '打开文档导航', exact: true }).click()
      const nav = page.getByRole('navigation', { name: '支付文档', exact: true }).filter({ visible: true })
      await nav.waitFor(); await settle(nav)
      const closed = nav.locator('button[class~="group/sec"][aria-expanded="false"]')
      while (await closed.count()) { await closed.first().click(); await settle(nav) }
      return nav
    }
    let nav = await openNavigation()
    const badges = nav.locator(methodBadge).filter({ hasText: methodNames, visible: true })
    expect(await badges.count()).toBeGreaterThan(0)
    for (let index = 0; index < await badges.count(); index++) {
      const badge = badges.nth(index)
      const row = badge.locator('xpath=ancestor::li[1]')
      const link = row.locator(':scope > a')
      await page.mouse.move(0, 0); await settle(row)
      await capture(badge, { component: 'SidebarNav', state: 'idle', index })
      await link.hover(); await settle(row)
      expect(await link.evaluate(element => element.matches(':hover'))).toBe(true)
      await capture(badge, { component: 'SidebarNav', state: 'hover', index, link: await snapshot(link) })
    }
    const first = badges.first().locator('xpath=ancestor::li[1]').locator(':scope > a')
    const destination = await first.getAttribute('href')
    await first.click()
    await expect.poll(() => new URL(page.url()).pathname + new URL(page.url()).hash).toBe(destination)
    if (width === 390) nav = await openNavigation()
    const activeRow = nav.locator('li').filter({ has: page.locator(':scope > a[aria-current="page"]') })
    const activeBadges = activeRow.locator(methodBadge).filter({ hasText: methodNames, visible: true })
    expect(await activeBadges.count()).toBeGreaterThan(0)
    await page.mouse.move(0, 0); await settle(nav)
    await capture(activeBadges, { component: 'SidebarNav', state: 'route-active' })
    if (width === 390) await page.keyboard.press('Escape')
    for (const route of ['/kits/api-docs/docs-shell/payments', '/kits/api-docs/docs-shell/payments/quickstart']) {
      await page.goto(new URL(route, page.url()).href); await prepare(page, theme, width)
      await page.getByRole('button', { name: '搜索全部文档', exact: true }).click()
      const dialog = page.getByRole('dialog', { name: '搜索全部文档', exact: true })
      await dialog.waitFor(); await settle(dialog)
      const results = dialog.getByRole('option').filter({ has: page.locator('[data-slot="base"]').filter({ hasText: methodNames }) })
      expect(await results.count()).toBeGreaterThan(0)
      for (let index = 0; index < await results.count(); index++) {
        const result = results.nth(index)
        const badge = result.locator(methodBadge).filter({ hasText: methodNames })
        const href = await result.getAttribute('href')
        const routeState = new URL(href!, page.url()).pathname === new URL(page.url()).pathname ? 'route-active' : 'route-inactive'
        await capture(badge, { component: 'SiteSearch', state: 'visible', routeState, index, result: await snapshot(result) })
        await result.hover(); await settle(result)
        expect(await result.evaluate(element => element.matches(':hover'))).toBe(true)
        await capture(badge, { component: 'SiteSearch', state: 'hover', routeState, index, result: await snapshot(result) })
      }
      await page.mouse.move(0, 0)
      const search = dialog.getByPlaceholder('搜索指南与接口…', { exact: true })
      await search.click()
      // Traverse actual palette options, measuring every functional method row
      // when Reka marks it keyboard-highlighted. Selected route remains separate.
      const total = await dialog.getByRole('option').count(), seen = new Set<string>()
      for (let step = 0; step < total + 1; step++) {
        await page.keyboard.press('ArrowDown')
        const highlighted = dialog.getByRole('option').filter({ has: page.locator('[data-slot="base"]').filter({ hasText: methodNames }) }).locator('xpath=self::*[@data-highlighted]')
        if (!await highlighted.count()) continue
        const id = await highlighted.getAttribute('id')
        if (seen.has(id!)) continue
        seen.add(id!)
        await settle(highlighted)
        const href = await highlighted.getAttribute('href')
        const routeState = new URL(href!, page.url()).pathname === new URL(page.url()).pathname ? 'route-active' : 'route-inactive'
        await capture(highlighted.locator(methodBadge).filter({ hasText: methodNames }), { component: 'SiteSearch', state: 'keyboard-highlighted', routeState, result: await snapshot(highlighted) })
      }
      expect(seen.size, 'all rendered method results receive real keyboard highlight').toBe(await results.count())
      evidence.push({ component: 'SiteSearch', route, measuredHighlightedMethodRows: seen.size })
      await page.keyboard.press('Escape'); await dialog.waitFor({ state: 'hidden' })
    }
  }, '/kits/api-docs/docs-shell/payments/quickstart'))
}
