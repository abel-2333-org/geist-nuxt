import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createPage, setup } from '@nuxt/test-utils/e2e'
import { expect, test } from 'vitest'
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
const route = '/__contrast'

async function pseudoOutlineScenario(theme: Theme) {
  expect(typeof window).toBe('undefined')
  const page = await createPage(route)
  const records: Array<{ id: string, owner: string, route: string, theme: Theme, state: string } & Measurement> = []
  const rejections: Array<{ state: string, measurement: Measurement | null, rejection: string | null }> = []
  let platformFonts: unknown
  let failure: string | null = null
  const name = `${theme}-pseudo-outline`
  await page.context().tracing.start({ screenshots: true, snapshots: true })
  try {
    await page.setViewportSize({ width: 1440, height: 1000 })
    await page.evaluate((theme) => { (window as any).useNuxtApp().$colorMode.preference = theme }, theme)
    await expect.poll(() => page.locator('html').getAttribute('class')).toContain(theme)
    await page.evaluate(() => document.fonts.ready)
    await page.evaluate(() => {
      const host = document.createElement('section')
      host.id = 'pseudo-outline-control'
      Object.assign(host.style, { position: 'relative', isolation: 'isolate', width: '640px', height: '160px', padding: '32px', backgroundColor: 'var(--ui-bg)', color: 'var(--ui-text)', fontSize: '16px', lineHeight: '24px' })
      const overlay = document.createElement('div')
      overlay.id = 'pseudo-outline-host'
      Object.assign(overlay.style, { position: 'relative', zIndex: '1', width: '536px', height: '56px' })
      const branch = document.createElement('div')
      Object.assign(branch.style, { position: 'absolute', left: '32px', top: '32px', width: '536px', padding: '12px', backgroundColor: 'var(--ui-bg)' })
      const target = document.createElement('span')
      target.id = 'pseudo-outline-target'
      target.textContent = 'Actual browser paint must stay readable'
      branch.append(target)
      host.append(overlay, branch)
      document.querySelector('[data-testid="contrast-fixture"]')!.prepend(host)
    })
    await page.addStyleTag({ content: `
      #pseudo-outline-host::before, #pseudo-outline-host::after {
        content: ""; display: none; position: absolute; left: 0;
        top: var(--pseudo-top); width: 536px; height: 1px;
        box-sizing: border-box; padding: 0; margin: 0; border: 0;
        background: transparent; box-shadow: none;
        outline: var(--pseudo-outline, none); outline-offset: 0;
      }
      #pseudo-outline-host[data-pseudo="before"]::before { display: block; }
      #pseudo-outline-host[data-pseudo="after"]::after { display: block; background: currentColor; }
    ` })
    const target = page.locator('#pseudo-outline-target')
    const overlay = page.locator('#pseudo-outline-host')
    await target.scrollIntoViewIfNeeded()
    await page.waitForTimeout(300)
    await page.evaluate(() => {
      const target = document.getElementById('pseudo-outline-target')!
      const overlay = document.getElementById('pseudo-outline-host')!
      const range = document.createRange()
      range.selectNodeContents(target)
      // The 1px pseudo box stays below the text. A 40px outline later extends
      // its top band across the whole ordinary 16px text Range.
      overlay.style.setProperty('--pseudo-top', `${range.getBoundingClientRect().bottom + 8 - overlay.getBoundingClientRect().top}px`)
    })
    const cdp = await page.context().newCDPSession(page)
    await cdp.send('DOM.enable'); await cdp.send('CSS.enable')
    const documentNode = await cdp.send('DOM.getDocument')
    const fontNode = await cdp.send('DOM.querySelector', { nodeId: documentNode.root.nodeId, selector: '#pseudo-outline-target' })
    platformFonts = await cdp.send('CSS.getPlatformFontsForNode', { nodeId: fontNode.nodeId })
    expect((platformFonts as { fonts: Array<{ isCustomFont: boolean, familyName: string }> }).fonts.some(font => font.isCustomFont && font.familyName.includes('Geist')), 'the actual measured text renders with downloaded Geist').toBe(true)
    await cdp.detach()

    for (const kind of ['before', 'after'] as const) {
      await overlay.evaluate((node, kind) => node.setAttribute('data-pseudo', kind), kind)
      const describe = () => overlay.evaluate((node, kind) => {
        const target = document.getElementById('pseudo-outline-target')!
        const range = document.createRange()
        range.selectNodeContents(target)
        const text = range.getBoundingClientRect()
        const host = node.getBoundingClientRect()
        const css = getComputedStyle(node)
        const pseudo = getComputedStyle(node, `::${kind}`)
        // This controlled absolute box has zero border/padding/margin and a
        // relative containing block. DOM APIs do not expose a pseudo rect.
        const left = host.left + parseFloat(pseudo.left)
        const top = host.top + parseFloat(pseudo.top)
        const box = { left, top, right: left + parseFloat(pseudo.width), bottom: top + parseFloat(pseudo.height) }
        const width = parseFloat(pseudo.outlineWidth)
        const offset = parseFloat(pseudo.outlineOffset)
        return {
          targetRect: target.getBoundingClientRect().toJSON(), textRect: text.toJSON(), targetColor: getComputedStyle(target).color,
          host: { rect: host.toJSON(), position: css.position, zIndex: css.zIndex, backgroundColor: css.backgroundColor, outline: css.outline, boxShadow: css.boxShadow },
          pseudo: {
            name: `::${kind}`, content: pseudo.content, display: pseudo.display, visibility: pseudo.visibility, opacity: pseudo.opacity,
            backgroundColor: pseudo.backgroundColor, backgroundImage: pseudo.backgroundImage, color: pseudo.color,
            borderWidths: [pseudo.borderTopWidth, pseudo.borderRightWidth, pseudo.borderBottomWidth, pseudo.borderLeftWidth], boxShadow: pseudo.boxShadow,
            position: pseudo.position, left: pseudo.left, top: pseudo.top, width: pseudo.width, height: pseudo.height,
            outline: { style: pseudo.outlineStyle, width: pseudo.outlineWidth, offset: pseudo.outlineOffset, color: pseudo.outlineColor },
            box, topOutlineBand: { left: box.left - width - offset, right: box.right + width + offset, top: box.top - width - offset, bottom: box.top - offset },
          },
        }
      }, kind)
      const capture = async (state: string, detail: Record<string, unknown>) => {
        await page.locator('#pseudo-outline-control').screenshot({ path: resolve(artifacts, `${name}-${state}.png`) })
        await writeFile(resolve(artifacts, `${name}-${state}.json`), JSON.stringify({ source, route, theme, kind, state, computed: await describe(), ...detail }, null, 2))
      }
      const check = async (state: string) => {
        const measurement = await measure(target)
        records.push({ id: 'pseudo outline control', owner: 'measurement contract', route, theme, state, ...measurement })
        await capture(state, { classification: 'positive detector control', measurement })
        expect(measurement.ratio, `${theme}/${state}: unobstructed text contrast`).toBeGreaterThanOrEqual(4.5)
        return measurement
      }
      const baseline = await check(`${kind}-without-outline`)
      const normal = await describe()
      expect(normal.host.position, 'relative sibling enables the bounded pseudo-box early return').toBe('relative')
      expect(normal.pseudo.content).toBe('""')
      expect(normal.pseudo.borderWidths.every(width => parseFloat(width) === 0)).toBe(true)
      expect(normal.pseudo.boxShadow).toBe('none')
      expect(normal.pseudo.backgroundImage).toBe('none')
      expect(normal.pseudo.outline.style).toBe('none')
      expect(normal.pseudo.box.top, 'the pseudo box itself does not touch text').toBeGreaterThan(normal.textRect.bottom)
      expect(normal.pseudo.backgroundColor).toBe(kind === 'before' ? 'rgba(0, 0, 0, 0)' : normal.targetColor)

      await overlay.evaluate(node => (node as HTMLElement).style.setProperty('--pseudo-outline', '40px solid transparent'))
      const transparent = await check(`${kind}-transparent-outline`)
      expect((await describe()).pseudo.outline.color).toBe('rgba(0, 0, 0, 0)')
      expect(transparent.ratio, 'a fully transparent outline does not paint').toBe(baseline.ratio)
      await overlay.evaluate(node => (node as HTMLElement).style.setProperty('--pseudo-outline', '0px solid currentColor'))
      const zeroWidth = await check(`${kind}-zero-width-outline`)
      expect((await describe()).pseudo.outline.width).toBe('0px')
      expect(zeroWidth.ratio, 'a zero-width outline does not paint').toBe(baseline.ratio)

      await overlay.evaluate(node => (node as HTMLElement).style.setProperty('--pseudo-outline', '40px solid currentColor'))
      const outlined = await describe()
      expect(outlined.pseudo.outline.style).toBe('solid')
      expect(outlined.pseudo.outline.color).toBe(outlined.targetColor)
      expect(outlined.pseudo.box).toEqual(normal.pseudo.box)
      expect(outlined.pseudo.topOutlineBand.left).toBeLessThanOrEqual(outlined.textRect.left)
      expect(outlined.pseudo.topOutlineBand.right).toBeGreaterThanOrEqual(outlined.textRect.right)
      expect(outlined.pseudo.topOutlineBand.top).toBeLessThanOrEqual(outlined.textRect.top)
      expect(outlined.pseudo.topOutlineBand.bottom).toBeGreaterThanOrEqual(outlined.textRect.bottom)
      const detection = await measure(target).then(measurement => ({ measurement, rejection: null }), error => ({ measurement: null, rejection: String(error) }))
      const state = `${kind}-outline-over-text`
      rejections.push({ state, ...detection })
      await capture(state, { classification: 'expected detector rejection; not a positive suite red run', ...detection })

      await overlay.evaluate(node => (node as HTMLElement).style.removeProperty('--pseudo-outline'))
      const restored = await check(`${kind}-outline-removed`)
      expect(restored.ratio, 'removing only the outline restores the exact original ratio').toBe(baseline.ratio)
      expect(restored.effectiveForeground).toEqual(baseline.effectiveForeground)
      expect(restored.effectiveBackground).toEqual(baseline.effectiveBackground)
    }

    // Capture both independent early-return failures before asserting either.
    // These assertions fail the real scenario when the detector silently passes;
    // an expected rejection sidecar alone is never full-command red evidence.
    for (const detection of rejections) {
      expect(detection.rejection, `${detection.state}: visible pseudo outline must reject instead of returning a ratio`).not.toBeNull()
      expect(detection.rejection, `${detection.state}: fail closed for unmodeled paint`).toMatch(/unresolved:/)
    }
    expect(records.length, 'the scenario retains real normal and restored measurements').toBeGreaterThan(0)
  }
  catch (error) { failure = String(error); throw error }
  finally {
    const fonts = await page.evaluate(() => Array.from(document.fonts).map(font => ({ family: font.family, status: font.status })))
    await page.screenshot({ path: resolve(artifacts, `${name}.png`), fullPage: true })
    const report = { source, browser: page.context().browser()?.version(), fonts, platformFonts, failure, records, rejections }
    await page.context().tracing.stop({ path: resolve(artifacts, `${name}.zip`) })
    await page.context().close()
    await writeFile(resolve(artifacts, `${name}.json`), JSON.stringify(report, null, 2))
  }
}

for (const theme of ['light', 'dark'] as const) {
  test(`${theme}: pseudo outlines cannot bypass empty-paint or separated-box guards`, () => pseudoOutlineScenario(theme))
}
