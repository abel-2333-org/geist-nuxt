import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createPage, setup } from '@nuxt/test-utils/e2e'
import { expect, test } from 'vitest'
import type { Locator, Page } from 'playwright-core'
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
type Measurement = Awaited<ReturnType<typeof measure>>
const route = '/kits/api-docs'
const settle = (page: Page) => page.waitForTimeout(300)

async function describe(target: Locator, tooltip: Locator) {
  return {
    target: await target.evaluate((node) => {
      const range = document.createRange()
      range.selectNodeContents(node)
      const css = getComputedStyle(node)
      return {
        text: node.textContent, rect: node.getBoundingClientRect().toJSON(), range: range.getBoundingClientRect().toJSON(),
        color: css.color, backgroundColor: css.backgroundColor, fontFamily: css.fontFamily, fontSize: css.fontSize,
        fontFeatureSettings: css.fontFeatureSettings, fontVariationSettings: css.fontVariationSettings,
        display: css.display, lineHeight: css.lineHeight, focused: document.activeElement === node,
      }
    }),
    tooltip: await tooltip.evaluate((node) => {
      const css = getComputedStyle(node)
      const popper = node.closest('[data-reka-popper-content-wrapper]') as HTMLElement | null
      const popperStyle = popper && getComputedStyle(popper)
      return {
        rect: node.getBoundingClientRect().toJSON(), state: node.getAttribute('data-state'), side: node.getAttribute('data-side'),
        boxShadow: css.boxShadow, outline: { style: css.outlineStyle, width: css.outlineWidth, offset: css.outlineOffset, color: css.outlineColor }, color: css.color, opacity: css.opacity, transform: css.transform,
        translate: css.translate, scale: css.scale, rotate: css.rotate, inlineStyle: node.getAttribute('style'),
        popper: popper && popperStyle ? { rect: popper.getBoundingClientRect().toJSON(), translate: popperStyle.translate, transform: popperStyle.transform, scale: popperStyle.scale, rotate: popperStyle.rotate, inlineStyle: popper.getAttribute('style') } : null,
      }
    }),
  }
}

async function glyphScenario(theme: Theme) {
  expect(typeof window).toBe('undefined')
  const page = await createPage(route)
  const records: Array<{ id: string, owner: string, route: string, theme: Theme, state: string } & Measurement> = []
  let platformFonts: unknown
  let failure: string | null = null
  const name = `${theme}-glyph-bounds`
  await page.context().tracing.start({ screenshots: true, snapshots: true })
  try {
    await page.setViewportSize({ width: 1440, height: 1000 })
    await page.evaluate((theme) => { (window as any).useNuxtApp().$colorMode.preference = theme }, theme)
    await expect.poll(() => page.locator('html').getAttribute('class')).toContain(theme)
    await page.evaluate(() => document.fonts.ready)
    const target = page.locator('[data-field-optional]').filter({ visible: true }).first()
    expect(await target.count(), 'the actual gallery must expose an optional notation trigger').toBe(1)
    await target.scrollIntoViewIfNeeded()
    // Tooltip closes on ancestor scrolling. Finish the real scroll before
    // opening it through focus, so the test observes the settled open state.
    await settle(page)
    await target.focus()
    const tooltip = page.locator('[data-reka-popper-content-wrapper] [data-slot="content"][data-side="top"]')
      .filter({ has: page.locator('[data-slot="text"]'), visible: true })
    await tooltip.waitFor({ state: 'visible' })
    await settle(page)
    expect(await tooltip.count(), 'focus opens exactly one actual Tooltip content').toBe(1)

    // Read the font used by this glyph, not a different sample on the page.
    await target.evaluate(node => node.setAttribute('data-glyph-bounds-target', ''))
    const cdp = await page.context().newCDPSession(page)
    await cdp.send('DOM.enable'); await cdp.send('CSS.enable')
    const documentNode = await cdp.send('DOM.getDocument')
    const fontNode = await cdp.send('DOM.querySelector', { nodeId: documentNode.root.nodeId, selector: '[data-glyph-bounds-target]' })
    platformFonts = await cdp.send('CSS.getPlatformFontsForNode', { nodeId: fontNode.nodeId })
    expect((platformFonts as { fonts: Array<{ isCustomFont: boolean, familyName: string }> }).fonts.some(font => font.isCustomFont && font.familyName.includes('Geist')), 'actual optional glyph renders with downloaded Geist').toBe(true)
    await cdp.detach()

    const capture = async (state: string, detail: Record<string, unknown>) => {
      await page.screenshot({ path: resolve(artifacts, `${name}-${state}.png`) })
      await writeFile(resolve(artifacts, `${name}-${state}.json`), JSON.stringify({ source, route, theme, state, computed: await describe(target, tooltip), ...detail }, null, 2))
    }
    const check = async (state: string) => {
      const result = await measure(target)
      records.push({ id: 'optional notation glyph', owner: 'FieldItem + Nuxt UI Tooltip', route, theme, state, ...result })
      await capture(state, { classification: 'positive glyph measurement', measurement: result })
      expect(result.ratio, `${theme}/${state}: normal glyph contrast`).toBeGreaterThanOrEqual(4.5)
      return result
    }
    const reject = async (state: string, detail: Record<string, unknown>) => {
      const detection = await measure(target).then(measurement => ({ measurement, rejection: null }), error => ({ measurement: null, rejection: String(error) }))
      await capture(state, { classification: 'expected detector rejection; not a positive suite red run', ...detail, ...detection })
      expect(detection.rejection, `${state}: paint must reject instead of returning a contrast ratio`).not.toBeNull()
      expect(detection.rejection, `${state}: rejection must fail closed`).toMatch(/unresolved:/)
    }

    const normal = await check('focused-tooltip')
    const original = await describe(target, tooltip)
    expect(original.target.text).toBe('?')
    expect(original.target.focused).toBe(true)
    expect(original.target.fontFeatureSettings).toBe('normal')
    expect(original.tooltip.boxShadow).not.toBe('none')
    expect(normal.textBounds.glyph, 'ordinary isolated Geist glyph permits a bounded top refinement').not.toBeNull()
    expect(normal.textBounds.used.top).toBeGreaterThan(normal.textBounds.raw.top)
    for (const edge of ['left', 'right', 'bottom'] as const) expect(normal.textBounds.used[edge], `never tighten ${edge}`).toBe(normal.textBounds.raw[edge])

    // Move the actual Tooltip shadow layers towards the glyph. Preserve their
    // original color, blur and spread; this does not create a surrogate overlay.
    const shifted = await tooltip.evaluate((node, glyph) => {
      const element = node as HTMLElement
      const rect = node.getBoundingClientRect()
      const shadow = getComputedStyle(node).boxShadow
      const offset = Math.ceil((glyph.top + glyph.bottom - rect.top - rect.bottom) / 2)
      const original = { value: element.style.getPropertyValue('box-shadow'), priority: element.style.getPropertyPriority('box-shadow') }
      let depth = 0
      let start = 0
      const layers: string[] = []
      for (let index = 0; index < shadow.length; index++) {
        if (shadow[index] === '(') depth++
        if (shadow[index] === ')') depth--
        if (shadow[index] === ',' && depth === 0) { layers.push(shadow.slice(start, index)); start = index + 1 }
      }
      layers.push(shadow.slice(start))
      const moved = layers.map((layer) => {
        let length = 0
        const shifted = layer.replace(/(-?[\d.]+)px/g, (text, number) => ++length === 2 ? `${Number(number) + offset}px` : text)
        if (length !== 4 || layer.includes('inset')) throw new Error('Unexpected actual Tooltip shadow serialization')
        return shifted
      }).join(',')
      element.style.setProperty('box-shadow', moved, 'important')
      return { original, before: shadow, after: getComputedStyle(node).boxShadow, offset, translatedBox: { left: rect.left, right: rect.right, top: rect.top + offset, bottom: rect.bottom + offset } }
    }, normal.textBounds.used)
    expect(shifted.after).not.toBe(shifted.before)
    expect(shifted.translatedBox.left).toBeLessThanOrEqual(normal.textBounds.used.left)
    expect(shifted.translatedBox.right).toBeGreaterThanOrEqual(normal.textBounds.used.right)
    expect(shifted.translatedBox.top).toBeLessThanOrEqual(normal.textBounds.used.top)
    expect(shifted.translatedBox.bottom).toBeGreaterThanOrEqual(normal.textBounds.used.bottom)
    await reject('tooltip-shadow-moved-over-glyph', { shifted, normalBounds: normal.textBounds })
    await tooltip.evaluate((node, original) => {
      const style = (node as HTMLElement).style
      if (original.value) style.setProperty('box-shadow', original.value, original.priority)
      else style.removeProperty('box-shadow')
    }, shifted.original)
    await check('tooltip-shadow-restored')

    const originalOutline = await tooltip.evaluate((node, shade) => {
      const style = (node as HTMLElement).style
      const original = { outline: style.getPropertyValue('outline'), priority: style.getPropertyPriority('outline') }
      style.setProperty('outline', `2px solid ${shade}`, 'important')
      return original
    }, normal.rawForeground)
    const distantOutline = await check('ordinary-outline-outside-glyph')
    expect(distantOutline.excludedPaint.some((paint: any) => paint.reason === 'outside verified Chromium ordinary outline bounds')).toBe(true)
    await tooltip.evaluate((node, shade) => (node as HTMLElement).style.setProperty('outline', `28px solid ${shade}`, 'important'), normal.rawForeground)
    await reject('ordinary-outline-over-glyph', { normalBounds: normal.textBounds })
    await tooltip.evaluate((node, original) => {
      const style = (node as HTMLElement).style
      if (original.outline) style.setProperty('outline', original.outline, original.priority)
      else style.removeProperty('outline')
    }, originalOutline)
    await check('ordinary-outline-restored')

    // Keep the real trigger and its glyph fixed. Two independent fractional
    // translations move the Tooltip, including its ordinary shadows, away.
    const originalTranslation = await tooltip.evaluate((node) => {
      const content = node as HTMLElement
      const popper = node.closest('[data-reka-popper-content-wrapper]') as HTMLElement | null
      if (!popper || popper === content) throw new Error('Tooltip must have its real separate Popper wrapper')
      const original = {
        content: { value: content.style.getPropertyValue('translate'), priority: content.style.getPropertyPriority('translate') },
        popper: { value: popper.style.getPropertyValue('translate'), priority: popper.style.getPropertyPriority('translate') },
        shadow: { value: content.style.getPropertyValue('box-shadow'), priority: content.style.getPropertyPriority('box-shadow') },
      }
      content.style.setProperty('translate', '480.25px 0.375px', 'important')
      popper.style.setProperty('translate', '64.375px 0.25px', 'important')
      return original
    })
    const translated = await describe(target, tooltip)
    expect(translated.tooltip.translate).toBe('480.25px 0.375px')
    expect(translated.tooltip.popper!.translate).toBe('64.375px 0.25px')
    expect(translated.target.range, 'moving the portal must not move the original glyph').toEqual(original.target.range)
    expect(translated.tooltip.rect.left, 'the translated Tooltip is truly separated horizontally').toBeGreaterThan(normal.textBounds.used.right)
    const separatedTranslation = await check('nested-fractional-translate-separated')
    expect(separatedTranslation.textBounds.used).toEqual(normal.textBounds.used)

    const projected = await tooltip.evaluate((node, { glyph, shade }) => {
      const rect = node.getBoundingClientRect()
      const x = (glyph.left + glyph.right - rect.left - rect.right) / 2
      const y = (glyph.top + glyph.bottom - rect.top - rect.bottom) / 2
      ;(node as HTMLElement).style.setProperty('box-shadow', `${x}px ${y}px 0px 0px ${shade}`, 'important')
      const boxShadow = getComputedStyle(node).boxShadow
      const lengths = Array.from(boxShadow.matchAll(/(-?[\d.]+)px/g), match => Number(match[1]))
      if (lengths.length !== 4) throw new Error('Controlled translated Tooltip shadow must expose four lengths')
      // Record the browser's computed offsets, not the requested CSS string.
      return { boxShadow, lengths, caster: rect.toJSON(), bounds: { left: rect.left + lengths[0]!, right: rect.right + lengths[0]!, top: rect.top + lengths[1]!, bottom: rect.bottom + lengths[1]! } }
    }, { glyph: normal.textBounds.used, shade: normal.rawForeground })
    expect(projected.lengths.slice(2)).toEqual([0, 0])
    expect(projected.caster.left).toBeGreaterThan(normal.textBounds.used.right)
    expect(projected.bounds.left).toBeLessThanOrEqual(normal.textBounds.used.left)
    expect(projected.bounds.right).toBeGreaterThanOrEqual(normal.textBounds.used.right)
    expect(projected.bounds.top).toBeLessThanOrEqual(normal.textBounds.used.top)
    expect(projected.bounds.bottom).toBeGreaterThanOrEqual(normal.textBounds.used.bottom)
    await reject('nested-fractional-translate-shadow-over-glyph', { projected, normalBounds: normal.textBounds })
    await tooltip.evaluate((node, original) => {
      const style = (node as HTMLElement).style
      if (original.value) style.setProperty('box-shadow', original.value, original.priority)
      else style.removeProperty('box-shadow')
    }, originalTranslation.shadow)
    await check('nested-fractional-translate-shadow-restored')
    await tooltip.evaluate((node, original) => {
      const popper = node.closest('[data-reka-popper-content-wrapper]') as HTMLElement
      for (const [element, saved] of [[node as HTMLElement, original.content], [popper, original.popper]] as const) {
        if (saved.value) element.style.setProperty('translate', saved.value, saved.priority)
        else element.style.removeProperty('translate')
      }
    }, originalTranslation)
    const translationRestored = await check('individual-translate-restored')
    expect(translationRestored.textBounds.used).toEqual(normal.textBounds.used)

    // Natural Tooltip shadows can miss even the raw Range by a fraction of a
    // pixel. On the same Tooltip, place an unblurred shadow bottom strictly
    // between raw and refined tops to test the font-feature guard deliberately.
    const guardShadow = await tooltip.evaluate((node, { bounds, shade }) => {
      const rect = node.getBoundingClientRect()
      const x = (bounds.raw.left + bounds.raw.right - rect.left - rect.right) / 2
      const y = (bounds.raw.top + bounds.used.top) / 2 - rect.bottom
      ;(node as HTMLElement).style.setProperty('box-shadow', `${x}px ${y}px 0px 0px ${shade}`, 'important')
      const boxShadow = getComputedStyle(node).boxShadow
      const lengths = Array.from(boxShadow.matchAll(/(-?[\d.]+)px/g), match => Number(match[1]))
      if (lengths.length !== 4) throw new Error('Controlled guard shadow must expose four lengths')
      return { boxShadow, lengths, caster: rect.toJSON(), bounds: { left: rect.left + lengths[0]!, right: rect.right + lengths[0]!, top: rect.top + lengths[1]!, bottom: rect.bottom + lengths[1]! } }
    }, { bounds: normal.textBounds, shade: normal.rawForeground })
    expect(guardShadow.lengths.slice(2)).toEqual([0, 0])
    expect(guardShadow.bounds.left).toBeLessThan(normal.textBounds.raw.right)
    expect(guardShadow.bounds.right).toBeGreaterThan(normal.textBounds.raw.left)
    expect(guardShadow.bounds.top).toBeLessThan(normal.textBounds.raw.bottom)
    expect(guardShadow.bounds.bottom).toBeGreaterThan(normal.textBounds.raw.top)
    expect(guardShadow.bounds.bottom).toBeLessThan(normal.textBounds.used.top)
    await capture('font-feature-controlled-shadow-geometry', { guardShadow, normalBounds: normal.textBounds })
    const guardedNormal = await check('font-feature-controlled-shadow-refined')
    expect(guardedNormal.textBounds.used).toEqual(normal.textBounds.used)

    const originalFeature = await target.evaluate((node) => {
      const style = (node as HTMLElement).style
      const original = { value: style.getPropertyValue('font-feature-settings'), priority: style.getPropertyPriority('font-feature-settings') }
      style.setProperty('font-feature-settings', '"liga" 0', 'important')
      return original
    })
    await tooltip.evaluate(node => (node as HTMLElement).style.setProperty('box-shadow', 'none', 'important'))
    const raw = await check('font-feature-guard-without-shadow')
    expect((await describe(target, tooltip)).target.fontFeatureSettings).not.toBe('normal')
    expect(raw.textBounds.glyph, 'an unsupported font feature must disable glyph refinement').toBeNull()
    expect(raw.textBounds.used, 'guard fallback must retain the original unclipped Range').toEqual(raw.textBounds.raw)
    expect(raw.textBounds.raw, 'font-feature fallback uses the geometrically verified Range').toEqual(normal.textBounds.raw)
    await tooltip.evaluate((node, shadow) => (node as HTMLElement).style.setProperty('box-shadow', shadow, 'important'), guardShadow.boxShadow)
    expect((await describe(target, tooltip)).tooltip.boxShadow).toBe(guardShadow.boxShadow)
    await reject('font-feature-guard-with-controlled-shadow', { guardShadow, fallbackBounds: raw.textBounds })
    await target.evaluate((node, original) => {
      const style = (node as HTMLElement).style
      if (original.value) style.setProperty('font-feature-settings', original.value, original.priority)
      else style.removeProperty('font-feature-settings')
    }, originalFeature)
    const controlledRestored = await check('font-feature-restored-with-controlled-shadow')
    expect(controlledRestored.textBounds.glyph).not.toBeNull()
    expect(controlledRestored.textBounds.used).toEqual(normal.textBounds.used)
    await tooltip.evaluate((node, original) => {
      const style = (node as HTMLElement).style
      if (original.value) style.setProperty('box-shadow', original.value, original.priority)
      else style.removeProperty('box-shadow')
    }, shifted.original)
    expect((await describe(target, tooltip)).tooltip.boxShadow).toBe(original.tooltip.boxShadow)
    const restored = await check('font-feature-restored')
    expect(restored.textBounds.glyph).not.toBeNull()
    expect(restored.textBounds.used).toEqual(normal.textBounds.used)
    expect(records.length, 'the scenario must retain normal measurements around each rejection').toBeGreaterThan(0)
  }
  catch (error) { failure = String(error); throw error }
  finally {
    const fonts = await page.evaluate(() => Array.from(document.fonts).map(font => ({ family: font.family, status: font.status })))
    await page.screenshot({ path: resolve(artifacts, `${name}.png`), fullPage: true })
    const report = { source, browser: page.context().browser()?.version(), fonts, platformFonts, failure, records }
    await page.context().tracing.stop({ path: resolve(artifacts, `${name}.zip`) })
    await page.context().close()
    // Expected-rejection sidecars are not positive records or full-command red
    // evidence. Publish this report only after capture and cleanup both succeed.
    await writeFile(resolve(artifacts, `${name}.json`), JSON.stringify(report, null, 2))
  }
}

for (const theme of ['light', 'dark'] as const) {
  test(`${theme}: actual Tooltip keeps glyph refinement and font-feature fallback conservative`, () => glyphScenario(theme))
}
