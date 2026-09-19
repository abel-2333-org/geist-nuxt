import { readFile, mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { setup, createPage } from '@nuxt/test-utils/e2e'
import { expect, test } from 'vitest'
import type { Page, Locator } from 'playwright-core'
import { contrastSource } from '../../scripts/lib/contrast-build.mjs'
import { measure } from './measure'

const root = fileURLToPath(new URL('../..', import.meta.url))
const output = resolve(root, '.output/contrast')
const artifacts = process.env.GEIST_CONTRAST_ARTIFACTS || resolve(root, '.output/contrast-artifacts')
const source = JSON.parse(await readFile(resolve(output, 'source.json'), 'utf8'))
const current = await contrastSource(root)
if (source.digest !== current.digest || source.sha !== current.sha) throw new Error('Stale contrast build. Run pnpm build:contrast from the current source first.')
await readFile(resolve(output, 'server/index.mjs'))
await mkdir(artifacts, { recursive: true })
await setup({
  rootDir: root, runner: 'vitest', dev: false, build: false, server: true, browser: true,
  browserOptions: { type: 'chromium', launch: { channel: 'chromium' } },
  nuxtConfig: { nitro: { output: { dir: output } } },
  setupTimeout: 120_000, serverStartTimeout: 60_000, teardownTimeout: 30_000,
})

type Theme = 'light' | 'dark'
type Check = (target: Locator, id: string, owner: string, state?: string, pseudo?: '::placeholder') => Promise<any[]>
const settle = (page: Page) => page.waitForTimeout(300)

async function scenario(theme: Theme, id: string, run: (page: Page, check: Check) => Promise<void>, route = '/__contrast') {
  expect(typeof window).toBe('undefined')
  const page = await createPage(route)
  const records: any[] = []
  let platformFonts: unknown
  let failure: string | undefined
  await page.context().tracing.start({ screenshots: true, snapshots: true })
  try {
    await page.setViewportSize({ width: 1440, height: 1000 })
    await page.evaluate((theme) => { (window as any).useNuxtApp().$colorMode.preference = theme }, theme)
    await expect.poll(() => page.locator('html').getAttribute('class')).toContain(theme)
    await page.evaluate(() => document.fonts.ready)
    await settle(page)
    const cdp = await page.context().newCDPSession(page)
    await cdp.send('DOM.enable'); await cdp.send('CSS.enable')
    const documentNode = await cdp.send('DOM.getDocument')
    const fontNode = await cdp.send('DOM.querySelector', { nodeId: documentNode.root.nodeId, selector: '[data-token], [data-field-type]' })
    platformFonts = await cdp.send('CSS.getPlatformFontsForNode', { nodeId: fontNode.nodeId })
    expect((platformFonts as any).fonts.some((f: any) => f.isCustomFont && f.familyName.includes('Geist')), 'actual rendered Geist font').toBe(true)
    await cdp.detach()
    const check: Check = async (target, name, owner, state = 'idle', pseudo) => {
      const start = records.length
      const count = await target.count()
      expect(count, `${name}: required nonempty selector`).toBeGreaterThan(0)
      for (let i = 0; i < count; i++) {
        const node = target.nth(i)
        await node.scrollIntoViewIfNeeded()
        const result = await measure(node, pseudo || null)
        records.push({ id: name, owner, route, theme, state, index: i, ...result })
        expect(result.ratio, `${theme}/${name}/${state}: ${result.ratio} < 4.5`).toBeGreaterThanOrEqual(4.5)
      }
      return records.slice(start)
    }
    await run(page, check)
    expect(records.length, 'scenario must measure real nodes').toBeGreaterThan(0)
  }
  catch (error) { failure = String(error); throw error }
  finally {
    const fonts = await page.evaluate(() => Array.from(document.fonts).map(f => ({ family: f.family, status: f.status })))
    const regions: Record<string, string> = { matrix: 'token-matrix', containers: 'container-variants', forms: 'form-variants', docs: 'documentation-states', paint: 'documentation-states' }
    if (regions[id]) await page.getByTestId(regions[id]!).screenshot({ path: resolve(artifacts, `${theme}-${id}-detail.png`) })
    await page.screenshot({ path: resolve(artifacts, `${theme}-${id}.png`), fullPage: true })
    await writeFile(resolve(artifacts, `${theme}-${id}.json`), JSON.stringify({ source, browser: page.context().browser()?.version(), fonts, platformFonts, failure, records }, null, 2))
    await page.context().tracing.stop({ path: resolve(artifacts, `${theme}-${id}.zip`) })
    await page.context().close()
  }
}

for (const theme of ['light', 'dark'] as const) {
  for (const name of ['endpoint-reference', 'webhook-reference', 'index']) {
    const route = name === 'index' ? '/kits/api-docs' : `/kits/api-docs/${name}`
    test(`${theme}: gallery ${name} neutral metadata`, () => scenario(theme, `gallery-${name}`, async (page, check) => {
      if (name === 'webhook-reference') {
        await page.locator('#payload_data button[aria-expanded]').first().click()
        await settle(page)
      }
      await check(page.locator('[data-field-type]').filter({ visible: true }), 'field type and shape wire type', 'kits/api-docs/components/FieldItem.vue')
      await check(page.locator('span.font-mono.text-xs.text-dimmed.tabular-nums').filter({ visible: true }), 'FieldGroup count', 'kits/api-docs/components/FieldGroup.vue')
      await check(page.locator('dt.text-dimmed').filter({ visible: true }), 'Constraint/Since metadata', 'kits/api-docs/components/FieldItem.vue')
      if (name !== 'index') await check(page.locator('p').filter({ hasText: 'name?' }), 'page notation legend', `app/pages/kits/api-docs/${name}.vue`)
      const optional = page.locator('[data-field-optional]').filter({ visible: true }).first()
      await optional.hover(); await settle(page)
      await check(optional, 'optional notation', 'kits/api-docs/components/FieldItem.vue', 'hover')
      await page.keyboard.press('Escape')
      await optional.focus(); await settle(page)
      await check(optional, 'optional notation', 'kits/api-docs/components/FieldItem.vue', 'focus')
      await page.keyboard.press('Escape')
      await optional.blur(); await page.mouse.move(0, 0)
      // Capture the final page with the real downloaded font and all core fixes.
      await page.setViewportSize({ width: 390, height: 844 }); await settle(page)
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
      await page.screenshot({ path: resolve(artifacts, `${theme}-gallery-${name}-mobile.png`), fullPage: true })
      await page.setViewportSize({ width: 1440, height: 1000 }); await settle(page)
    }, route))
  }

  test(`${theme}: detector catches each old alpha independently`, () => scenario(theme, 'negative-alpha', async (page, check) => {
    const cases = [
      { id: 'FieldItem count', selector: '[data-testid="field-count"] p > span', variable: '--ui-text-dimmed', alpha: '70%', hover: false },
      { id: 'EnumTable count', selector: '[data-testid="enum-count"] p > span', variable: '--ui-text-dimmed', alpha: '70%', hover: false },
      { id: 'field-expand/verb', selector: '[data-testid="field-expand"] button[aria-expanded]', variable: '--ui-primary', alpha: '75%', hover: true },
      { id: 'value-expand/verb', selector: '[data-testid="value-expand"] [data-value-structure-toggle]', variable: '--ui-primary', alpha: '75%', hover: true },
    ]
    for (const [index, item] of cases.entries()) {
      const node = page.locator(item.selector)
      const label = item.hover ? node.locator('span').filter({ hasText: /Show|Hide/ }) : node
      await check(label, `${item.id} before mutation`, 'detector positive control')
      // This is the generated declaration of the original Tailwind alpha
      // utility. Inject the declaration, not a class that may be tree-shaken.
      const style = await page.addStyleTag({ content: `${item.selector}${item.hover ? ':hover' : ''} { color: color-mix(in oklab, var(${item.variable}) ${item.alpha}, transparent) !important; }` })
      if (item.hover) await node.hover()
      await settle(page)
      const result = await measure(label)
      expect(result.foreground[3], `${item.id}: mutation changed alpha`).toBeCloseTo(item.hover ? 0.75 : 0.7, 5)
      expect(result.ratio, `${item.id}: detector must catch old alpha`).toBeLessThan(4.5)
      await writeFile(resolve(artifacts, `${theme}-negative-alpha-${index}.json`), JSON.stringify({ source, id: item.id, classification: 'expected detector failure; not a positive suite red run', ...result }, null, 2))
      await style.evaluate(el => el.parentNode!.removeChild(el))
      await page.mouse.move(0, 0); await settle(page)
      await check(label, `${item.id} restored`, 'detector positive control')
    }
  }))

  test(`${theme}: unresolved paint fails closed`, () => scenario(theme, 'unresolved', async (page, check) => {
    const target = page.locator('[data-token="dimmed"][data-surface="default"]')
    await check(target, 'baseline', 'measurement contract')
    await target.evaluate(el => { (el as HTMLElement).style.backgroundImage = 'linear-gradient(white, black)' })
    await expect(measure(target)).rejects.toThrow(/unresolved: unsupported paint/)
    await target.evaluate(el => { (el as HTMLElement).style.backgroundImage = '' })
    await page.getByTestId('tabs-pill').getByRole('tab').first().click()
    await settle(page)
    const activeLabel = page.getByTestId('tabs-pill').locator('[role="tab"][data-state="active"] [data-slot="label"]')
    await page.addStyleTag({ content: '[data-testid="tabs-pill"] [data-slot="indicator"]::before { content: ""; position: absolute; inset: 0; background: black; }' })
    await expect(measure(activeLabel)).rejects.toThrow(/unresolved: unmodeled ::before/)
    await target.evaluate(el => { el.textContent = '' })
    await expect(measure(target)).rejects.toThrow(/unresolved: empty or hidden/)
  }))
}

for (const theme of ['light', 'dark'] as const) {
  test(`${theme}: complete neutral matrix`, () => scenario(theme, 'matrix', async (page, check) => {
    const nodes = page.locator('[data-token][data-surface]')
    expect(await nodes.count()).toBe(20)
    const combinations = await nodes.evaluateAll(nodes => nodes.map(n => `${n.getAttribute('data-token')}/${n.getAttribute('data-surface')}`))
    expect(new Set(combinations).size).toBe(20)
    await check(nodes, '5×4 neutral pairs', 'foundation/assets/css/main.css')
  }))

  test(`${theme}: solid slots and non-solid variants`, () => scenario(theme, 'containers', async (page, check) => {
    const wrappers = page.locator('[data-contrast-slots]')
    expect(await wrappers.count()).toBeGreaterThan(0)
    for (const wrapper of await wrappers.all()) {
      const id = (await wrapper.getAttribute('data-testid'))!
      const slots = (await wrapper.getAttribute('data-contrast-slots'))!.split(' ')
      const variant = await wrapper.getAttribute('data-contrast-variant')
      const component = await wrapper.getAttribute('data-contrast-component')
      for (const slot of slots) {
        const node = wrapper.locator(`[data-slot="${slot}"]`)
        const role = variant === 'solid' ? 'inverted'
          : component === 'PricingPlan' ? (slot === 'tagline' ? 'default' : slot === 'billingPeriod' ? 'toned' : 'muted')
            : component !== 'Card' && ['soft', 'subtle'].includes(variant!) ? 'toned' : 'muted'
        for (const element of await node.all()) expect(await element.getAttribute('class'), `${id}/${slot} semantic role`).toContain(`text-${role}`)
        await check(node, `${id}/${slot}`, 'foundation/config/app.ts')
      }
      if (id.startsWith('page-card-')) {
        const link = wrapper.locator('a')
        await wrapper.hover(); await settle(page)
        await check(wrapper.locator('[data-slot="description"]'), `${id}/description`, 'foundation/config/app.ts', 'hover')
        await page.mouse.move(0, 0); await link.focus(); await settle(page)
        await check(wrapper.locator('[data-slot="description"]'), `${id}/description`, 'foundation/config/app.ts', 'focus')
        await page.mouse.move(0, 0)
      }
    }
  }))

  test(`${theme}: placeholders readonly and form descriptions`, () => scenario(theme, 'forms', async (page, check) => {
    for (const variant of ['outline', 'soft', 'subtle', 'ghost', 'none']) {
      for (const component of ['input', 'textarea', 'input-menu']) {
        const node = page.getByTestId(`${component}-${variant}`).locator('input, textarea')
        for (const state of ['idle', 'hover', 'focus']) {
          if (state === 'hover') await node.hover()
          if (state === 'focus') await node.focus()
          await settle(page)
          await check(node, `${component}-${variant}/placeholder`, 'Nuxt UI input/textareas theme + foundation CSS', state, '::placeholder')
        }
        if (component === 'input-menu') {
          await node.press('ArrowDown'); await settle(page)
          await check(page.locator('[role="option"] [data-slot="itemLabel"]'), `input-menu-${variant}/options`, 'Nuxt UI InputMenu portal', 'open')
        }
        await page.keyboard.press('Escape'); await node.blur(); await page.mouse.move(0, 0)
      }
      for (const component of ['input', 'textarea']) await check(page.getByTestId(`${component}-readonly-${variant}`).locator('input, textarea'), `${component}-${variant}/readonly`, 'foundation/assets/css/main.css')
      for (const component of ['select', 'select-menu']) {
        const wrapper = page.getByTestId(`${component}-${variant}`)
        await check(wrapper.locator('[data-slot="placeholder"]'), `${component}-${variant}/placeholder`, 'foundation/assets/css/main.css')
        await wrapper.locator('button').first().click(); await settle(page)
        const options = page.locator('[role="option"] [data-slot="itemLabel"]')
        await check(options, `${component}-${variant}/options`, 'Nuxt UI Select/SelectMenu portal', 'open')
        const search = page.locator('[role="dialog"] input, [data-slot="content"] input').filter({ visible: true })
        if (component === 'select-menu') await check(search, `${component}-${variant}/search`, 'Nuxt UI SelectMenu portal', 'open', '::placeholder')
        await page.keyboard.press('Escape'); await settle(page)
      }
    }
    for (const kind of ['props', 'slots']) for (const slot of ['description', 'hint', 'help']) await check(page.getByTestId(`form-field-${kind}`).locator(`[data-slot="${slot}"]`), `FormField-${kind}/${slot}`, 'Nuxt UI FormField + foundation CSS')
    await check(page.getByTestId('alert-neutral').locator('[data-slot="description"]'), 'Alert-neutral/description', 'Nuxt UI neutral Alert retains opacity-90')
    for (const name of ['input', 'textarea']) {
      const control = page.getByTestId(`disabled-${name}`).locator(name)
      expect(await control.isDisabled(), 'exception requires a native disabled control').toBe(true)
      const result = await measure(control, '::placeholder')
      await writeFile(resolve(artifacts, `${theme}-disabled-${name}.json`), JSON.stringify({ source, classification: 'native disabled exception; not normal-text acceptance', ...result }, null, 2))
    }
  }))

  test(`${theme}: both count and expand owners`, () => scenario(theme, 'docs', async (page, check) => {
    await check(page.getByTestId('field-count').locator('p > span').filter({ hasText: '(2)' }), 'FieldItem count', 'kits/api-docs/components/FieldItem.vue')
    await check(page.getByTestId('enum-count').locator('p > span').filter({ hasText: '(2)' }), 'EnumTable count', 'kits/api-docs/components/EnumTable.vue')
    for (const [id, selector, owner] of [
      ['field-expand', 'button[aria-expanded]', 'kits/api-docs/components/FieldItem.vue'],
      ['value-expand', '[data-value-structure-toggle]', 'kits/api-docs/internal/FieldValueStructure.vue'],
    ]) {
      const button = page.getByTestId(id!).locator(selector!)
      const label = button.locator('span').filter({ hasText: /Show|Hide/ })
      await check(label, `${id}/verb`, owner!)
      await button.hover(); await settle(page)
      await check(label, `${id}/verb`, owner!, 'hover')
      await button.click(); await settle(page)
      await check(label, `${id}/verb`, owner!, 'expanded-hover')
    }
  }))

  test(`${theme}: selected indicator and arrival paint`, () => scenario(theme, 'paint', async (page, check) => {
    for (const variant of ['pill', 'link']) {
      const tabs = page.getByTestId(`tabs-${variant}`)
      for (const index of [0, 1]) {
        const tab = tabs.getByRole('tab').nth(index)
        await tab.click(); await tab.focus(); await settle(page)
        await expect.poll(() => tab.getAttribute('data-state')).toBe('active')
        const indicator = tabs.locator('[data-slot="indicator"]')
        expect(await indicator.count()).toBe(1)
        const paint = await indicator.evaluate(el => {
          const style = getComputedStyle(el)
          const box = el.getBoundingClientRect()
          const label = el.parentElement!.querySelector('[role="tab"][data-state="active"] [data-slot="label"]')!.getBoundingClientRect()
          const probe = document.createElement('span')
          probe.style.color = `color(from ${style.backgroundColor} srgb r g b / alpha)`
          el.append(probe)
          const normalizedColor = getComputedStyle(probe).color
          probe.remove()
          const match = /^color\(srgb [\d.e+-]+ [\d.e+-]+ [\d.e+-]+(?: \/ ([\d.e+-]+))?\)$/.exec(normalizedColor)
          if (!match) throw new Error('indicator color alpha unresolved')
          const alpha = match[1] === undefined ? 1 : Number(match[1])
          return { box: box.toJSON(), label: label.toJSON(), color: style.backgroundColor, normalizedColor, alpha, opacity: Number(style.opacity), overlaps: box.left < label.right && box.right > label.left && box.top < label.bottom && box.bottom > label.top }
        })
        expect(paint.box.width).toBeGreaterThan(0); expect(paint.box.height).toBeGreaterThan(0)
        expect(paint.opacity).toBe(1); expect(paint.alpha).toBe(1)
        expect(paint.overlaps).toBe(variant === 'pill')
        await writeFile(resolve(artifacts, `${theme}-tabs-${variant}-${index}.json`), JSON.stringify({ source, ...paint }, null, 2))
        const measured = await check(tabs.getByRole('tab').locator('[data-slot="label"]'), `Tabs-${variant}/labels`, 'Nuxt UI Tabs sibling indicator', `selected-${index}-focus`)
        expect(measured.some(row => row.layers.some((layer: any) => layer.underlays.some((underlay: any) => underlay.kind === 'tabs-indicator')))).toBe(variant === 'pill')
      }
    }
    const arrival = page.getByTestId('field-arrival')
    await check(arrival.locator('[data-field-type]'), 'arrival/type', 'FieldItem + useFieldAnchor', 'stable')
    await page.getByTestId('field-arrival-trigger').click()
    await expect.poll(() => arrival.locator('[data-field-arrival-cue]').evaluate(el => el.getAnimations().length)).toBeGreaterThan(0)
    const peak = await arrival.locator('[data-field-arrival-cue]').evaluate(async el => {
      const animation = el.getAnimations()[0]!
      const effect = animation.effect as KeyframeEffect
      const frame = effect.getKeyframes().find(f => Number(f.opacity) === 1)!
      if (!frame) throw new Error('arrival has no opacity peak')
      animation.pause()
      await animation.ready
      // Global easing remaps timeline time before keyframe interpolation.
      // Invert the browser's computed progress, preserving the real easing.
      let low = 0
      let high = Number(effect.getTiming().duration)
      for (let i = 0; i < 48; i++) {
        animation.currentTime = (low + high) / 2
        const progress = effect.getComputedTiming().progress
        if (progress == null) throw new Error('arrival progress unresolved')
        if (progress < frame.computedOffset) low = Number(animation.currentTime)
        else high = Number(animation.currentTime)
      }
      animation.currentTime = (low + high) / 2
      await new Promise(requestAnimationFrame)
      return { frames: effect.getKeyframes(), timing: effect.getTiming(), progress: effect.getComputedTiming().progress, time: animation.currentTime, opacity: getComputedStyle(el).opacity }
    })
    expect(Number(peak.opacity)).toBeCloseTo(1, 5)
    await writeFile(resolve(artifacts, `${theme}-arrival-animation.json`), JSON.stringify(peak, null, 2))
    const peakRows = await check(arrival.locator('[data-field-type]'), 'arrival/type', 'FieldItem + useFieldAnchor', 'animation-peak')
    expect(peakRows.every(row => row.layers.some((layer: any) => layer.underlays.some((underlay: any) => underlay.kind === 'arrival-cue')))).toBe(true)
  }))

  test(`${theme}: open portals`, () => scenario(theme, 'portals', async (page, check) => {
    for (const kind of ['modal', 'slideover', 'popover', 'tooltip', 'dropdown']) {
      const trigger = page.getByTestId(`${kind}-trigger`)
      if (kind === 'tooltip') await trigger.hover()
      else await trigger.click()
      const content = page.locator(`.contrast-${kind}-content`).filter({ visible: true })
      await content.waitFor({ state: 'visible' }); await settle(page)
      const selectors: Record<string, string> = { modal: '[data-slot="description"]', slideover: '[data-slot="description"]', popover: '[data-contrast-slot="popover-description"]', tooltip: '[data-slot="text"]', dropdown: '[data-slot="itemDescription"]' }
      await check(content.locator(selectors[kind]!), `${kind}/description`, `Nuxt UI ${kind} portal`, 'open')
      await content.screenshot({ path: resolve(artifacts, `${theme}-portal-${kind}.png`) })
      await page.keyboard.press('Escape'); await page.mouse.move(0, 0); await settle(page)
    }
  }))
}
