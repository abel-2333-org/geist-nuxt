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
type Check = (target: Locator, id: string, owner: string, state?: string, pseudo?: '::placeholder', surface?: string) => Promise<any[]>
const settle = (page: Page) => page.waitForTimeout(300)
const documentationSurfaces = ['default', 'muted', 'elevated', 'accented'] as const

async function selectDocumentationSurface(page: Page, theme: Theme, surface: string) {
  const url = new URL(page.url())
  if (surface === 'default') url.searchParams.delete('docsSurface')
  else url.searchParams.set('docsSurface', surface)
  await page.goto(url.href)
  await page.evaluate(theme => { (window as any).useNuxtApp().$colorMode.preference = theme }, theme)
  await expect.poll(() => page.locator('html').getAttribute('class')).toContain(theme)
  await page.evaluate(() => document.fonts.ready)
  await expect.poll(() => page.getByTestId('documentation-states').getAttribute('data-expand-surface')).toBe(surface)
  await page.mouse.move(0, 0)
}

async function optionalTooltipReady(page: Page, trigger: Locator, artifact: string) {
  // Opening is delayed independently of the pointer action. A fixed delay can
  // finish before scale-in starts, so measure the actual settled open state.
  await expect.poll(() => trigger.getAttribute('data-state')).toMatch(/^(delayed|instant)-open$/)
  const tooltip = page.locator('[data-reka-popper-content-wrapper] [data-slot="content"][data-side="top"]')
    .filter({ has: page.locator('[data-slot="text"]'), visible: true })
  await tooltip.waitFor({ state: 'visible' })
  expect(await tooltip.count(), 'the optional trigger opens one actual Tooltip').toBe(1)
  const label = await trigger.getAttribute('aria-label')
  expect(label, 'the optional trigger has its accessible label').toBeTruthy()
  expect(await tooltip.locator('[data-slot="text"]').textContent()).toBe(label)
  const describe = async () => ({
    ...await tooltip.evaluate((node) => {
      const css = getComputedStyle(node)
      return {
        pendingAnimations: node.getAnimations({ subtree: true }).filter(animation => animation.pending || animation.playState === 'running').length,
        opacity: css.opacity, transform: css.transform,
      }
    }),
    // The trigger's focus colors transition independently of the popup.
    triggerPendingAnimations: await trigger.evaluate(node => node.getAnimations({ subtree: true })
      .filter(animation => animation.pending || animation.playState === 'running').length),
  })
  await expect.poll(describe, { timeout: 5_000 }).toEqual({ pendingAnimations: 0, opacity: '1', transform: 'none', triggerPendingAnimations: 0 })
  expect(await trigger.getAttribute('data-state')).toMatch(/^(delayed|instant)-open$/)
  await writeFile(resolve(artifacts, `${artifact}-tooltip-ready.json`), JSON.stringify({
    source, classification: 'Tooltip state readiness; not a contrast measurement', label,
    triggerState: await trigger.getAttribute('data-state'), tooltipState: await tooltip.getAttribute('data-state'),
    computed: await describe(),
  }, null, 2))
}

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
    const check: Check = async (target, name, owner, state = 'idle', pseudo, surface) => {
      const start = records.length
      const count = await target.count()
      expect(count, `${name}: required nonempty selector`).toBeGreaterThan(0)
      for (let i = 0; i < count; i++) {
        const node = target.nth(i)
        await node.scrollIntoViewIfNeeded()
        const result = await measure(node, pseudo || null)
        records.push({ id: name, owner, route, theme, state, ...(surface ? { surface } : {}), index: i, ...result })
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
    const report = { source, browser: page.context().browser()?.version(), fonts, platformFonts, failure, records }
    await page.context().tracing.stop({ path: resolve(artifacts, `${theme}-${id}.zip`) })
    await page.context().close()
    // A report is valid only after artifact capture and cleanup both succeed.
    // Otherwise a contrast failure could hide a later infrastructure failure.
    await writeFile(resolve(artifacts, `${theme}-${id}.json`), JSON.stringify(report, null, 2))
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
      await optional.hover(); await optionalTooltipReady(page, optional, `${theme}-gallery-${name}-hover`)
      await check(optional, 'optional notation', 'kits/api-docs/components/FieldItem.vue', 'hover')
      await page.keyboard.press('Escape')
      await optional.focus(); await optionalTooltipReady(page, optional, `${theme}-gallery-${name}-focus`)
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
      const results: { surface: string, ratio: number }[] = []
      for (const surface of item.hover ? documentationSurfaces : ['default']) {
        if (item.hover) await selectDocumentationSurface(page, theme, surface)
        const node = page.locator(item.selector)
        const label = item.hover ? node.locator('span').filter({ hasText: /Show|Hide/ }) : node
        await check(label, `${item.id} before mutation`, 'detector positive control', 'idle', undefined, surface)
        // This is the generated declaration of the original Tailwind alpha
        // utility. Inject the declaration, not a class that may be tree-shaken.
        const style = await page.addStyleTag({ content: `${item.selector}${item.hover ? ':hover' : ''} { color: color-mix(in oklab, var(${item.variable}) ${item.alpha}, transparent) !important; }` })
        const artifact = resolve(artifacts, `${theme}-negative-alpha-${index}${surface === 'default' ? '' : `-${surface}`}.json`)
        try {
          if (item.hover) await node.hover()
          await settle(page)
          const result = await measure(label)
          const outcome = result.ratio >= 4.5 ? 'pass' : 'fail'
          await writeFile(artifact, JSON.stringify({ source, id: item.id, surface,
            classification: 'original alpha diagnostic; actual outcome retained, not a positive suite red run', outcome, ...result }, null, 2))
          expect(result.foreground[3], `${item.id}: mutation changed alpha`).toBeCloseTo(item.hover ? 0.75 : 0.7, 5)
          results.push({ surface, ratio: result.ratio })
        }
        catch (error) {
          if (String(error).includes('unresolved:')) await writeFile(artifact, JSON.stringify({ source, id: item.id, surface, outcome: 'unresolved', reason: String(error) }, null, 2))
          throw error
        }
        finally { await style.evaluate(el => el.parentNode!.removeChild(el)) }
        await page.mouse.move(0, 0); await settle(page)
        await check(label, `${item.id} restored`, 'detector positive control', 'idle', undefined, surface)
      }
      // The adopted dark primary makes /75 readable on bg-default. Preserve
      // that sample and its actual pass; the same historical declaration must
      // still be caught on a real supported surface, independently per owner.
      expect(results.some(result => result.ratio < 4.5), `${item.id}: old alpha must fail on at least one supported surface`).toBe(true)
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

  for (const kind of ['border', 'outer-shadow'] as const) {
    test(`${theme}: detector rejects ${kind} painting outside its content box`, () => scenario(theme, `negative-paint-${kind}`, async (page, check) => {
      await page.evaluate(() => {
        const host = document.createElement('section')
        host.id = 'box-paint-control'
        Object.assign(host.style, { position: 'relative', isolation: 'isolate', width: '1200px', height: '144px', padding: '32px', backgroundColor: 'var(--ui-bg)', color: 'var(--ui-text)' })
        const branch = document.createElement('div')
        Object.assign(branch.style, { position: 'relative', width: '536px', padding: '12px' })
        const target = document.createElement('span')
        target.id = 'box-paint-target'
        target.textContent = 'Actual browser paint must stay readable'
        target.style.whiteSpace = 'nowrap'
        branch.append(target)
        const overlay = document.createElement('div')
        overlay.id = 'box-paint-overlay'
        Object.assign(overlay.style, { display: 'none', position: 'absolute', left: '32px', top: '32px', width: '536px', height: '56px', boxSizing: 'border-box', backgroundColor: 'transparent', zIndex: '1' })
        host.append(branch, overlay)
        document.querySelector('[data-testid="contrast-fixture"]')!.prepend(host)
      })
      const target = page.locator('#box-paint-target')
      const overlay = page.locator('#box-paint-overlay')
      const describePaint = () => page.evaluate(() => {
        const target = document.getElementById('box-paint-target')!
        const overlay = document.getElementById('box-paint-overlay')!
        const range = document.createRange()
        range.selectNodeContents(target)
        const textRect = range.getBoundingClientRect()
        const rect = overlay.getBoundingClientRect()
        const clientRects = Array.from(overlay.getClientRects())
        const css = getComputedStyle(overlay)
        type Bounds = { left: number, right: number, top: number, bottom: number }
        const overlapsText = (bounds: Bounds) => bounds.left < textRect.right && bounds.right > textRect.left && bounds.top < textRect.bottom && bounds.bottom > textRect.top
        const borderStrips = (['Top', 'Right', 'Bottom', 'Left'] as const).map((side) => {
          const width = parseFloat(css.getPropertyValue(`border-${side.toLowerCase()}-width`))
          const bounds = { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom }
          if (side === 'Top') bounds.bottom = rect.top + width
          if (side === 'Right') bounds.left = rect.right - width
          if (side === 'Bottom') bounds.top = rect.bottom - width
          if (side === 'Left') bounds.right = rect.left + width
          return { side, width, color: css.getPropertyValue(`border-${side.toLowerCase()}-color`), style: css.getPropertyValue(`border-${side.toLowerCase()}-style`), bounds, overlapsText: width > 0 && overlapsText(bounds) }
        })
        const topWidth = parseFloat(css.borderTopWidth)
        const fragmentTopBorders = clientRects.map((fragment) => {
          const bounds = { left: fragment.left, right: fragment.right, top: fragment.top, bottom: fragment.top + topWidth }
          return { bounds, overlapsText: topWidth > 0 && overlapsText(bounds) }
        })
        // The test injects one zero-blur shadow. These bounds describe that
        // controlled paint; they are not a general CSS shadow implementation.
        const lengths = Array.from(css.boxShadow.matchAll(/(?:^|\s)(-?[\d.]+)px(?=\s|$)/g), match => Number(match[1]))
        const [x = 0, y = 0, , spread = 0] = lengths
        const shadowBounds = { left: rect.left + x - spread, right: rect.right + x + spread, top: rect.top + y - spread, bottom: rect.bottom + y + spread }
        const filterChild = overlay.querySelector('#box-paint-filter-child')
        const filterLengths = Array.from(css.filter.matchAll(/(-?[\d.]+)px/g), match => Number(match[1]))
        const [filterX = 0, filterY = 0] = filterLengths
        const childRect = filterChild?.getBoundingClientRect()
        return {
          targetRect: target.getBoundingClientRect().toJSON(), textRect: textRect.toJSON(), overlayRect: rect.toJSON(), clientRects: clientRects.map(rect => rect.toJSON()), fragmentTopBorders, hostRect: document.getElementById('box-paint-control')!.getBoundingClientRect().toJSON(),
          targetColor: getComputedStyle(target).color, backgroundColor: css.backgroundColor, color: css.color, display: css.display, position: css.position, zIndex: css.zIndex, borderStrips,
          boxShadow: css.boxShadow, filter: css.filter, visibility: css.visibility,
          children: Array.from(overlay.querySelectorAll('*')).map((child) => {
            const style = getComputedStyle(child)
            return { id: child.id, tag: child.tagName, rect: child.getBoundingClientRect().toJSON(), clientRects: Array.from(child.getClientRects(), rect => rect.toJSON()), display: style.display, visibility: style.visibility, filter: style.filter, backgroundColor: style.backgroundColor, color: style.color, opacity: style.opacity }
          }),
          // Only this controlled zero-blur drop-shadow uses translated child
          // bounds. The detector must reject the unmodeled ancestor filter.
          filterShadow: css.filter !== 'none' && childRect ? { lengths: filterLengths, bounds: { left: childRect.left + filterX, right: childRect.right + filterX, top: childRect.top + filterY, bottom: childRect.bottom + filterY } } : null,
          shadow: css.boxShadow === 'none' ? null : { lengths, color: css.boxShadow.replace(/(?:\s+-?[\d.]+px){4}$/, ''), bounds: shadowBounds, overlapsText: overlapsText(shadowBounds) },
        }
      })
      const capture = async (state: string, computed: Awaited<ReturnType<typeof describePaint>>, detection: Record<string, unknown>, classification: string) => {
        const name = `${theme}-negative-paint-${kind}-${state}`
        await page.locator('#box-paint-control').screenshot({ path: resolve(artifacts, `${name}.png`) })
        await writeFile(resolve(artifacts, `${name}.json`), JSON.stringify({ source, theme, kind, state, classification, computed, ...detection }, null, 2))
      }
      const positive = async (state: string) => {
        const rows = await check(target, `${kind}/${state}`, 'measurement contract')
        const computed = await describePaint()
        await capture(state, computed, { measurements: rows }, 'positive detector control')
        return computed
      }
      const expectRejection = async (state: string, computed: Awaited<ReturnType<typeof describePaint>>) => {
        const detection = await measure(target).then(measurement => ({ measurement, rejection: null }), error => ({ measurement: null, rejection: String(error) }))
        await capture(state, computed, detection, 'expected detector rejection; not a positive suite red run')
        expect(detection.rejection, `${state}: overlapping paint must reject instead of returning a contrast ratio`).not.toBeNull()
        expect(detection.rejection, `${state}: overlapping paint must not silently pass`).toMatch(/unresolved:/)
      }
      const expectCoverage = (paint: { left: number, right: number, top: number, bottom: number }, text: { left: number, right: number, top: number, bottom: number }) => {
        expect(paint.left).toBeLessThanOrEqual(text.left)
        expect(paint.right).toBeGreaterThanOrEqual(text.right)
        expect(paint.top).toBeLessThanOrEqual(text.top)
        expect(paint.bottom).toBeGreaterThanOrEqual(text.bottom)
      }

      await positive('no-overlay')
      if (kind === 'border') {
        await overlay.evaluate(node => Object.assign((node as HTMLElement).style, { display: 'block', left: '600px', borderTop: '56px solid currentColor' }))
        const separated = await positive('separated-border')
        expect(separated.overlayRect.left).toBeGreaterThanOrEqual(separated.textRect.right)
        expect(separated.borderStrips.every(strip => !strip.overlapsText)).toBe(true)

        // The overlay box surrounds the text, but each thin edge stays clear
        // of its Range. Rejecting every border would break this normal case.
        await overlay.evaluate(node => Object.assign((node as HTMLElement).style, { left: '32px', border: '1px solid currentColor' }))
        const thin = await positive('thin-border-around-text')
        expectCoverage(thin.overlayRect, thin.textRect)
        expect(thin.borderStrips.every(strip => strip.width === 1 && !strip.overlapsText)).toBe(true)

        await overlay.evaluate(node => Object.assign((node as HTMLElement).style, { border: '0', backgroundColor: 'currentColor' }))
        const background = await describePaint()
        expectCoverage(background.overlayRect, background.textRect)
        expect(background.backgroundColor).toBe(background.targetColor)
        await expectRejection('same-color-background', background)

        await overlay.evaluate(node => Object.assign((node as HTMLElement).style, { backgroundColor: 'transparent', borderTop: '56px solid currentColor' }))
        const covered = await describePaint()
        const top = covered.borderStrips.find(strip => strip.side === 'Top')!
        expect(covered.backgroundColor).toBe('rgba(0, 0, 0, 0)')
        expect(top.width).toBe(56)
        expect(top.color).toBe(covered.targetColor)
        expectCoverage(top.bounds, covered.textRect)
        await expectRejection('border-covers-text', covered)
        await overlay.evaluate(node => { (node as HTMLElement).style.border = '1px solid currentColor' })
        await positive('thin-border-restored')

        const beforeFragments = await overlay.evaluate((node) => {
          const host = document.getElementById('box-paint-control')!
          const branch = document.getElementById('box-paint-target')!.parentElement!
          const original = { host: host.getAttribute('style'), branch: branch.getAttribute('style'), overlay: node.getAttribute('style') }
          Object.assign((host as HTMLElement).style, { height: '240px', padding: '0' })
          Object.assign(branch.style, { position: 'absolute', left: '20px', top: '75px', padding: '0', backgroundColor: 'var(--ui-bg)' })
          const wrapper = document.createElement('div')
          wrapper.id = 'box-paint-fragment-wrapper'
          Object.assign(wrapper.style, { position: 'relative', zIndex: '1', width: '536px', fontSize: '0', lineHeight: '50px' })
          host.prepend(wrapper)
          wrapper.append(node)
          Object.assign((node as HTMLElement).style, { display: 'inline', position: 'static', width: 'auto', height: 'auto', border: '0', zIndex: 'auto' })
          for (let index = 0; index < 3; index++) {
            if (index) node.append(document.createElement('br'))
            const spacer = document.createElement('i')
            Object.assign(spacer.style, { display: 'inline-block', width: '512px', height: '40px' })
            node.append(spacer)
          }
          return original
        })
        const unpaintedFragments = await positive('fragmented-inline-without-border')
        expect(unpaintedFragments.clientRects.length).toBeGreaterThan(1)
        await overlay.evaluate((node) => {
          ;(node as HTMLElement).style.borderTop = '28px solid currentColor'
          const target = document.getElementById('box-paint-target')!
          const branch = target.parentElement!
          const range = document.createRange()
          range.selectNodeContents(target)
          // Align actual glyph bounds with the middle fragment, independent
          // of the platform's font ascent or inline baseline metrics.
          branch.style.top = `${parseFloat(branch.style.top) + node.getClientRects()[1]!.top + 2 - range.getBoundingClientRect().top}px`
        })
        const fragmented = await describePaint()
        expect(fragmented.clientRects.length).toBeGreaterThan(1)
        expect(fragmented.borderStrips.every(strip => !strip.overlapsText), 'the union outer edges miss the middle fragment border').toBe(true)
        expect(fragmented.borderStrips.find(strip => strip.side === 'Top')!.color).toBe(fragmented.targetColor)
        expectCoverage(fragmented.fragmentTopBorders[1]!.bounds, fragmented.textRect)
        await expectRejection('fragmented-inline-middle-border', fragmented)
        await overlay.evaluate(node => { (node as HTMLElement).style.borderTop = 'none' })
        await positive('fragmented-inline-border-removed')
        await overlay.evaluate((node, original) => {
          const host = document.getElementById('box-paint-control')!
          const branch = document.getElementById('box-paint-target')!.parentElement!
          host.append(node)
          document.getElementById('box-paint-fragment-wrapper')!.remove()
          node.replaceChildren()
          host.setAttribute('style', original.host || '')
          branch.setAttribute('style', original.branch || '')
          node.setAttribute('style', original.overlay || '')
        }, beforeFragments)
        await positive('thin-border-after-fragments-restored')
      }
      else {
        await overlay.evaluate(node => Object.assign((node as HTMLElement).style, { display: 'block', left: '600px', boxShadow: '32px 0 0 0 currentColor' }))
        const separated = await positive('separated-shadow')
        expect(separated.overlayRect.left).toBeGreaterThanOrEqual(separated.textRect.right)
        expect(separated.shadow!.lengths).toEqual([32, 0, 0, 0])
        expect(separated.shadow!.overlapsText).toBe(false)

        await overlay.evaluate(node => { (node as HTMLElement).style.boxShadow = '-568px 0 0 0 currentColor' })
        const covered = await describePaint()
        expect(covered.overlayRect.left, 'the shadow host itself stays outside the text').toBeGreaterThanOrEqual(covered.textRect.right)
        expect(covered.backgroundColor).toBe('rgba(0, 0, 0, 0)')
        expect(covered.shadow!.lengths).toEqual([-568, 0, 0, 0])
        expect(covered.shadow!.color).toBe(covered.targetColor)
        expectCoverage(covered.shadow!.bounds, covered.textRect)
        await expectRejection('offset-shadow-covers-text', covered)
        await overlay.evaluate(node => { (node as HTMLElement).style.boxShadow = '32px 0 0 0 currentColor' })
        await positive('separated-shadow-restored')

        await overlay.evaluate(node => Object.assign((node as HTMLElement).style, { width: '0', height: '0', top: '60px', boxShadow: '0 0 0 32px currentColor' }))
        const zeroSeparated = await positive('zero-host-separated-spread')
        expect(zeroSeparated.overlayRect.width).toBe(0)
        expect(zeroSeparated.overlayRect.height).toBe(0)
        expect(zeroSeparated.shadow!.lengths).toEqual([0, 0, 0, 32])
        expect(zeroSeparated.shadow!.overlapsText).toBe(false)
        expect(zeroSeparated.shadow!.bounds.left).toBeGreaterThanOrEqual(zeroSeparated.textRect.right)

        await overlay.evaluate(node => { (node as HTMLElement).style.boxShadow = '-544px 0 0 32px currentColor' })
        const zeroCovered = await describePaint()
        expect(zeroCovered.overlayRect.width).toBe(0)
        expect(zeroCovered.overlayRect.height).toBe(0)
        expect(zeroCovered.overlayRect.left).toBeGreaterThanOrEqual(zeroCovered.textRect.right)
        expect(zeroCovered.shadow!.lengths).toEqual([-544, 0, 0, 32])
        expect(zeroCovered.shadow!.color).toBe(zeroCovered.targetColor)
        expect(zeroCovered.shadow!.overlapsText, 'spread paints over glyphs even when its host has no area').toBe(true)
        await expectRejection('zero-host-spread-covers-text', zeroCovered)
        await overlay.evaluate(node => { (node as HTMLElement).style.boxShadow = '0 0 0 32px currentColor' })
        await positive('zero-host-separated-spread-restored')

        await overlay.evaluate((node) => {
          Object.assign((node as HTMLElement).style, { width: '536px', height: '56px', top: '32px', boxShadow: 'none', visibility: 'hidden', filter: 'none' })
          const child = document.createElement('div')
          child.id = 'box-paint-filter-child'
          Object.assign(child.style, { width: '536px', height: '56px', backgroundColor: 'currentColor', visibility: 'visible' })
          node.append(child)
        })
        const noFilter = await positive('hidden-ancestor-visible-child-without-filter')
        expect(noFilter.visibility).toBe('hidden')
        expect(noFilter.children[0]!.visibility).toBe('visible')
        expect(noFilter.children[0]!.rect.left).toBeGreaterThanOrEqual(noFilter.textRect.right)
        await overlay.evaluate(node => { (node as HTMLElement).style.filter = 'drop-shadow(-568px 0 0 currentColor)' })
        const filtered = await describePaint()
        expect(filtered.overlayRect.left).toBeGreaterThanOrEqual(filtered.textRect.right)
        expect(filtered.visibility).toBe('hidden')
        expect(filtered.filter).toContain('drop-shadow(')
        expect(filtered.filter).toContain(filtered.targetColor)
        expect(filtered.filterShadow!.lengths).toEqual([-568, 0, 0])
        expect(filtered.children[0]!.visibility).toBe('visible')
        expect(filtered.children[0]!.filter).toBe('none')
        expect(filtered.children[0]!.backgroundColor).toBe(filtered.targetColor)
        expectCoverage(filtered.filterShadow!.bounds, filtered.textRect)
        await expectRejection('hidden-ancestor-filter-projects-visible-child', filtered)
        await overlay.evaluate(node => { (node as HTMLElement).style.filter = 'none' })
        await positive('hidden-ancestor-filter-removed')
        await overlay.evaluate((node) => {
          node.replaceChildren()
          ;(node as HTMLElement).style.visibility = 'visible'
        })
      }
      await overlay.evaluate(node => { (node as HTMLElement).style.display = 'none' })
      await positive('no-overlay-restored')
    }))
  }

  for (const kind of ['transparent-parent', 'earlier-higher-z'] as const) {
    test(`${theme}: detector rejects ${kind} overlapping paint`, () => scenario(theme, `negative-paint-${kind}`, async (page, check) => {
      // These DOM paint controls exercise the real Chromium stacking order.
      // They are detector contract tests, not source-mutation red/green proof.
      await page.evaluate((kind) => {
        const host = document.createElement('section')
        host.id = 'paint-control'
        Object.assign(host.style, { position: 'relative', isolation: 'isolate', width: '600px', padding: '32px', backgroundColor: 'var(--ui-bg)' })
        const overlay = document.createElement('div')
        overlay.id = 'paint-overlay'
        Object.assign(overlay.style, { display: 'none', position: 'absolute', inset: '32px', backgroundColor: kind === 'earlier-higher-z' ? 'currentColor' : 'transparent' })
        if (kind === 'transparent-parent') {
          const child = document.createElement('div')
          child.id = 'paint-colored-child'
          Object.assign(child.style, { position: 'absolute', inset: '0', backgroundColor: 'currentColor' })
          overlay.append(child)
        }
        const branch = document.createElement('div')
        branch.id = 'paint-branch'
        Object.assign(branch.style, { position: 'relative', padding: '12px', backgroundColor: kind === 'earlier-higher-z' ? 'var(--ui-bg)' : 'transparent' })
        const target = document.createElement('span')
        target.id = 'paint-target'
        target.textContent = 'Actual browser paint must stay readable'
        branch.append(target)
        host.append(overlay, branch)
        document.querySelector('[data-testid="contrast-fixture"]')!.prepend(host)
      }, kind)
      const target = page.locator('#paint-target')
      const overlay = page.locator('#paint-overlay')
      await check(target, `${kind}/no overlay`, 'measurement contract')
      await overlay.evaluate((node) => { Object.assign((node as HTMLElement).style, { display: 'block', transform: 'translateX(700px)' }) })
      const separated = await overlay.evaluate((node) => ({ overlay: node.getBoundingClientRect().toJSON(), target: document.getElementById('paint-target')!.getBoundingClientRect().toJSON() }))
      expect(separated.overlay.left, 'normal control really does not overlap').toBeGreaterThanOrEqual(separated.target.right)
      await check(target, `${kind}/nonoverlapping paint`, 'measurement contract')

      await overlay.evaluate((node, kind) => { Object.assign((node as HTMLElement).style, { transform: 'none', zIndex: kind === 'earlier-higher-z' ? '1' : 'auto' }) }, kind)
      const describePaint = () => page.evaluate(() => {
        const target = document.getElementById('paint-target')!
        const paint = document.getElementById('paint-colored-child') || document.getElementById('paint-overlay')!
        const targetRect = target.getBoundingClientRect()
        const ids = ['paint-control', 'paint-overlay', 'paint-colored-child', 'paint-branch', 'paint-target', 'paint-layer-wrapper', 'paint-dialog', 'paint-zero-pseudo', 'paint-clip-wrapper', 'paint-clipped-text', 'paint-clip-margin', 'paint-clip-margin-child', 'paint-inline-clip', 'paint-inline-child', 'paint-scroll-host', 'paint-zoom-host']
        return {
          targetRect: targetRect.toJSON(), paintRect: paint.getBoundingClientRect().toJSON(),
          paintBackground: getComputedStyle(paint).backgroundColor, targetColor: getComputedStyle(target).color,
          elementsAtTextCenter: document.elementsFromPoint((targetRect.left + targetRect.right) / 2, (targetRect.top + targetRect.bottom) / 2).map(node => node.id || node.tagName),
          elements: ids.map(id => document.getElementById(id)).filter((node): node is HTMLElement => node !== null).map((node) => {
            const style = getComputedStyle(node)
            return { id: node.id, rect: node.getBoundingClientRect().toJSON(), backgroundColor: style.backgroundColor, color: style.color, opacity: style.opacity, position: style.position, zIndex: style.zIndex, isolation: style.isolation, display: style.display, whiteSpace: style.whiteSpace, overflow: style.overflow, overflowClipMargin: style.overflowClipMargin, scrollLeft: node.scrollLeft, scrollTop: node.scrollTop, zoom: style.zoom, transform: style.transform, backgroundClip: style.backgroundClip, modal: node.matches(':modal') }
          }),
        }
      })
      const expectUnmodeledPaint = async (state: string, computed: Awaited<ReturnType<typeof describePaint>>) => {
        const detection = await measure(target).then(measurement => ({ measurement, rejection: null }), error => ({ measurement: null, rejection: String(error) }))
        await page.locator('#paint-control').screenshot({ path: resolve(artifacts, `${theme}-negative-paint-${kind}-${state}.png`) })
        // Expected rejections are not positive records or source-mutation proof.
        await writeFile(resolve(artifacts, `${theme}-negative-paint-${kind}-${state}.json`), JSON.stringify({ source, theme, kind, state, classification: 'expected detector rejection; not a positive suite red run', computed, ...detection }, null, 2))
        expect(detection.rejection, `${state}: an unknown overlapping layer must not silently pass`).toMatch(/unresolved:.*(?:sibling|paint|text|stacking|::before|::after)/)
      }
      const computed = await describePaint()
      expect(computed.paintRect.left).toBeLessThanOrEqual(computed.targetRect.left)
      expect(computed.paintRect.right).toBeGreaterThanOrEqual(computed.targetRect.right)
      expect(computed.paintRect.top).toBeLessThanOrEqual(computed.targetRect.top)
      expect(computed.paintRect.bottom).toBeGreaterThanOrEqual(computed.targetRect.bottom)
      expect(computed.paintBackground, 'same-color paint makes the rendered text unreadable').toBe(computed.targetColor)
      if (kind === 'earlier-higher-z') expect(computed.elementsAtTextCenter[0], 'positive z-index paints above the opaque text branch').toBe('paint-overlay')
      else expect(computed.elements.find(node => node.id === 'paint-overlay')!.backgroundColor, 'only the transparent sibling descendant paints').toBe('rgba(0, 0, 0, 0)')
      await expectUnmodeledPaint('rejection', computed)

      // A preceding sibling behind a higher opaque stacking context is valid.
      // The transparent-parent case restores its unpainted child instead.
      if (kind === 'earlier-higher-z') {
        await page.locator('#paint-branch').evaluate((node) => { (node as HTMLElement).style.zIndex = '2' })
        for (const order of ['before', 'after']) {
          if (order === 'after') await overlay.evaluate(node => node.parentElement!.append(node))
          const protectedRows = await check(target, `${kind}/opaque higher context DOM ${order}`, 'measurement contract')
          expect(protectedRows[0].excludedPaint.some((paint: any) => paint.contentLevel === 2 && paint.otherLevel === 1), 'exclusion needs a proven lower stacking context').toBe(true)
        }

        // An opaque ancestor outside that context cannot hide the underlay.
        await page.locator('#paint-branch').evaluate((node) => { (node as HTMLElement).style.backgroundColor = 'transparent' })
        const outsideComputed = await describePaint()
        expect(outsideComputed.elements.find(node => node.id === 'paint-branch')!.backgroundColor).toBe('rgba(0, 0, 0, 0)')
        expect(outsideComputed.elements.find(node => node.id === 'paint-control')!.backgroundColor).not.toBe('rgba(0, 0, 0, 0)')
        await expectUnmodeledPaint('outside-context', outsideComputed)
        await page.locator('#paint-branch').evaluate((node) => { (node as HTMLElement).style.backgroundColor = 'var(--ui-bg)' })

        // An opaque box cannot shield glyphs that overflow its right edge.
        const branch = page.locator('#paint-branch')
        await branch.evaluate((node) => { Object.assign((node as HTMLElement).style, { width: '12px', padding: '0', whiteSpace: 'nowrap' }) })
        const overflow = await describePaint()
        expect(overflow.elements.find(node => node.id === 'paint-branch')!.rect.right).toBeLessThan(overflow.targetRect.right)
        await expectUnmodeledPaint('overflow-text', overflow)
        await branch.evaluate((node) => { Object.assign((node as HTMLElement).style, { width: '', padding: '12px', whiteSpace: '' }) })
        await check(target, `${kind}/opaque coverage restored`, 'measurement contract')

        // Native modal dialogs escape their low-z ancestor into the top layer.
        await overlay.evaluate((node) => {
          const dialog = document.createElement('dialog')
          dialog.id = 'paint-dialog'
          Object.assign(dialog.style, { position: 'fixed', inset: '0', margin: '0', width: '100vw', height: '100vh', maxWidth: 'none', maxHeight: 'none', padding: '0', border: '0', backgroundColor: 'currentColor', color: 'inherit' })
          node.append(dialog)
        })
        await check(target, `${kind}/closed native dialog`, 'measurement contract')
        await page.locator('#paint-dialog').evaluate((node) => { (node as HTMLDialogElement).showModal() })
        const topLayer = await describePaint()
        expect(topLayer.elements.find(node => node.id === 'paint-dialog')!.modal).toBe(true)
        expect(topLayer.elementsAtTextCenter[0], 'native top layer really covers the text').toBe('paint-dialog')
        await expectUnmodeledPaint('native-top-layer', topLayer)
        await page.locator('#paint-dialog').evaluate((node) => { (node as HTMLDialogElement).close(); node.remove() })
        await check(target, `${kind}/native dialog removed`, 'measurement contract')

        // A block wrapper traps z2 below the text's z1 context. display:contents
        // removes that wrapper box/context and lets z2 paint above the text.
        await branch.evaluate((node) => { (node as HTMLElement).style.zIndex = '1' })
        await overlay.evaluate((node) => {
          const wrapper = document.createElement('div')
          wrapper.id = 'paint-layer-wrapper'
          const height = document.getElementById('paint-branch')!.getBoundingClientRect().height
          Object.assign(wrapper.style, { display: 'block', position: 'relative', zIndex: '0', height: `${height}px`, marginTop: `-${height}px` })
          node.parentElement!.append(wrapper)
          wrapper.append(node)
          Object.assign((node as HTMLElement).style, { inset: '0', zIndex: '2' })
        })
        const trapped = await check(target, `${kind}/boxed lower context`, 'measurement contract')
        expect(trapped[0].excludedPaint.some((paint: any) => paint.contentLevel === 1 && paint.otherLevel === 0)).toBe(true)
        await page.locator('#paint-layer-wrapper').evaluate((node) => { (node as HTMLElement).style.display = 'contents' })
        const contents = await describePaint()
        expect(contents.elements.find(node => node.id === 'paint-layer-wrapper')!.display).toBe('contents')
        expect(contents.elementsAtTextCenter[0], 'display:contents does not trap the higher child').toBe('paint-overlay')
        await expectUnmodeledPaint('display-contents', contents)
        await page.locator('#paint-layer-wrapper').evaluate((node) => { (node as HTMLElement).style.display = 'block' })
      }
      else {
        await page.locator('#paint-colored-child').evaluate((node) => { (node as HTMLElement).style.backgroundColor = 'transparent' })
        await page.locator('#paint-control').evaluate((host) => {
          const zero = document.createElement('div')
          zero.id = 'paint-zero-pseudo'
          Object.assign(zero.style, { width: '0', height: '0', position: 'static', overflow: 'visible' })
          host.append(zero)
        })
        await check(target, `${kind}/unpainted zero-size sibling`, 'measurement contract')
        const pseudoStyle = await page.addStyleTag({ content: '#paint-zero-pseudo::before { content: ""; position: absolute; inset: 0; z-index: 3; background: currentColor; }' })
        const describePseudo = () => page.locator('#paint-zero-pseudo').evaluate((node) => {
          const css = getComputedStyle(node, '::before')
          return { content: css.content, position: css.position, zIndex: css.zIndex, width: css.width, height: css.height, top: css.top, right: css.right, bottom: css.bottom, left: css.left, backgroundColor: css.backgroundColor }
        })
        const zeroSize = {
          ...await describePaint(),
          pseudo: await describePseudo(),
        }
        const owner = zeroSize.elements.find(node => node.id === 'paint-zero-pseudo')!
        expect(owner.rect.width).toBe(0); expect(owner.rect.height).toBe(0)
        expect(zeroSize.pseudo.backgroundColor).toBe(zeroSize.targetColor)
        expect(parseFloat(zeroSize.pseudo.width)).toBeGreaterThan(zeroSize.targetRect.width)
        expect(parseFloat(zeroSize.pseudo.height)).toBeGreaterThan(zeroSize.targetRect.height)
        expect(zeroSize.elementsAtTextCenter[0], 'the zero-size owner has a real covering pseudo box').toBe('paint-zero-pseudo')
        await expectUnmodeledPaint('zero-size-pseudo', zeroSize)
        await page.locator('#paint-zero-pseudo').evaluate((node) => { Object.assign((node as HTMLElement).style, { width: '16px', height: '16px', marginLeft: '700px' }) })
        const escapedPseudo = await describePaint()
        expect(escapedPseudo.elements.find(node => node.id === 'paint-zero-pseudo')!.rect.left).toBeGreaterThan(escapedPseudo.targetRect.right)
        expect(escapedPseudo.elementsAtTextCenter[0], 'a nonoverlapping static owner does not bound its absolute pseudo').toBe('paint-zero-pseudo')
        const escapedEvidence = { ...escapedPseudo, pseudo: await describePseudo() }
        await expectUnmodeledPaint('nonoverlapping-owner-pseudo', escapedEvidence)
        await pseudoStyle.evaluate(node => node.parentNode!.removeChild(node))
        await check(target, `${kind}/unpainted nonoverlapping owner`, 'measurement contract')

        // A collapsed positioned ancestor really clips this overlapping text.
        // Removing only the clip makes it visible and must reject measurement.
        await page.locator('#paint-control').evaluate((host) => {
          const clip = document.createElement('div')
          clip.id = 'paint-clip-wrapper'
          Object.assign(clip.style, { position: 'relative', height: '0', overflow: 'hidden' })
          const text = document.createElement('span')
          text.id = 'paint-clipped-text'
          text.textContent = 'Overlapping text from the collapsed sibling'
          Object.assign(text.style, { position: 'absolute', whiteSpace: 'nowrap' })
          clip.append(text); host.append(clip)
          const target = document.getElementById('paint-target')!.getBoundingClientRect()
          const box = clip.getBoundingClientRect()
          Object.assign(text.style, { top: `${target.top - box.top}px`, left: `${target.left - box.left}px` })
        })
        const clipped = await describePaint()
        const hiddenText = clipped.elements.find(node => node.id === 'paint-clipped-text')!
        expect(hiddenText.rect.top).toBeLessThan(clipped.targetRect.bottom)
        expect(hiddenText.rect.bottom).toBeGreaterThan(clipped.targetRect.top)
        expect(clipped.elements.find(node => node.id === 'paint-clip-wrapper')!.rect.height).toBe(0)
        await check(target, `${kind}/ancestor-clipped sibling text`, 'measurement contract')
        await page.locator('#paint-clip-wrapper').evaluate((node) => { (node as HTMLElement).style.overflow = 'visible' })
        await expectUnmodeledPaint('removed-ancestor-clip', await describePaint())
        await page.locator('#paint-clip-wrapper').evaluate((node) => { (node as HTMLElement).style.overflow = 'hidden' })
        await check(target, `${kind}/ancestor clip restored`, 'measurement contract')
        await page.locator('#paint-clip-wrapper').evaluate(node => node.remove())

        // overflow:clip can paint outside its box when clip-margin expands it.
        await page.locator('#paint-branch').evaluate((node) => {
          const clip = document.createElement('div')
          clip.id = 'paint-clip-margin'
          Object.assign(clip.style, { width: '12px', height: '48px', overflow: 'hidden' })
          const paint = document.createElement('div')
          paint.id = 'paint-clip-margin-child'
          Object.assign(paint.style, { width: '536px', height: '48px', backgroundColor: 'currentColor' })
          clip.append(paint); node.before(clip)
          Object.assign((node as HTMLElement).style, { marginTop: '-48px', marginLeft: '40px' })
        })
        await check(target, `${kind}/narrow hidden clip`, 'measurement contract')
        await page.locator('#paint-clip-margin').evaluate((node) => { Object.assign((node as HTMLElement).style, { overflow: 'clip', overflowClipMargin: '500px' }) })
        const expandedClip = await describePaint()
        expect(expandedClip.elements.find(node => node.id === 'paint-clip-margin')!.rect.right).toBeLessThan(expandedClip.targetRect.left)
        const expandedPaint = expandedClip.elements.find(node => node.id === 'paint-clip-margin-child')!
        expect(expandedPaint.rect.right).toBeGreaterThan(expandedClip.targetRect.right)
        expect(expandedPaint.backgroundColor).toBe(expandedClip.targetColor)
        expect(expandedClip.elementsAtTextCenter).toContain('paint-clip-margin-child')
        await expectUnmodeledPaint('expanded-overflow-clip-margin', expandedClip)
        await page.locator('#paint-clip-margin').evaluate((node) => { Object.assign((node as HTMLElement).style, { overflow: 'hidden', overflowClipMargin: '0px' }) })
        await check(target, `${kind}/hidden clip restored`, 'measurement contract')
        await page.locator('#paint-clip-margin').evaluate(node => node.remove())
        await page.locator('#paint-branch').evaluate((node) => { Object.assign((node as HTMLElement).style, { marginTop: '', marginLeft: '' }) })

        // Overflow on a non-replaced inline box does not clip its descendants.
        await page.locator('#paint-branch').evaluate((node) => {
          const clip = document.createElement('span')
          clip.id = 'paint-inline-clip'
          Object.assign(clip.style, { display: 'inline-block', width: '12px', height: '48px', overflow: 'hidden' })
          const inner = document.createElement('span')
          Object.assign(inner.style, { display: 'inline-block', width: '12px', height: '48px' })
          const paint = document.createElement('span')
          paint.id = 'paint-inline-child'
          Object.assign(paint.style, { display: 'block', width: '536px', height: '48px', backgroundColor: 'currentColor' })
          inner.append(paint); clip.append(inner); node.before(clip)
          Object.assign((node as HTMLElement).style, { marginTop: '-48px', marginLeft: '40px' })
        })
        await check(target, `${kind}/inline-block clips paint`, 'measurement contract')
        await page.locator('#paint-inline-clip').evaluate((node) => { (node as HTMLElement).style.display = 'inline' })
        const inline = await describePaint()
        expect(inline.elements.find(node => node.id === 'paint-inline-clip')!.display).toBe('inline')
        expect(inline.elementsAtTextCenter).toContain('paint-inline-child')
        await expectUnmodeledPaint('inline-overflow-not-a-clip', inline)
        await page.locator('#paint-inline-clip').evaluate((node) => { (node as HTMLElement).style.display = 'inline-block' })
        await check(target, `${kind}/inline-block clip restored`, 'measurement contract')
        await page.locator('#paint-inline-clip').evaluate(node => node.remove())
        await page.locator('#paint-branch').evaluate((node) => { Object.assign((node as HTMLElement).style, { marginTop: '', marginLeft: '' }) })

        // The pseudo's CSS left offset is unchanged when its host scrolls.
        await page.locator('#paint-branch').evaluate((node) => {
          const scroll = document.createElement('div')
          scroll.id = 'paint-scroll-host'
          Object.assign(scroll.style, { position: 'relative', width: '536px', height: '80px', overflow: 'auto' })
          node.before(scroll)
          ;(node as HTMLElement).style.marginTop = '-80px'
        })
        const scrollStyle = await page.addStyleTag({ content: '#paint-scroll-host::before { content: ""; position: absolute; left: 600px; top: 0; width: 600px; height: 80px; background: currentColor; }' })
        await check(target, `${kind}/unscrolled distant pseudo`, 'measurement contract')
        await page.locator('#paint-scroll-host').evaluate((node) => { node.scrollLeft = 600 })
        const scrolled = {
          ...await describePaint(),
          pseudo: await page.locator('#paint-scroll-host').evaluate((node) => {
            const css = getComputedStyle(node, '::before')
            return { left: css.left, top: css.top, width: css.width, height: css.height, backgroundColor: css.backgroundColor, scrollLeft: node.scrollLeft, scrollTop: node.scrollTop }
          }),
        }
        expect(scrolled.pseudo.scrollLeft).toBe(600)
        expect(scrolled.pseudo.left).toBe('600px')
        expect(scrolled.pseudo.backgroundColor).toBe(scrolled.targetColor)
        await expectUnmodeledPaint('scrolled-pseudo-host', scrolled)
        await page.locator('#paint-scroll-host').evaluate((node) => { node.scrollLeft = 0 })
        await check(target, `${kind}/pseudo scroll restored`, 'measurement contract')
        await scrollStyle.evaluate(node => node.parentNode!.removeChild(node))
        await page.locator('#paint-scroll-host').evaluate(node => node.remove())
        await page.locator('#paint-branch').evaluate((node) => { (node as HTMLElement).style.marginTop = '' })

        // CSS zoom changes CSS offsets relative to viewport-space DOM rects.
        await page.locator('#paint-control').evaluate((host) => { Object.assign((host as HTMLElement).style, { zoom: '0.5', transform: 'translate(24px, 10px)' }) })
        await page.locator('#paint-branch').evaluate((node) => {
          const zoom = document.createElement('div')
          zoom.id = 'paint-zoom-host'
          Object.assign(zoom.style, { position: 'relative', width: '536px', height: '80px' })
          node.before(zoom)
          ;(node as HTMLElement).style.marginTop = '-20px'
        })
        const zoomStyle = await page.addStyleTag({ content: '#paint-zoom-host::before { content: ""; position: absolute; left: 0; top: 60px; width: 536px; height: 80px; background: currentColor; }' })
        const zoomed = {
          ...await describePaint(),
          pseudo: await page.locator('#paint-zoom-host').evaluate((node) => {
            const css = getComputedStyle(node, '::before')
            return { top: css.top, left: css.left, width: css.width, height: css.height, backgroundColor: css.backgroundColor }
          }),
        }
        const zoomHost = zoomed.elements.find(node => node.id === 'paint-zoom-host')!
        expect(zoomed.elements.find(node => node.id === 'paint-control')!.zoom).toBe('0.5')
        expect(zoomHost.rect.top + parseFloat(zoomed.pseudo.top), 'unscaled offsets would wrongly appear disjoint').toBeGreaterThan(zoomed.targetRect.bottom)
        expect(zoomHost.rect.top + parseFloat(zoomed.pseudo.top) * 0.5).toBeLessThanOrEqual(zoomed.targetRect.top)
        expect(zoomHost.rect.top + (parseFloat(zoomed.pseudo.top) + parseFloat(zoomed.pseudo.height)) * 0.5).toBeGreaterThanOrEqual(zoomed.targetRect.bottom)
        expect(zoomed.pseudo.backgroundColor).toBe(zoomed.targetColor)
        await expectUnmodeledPaint('css-zoom-pseudo', zoomed)
        await zoomStyle.evaluate(node => node.parentNode!.removeChild(node))
        await check(target, `${kind}/zoom without pseudo restored`, 'measurement contract')
        await page.locator('#paint-zoom-host').evaluate(node => node.remove())
        await page.locator('#paint-branch').evaluate((node) => { (node as HTMLElement).style.marginTop = '' })
        await page.locator('#paint-control').evaluate((host) => { Object.assign((host as HTMLElement).style, { zoom: '', transform: '' }) })
      }
      await check(target, `${kind}/restored paint`, 'measurement contract')
    }))
  }
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
        await page.keyboard.press('Escape')
        if (component === 'input-menu') await page.locator('[role="option"]').first().waitFor({ state: 'hidden' })
        await node.blur(); await page.mouse.move(0, 0)
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
      await check(label, `${id}/verb`, owner!, 'idle', undefined, 'default')
      await button.hover(); await settle(page)
      await check(label, `${id}/verb`, owner!, 'hover', undefined, 'default')
      await button.click(); await settle(page)
      await check(label, `${id}/verb`, owner!, 'expanded-hover', undefined, 'default')
    }
  }))

  for (const surface of documentationSurfaces.filter(surface => surface !== 'default')) {
    test(`${theme}/${surface}: both expand owners on supported surface`, () => scenario(theme, `docs-${surface}`, async (page, check) => {
      expect(await page.getByTestId('documentation-states').getAttribute('data-expand-surface')).toBe(surface)
      for (const [id, selector, owner] of [
        ['field-expand', 'button[aria-expanded]', 'kits/api-docs/components/FieldItem.vue'],
        ['value-expand', '[data-value-structure-toggle]', 'kits/api-docs/internal/FieldValueStructure.vue'],
      ]) {
        const button = page.getByTestId(id!).locator(selector!)
        const label = button.locator('span').filter({ hasText: /Show|Hide/ })
        await page.mouse.move(0, 0)
        await check(label, `${id}/verb`, owner!, 'idle', undefined, surface)
        await button.hover(); await settle(page)
        await check(label, `${id}/verb`, owner!, 'hover', undefined, surface)
        await button.click(); await settle(page)
        await check(label, `${id}/verb`, owner!, 'expanded-hover', undefined, surface)
      }
    }, `/__contrast?docsSurface=${surface}`))
  }

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
