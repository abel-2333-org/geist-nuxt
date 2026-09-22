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
const localeFont = (await readFile(resolve(root, 'tests/fixtures/contrast/generated-paint-locale/locale.ttf'))).toString('base64')
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

for (const theme of ['light', 'dark'] as const) {
  test(`${theme}: generated marker and absolute link paint require geometry proof`, async () => {
    const page = await createPage('/__contrast')
    const evidence: Array<Record<string, unknown>> = []
    await page.context().tracing.start({ screenshots: true, snapshots: true })
    try {
      await page.setViewportSize({ width: 1440, height: 1000 })
      await page.evaluate(theme => { (window as any).useNuxtApp().$colorMode.preference = theme }, theme)
      await expect.poll(() => page.locator('html').getAttribute('class')).toContain(theme)
      await page.evaluate(() => document.fonts.ready)
      await page.evaluate(() => {
        const control = document.createElement('section')
        control.id = 'generated-paint-control'
        control.lang = 'en'
        control.innerHTML = `<div id="marker-region"><label id="marker-host">Required field</label><p id="marker-error">Enter a valid value.</p></div>
          <div id="underlay-row"><a id="underlay-link" href="#paint-control" aria-label="Paint control"></a><div id="underlay-branch"><span id="underlay-text">GET</span></div></div>`
        document.querySelector('[data-testid="contrast-fixture"]')!.prepend(control)
      })
      await page.addStyleTag({ content: `
        #generated-paint-control { position: relative; padding: 40px; margin: 20px; background: var(--ui-bg); color: var(--ui-text); font: 500 14px/20px Geist; }
        #marker-region { position: relative; height: 130px; }
        #marker-host { color: var(--ui-text); }
        #marker-host::after { content: var(--marker-content, '*'); color: var(--marker-color, var(--ui-text)); -webkit-text-fill-color: var(--marker-fill, currentColor); margin-left: var(--marker-gap, 4px); font-style: var(--marker-font-style, normal); outline: var(--marker-outline, none); text-shadow: var(--marker-shadow, none); }
        #marker-error { margin-top: 30px; color: var(--ui-text); }
        #underlay-row { position: relative; width: 480px; min-height: 44px; }
        #underlay-link { position: absolute; inset: 0; background: var(--ui-bg-elevated); border-radius: 6px; }
        #underlay-branch { position: relative; padding: 12px 20px; pointer-events: none; }
      ` })
      const region = page.locator('#generated-paint-control')
      const marker = page.locator('#marker-host')
      const error = page.locator('#marker-error')
      const link = page.locator('#underlay-link')
      const text = page.locator('#underlay-text')
      await region.scrollIntoViewIfNeeded()
      const describe = () => page.evaluate(() => {
        const snapshot = (id: string) => {
          const node = document.getElementById(id)!, css = getComputedStyle(node)
          const range = document.createRange(); range.selectNodeContents(node)
          return { rect: node.getBoundingClientRect().toJSON(), range: range.getBoundingClientRect().toJSON(), text: node.textContent,
            childNodes: Array.from(node.childNodes, child => ({ type: child.nodeType, data: child instanceof CharacterData ? child.data : null, name: child.nodeName })),
            style: { display: css.display, order: css.order, position: css.position, zIndex: css.zIndex, backgroundColor: css.backgroundColor, color: css.color, opacity: css.opacity, borderRadius: css.borderRadius, transform: css.transform } }
        }
        const pseudo = getComputedStyle(document.getElementById('marker-host')!, '::after')
        return { marker: snapshot('marker-host'), error: snapshot('marker-error'), text: snapshot('underlay-text'), link: snapshot('underlay-link'),
          row: snapshot('underlay-row'), branch: snapshot('underlay-branch'),
          linkBeforeBranch: !!(document.getElementById('underlay-link')!.compareDocumentPosition(document.getElementById('underlay-branch')!) & Node.DOCUMENT_POSITION_FOLLOWING),
          pseudo: { content: pseudo.content, color: pseudo.color, textFillColor: pseudo.webkitTextFillColor, locale: pseudo.getPropertyValue('-webkit-locale'), outline: pseudo.outline, shadow: pseudo.textShadow, margin: pseudo.marginLeft, fontStyle: pseudo.fontStyle } }
      })
      const capture = async (state: string, result: Record<string, unknown>) => {
        const detail = { state, theme, source, computed: await describe(), ...result }
        evidence.push(detail)
        await writeFile(resolve(artifacts, `${theme}-generated-paint-${state}.json`), JSON.stringify(detail, null, 2))
        await region.screenshot({ path: resolve(artifacts, `${theme}-generated-paint-${state}.png`) })
      }
      const positive = async (state: string, target = marker, pseudo: '::after' | null = '::after') => {
        const measurement = await measure(target, pseudo)
        await capture(state, { classification: 'positive detector control', measurement })
        expect(measurement.ratio).toBeGreaterThanOrEqual(4.5)
        return measurement
      }
      const reject = async (state: string, target = marker, pseudo: '::after' | null = '::after', reason = 'unresolved:') => {
        let measurement: Measurement | null = null, rejection: string | null = null
        try { measurement = await measure(target, pseudo) }
        catch (error) { rejection = error instanceof Error ? error.message : String(error) }
        await capture(state, { classification: 'negative detector control', measurement, rejection })
        expect(measurement).toBeNull()
        expect(rejection).toContain(reason)
      }
      const markerNormal = await positive('marker-normal')
      expect(markerNormal.text).toBe('*')
      expect(markerNormal.generatedText?.text).toBe('*')
      expect(markerNormal.generatedText?.platformFonts).toMatchObject({ fonts: [expect.objectContaining({ familyName: 'Geist', isCustomFont: true, glyphCount: 1 })] })
      expect(markerNormal.rawForeground).toBe((await describe()).pseudo.color)
      const errorNormal = await positive('required-error-normal', error, null)
      expect(errorNormal.excludedPaint.some(paint => paint.reason === 'outside verified CDP generated text bounds')).toBe(true)

      await marker.evaluate(node => (node as HTMLElement).style.setProperty('--marker-color', 'var(--ui-bg)'))
      const lowContrast = await measure(marker, '::after')
      await capture('marker-low-contrast', { classification: 'numeric negative control', measurement: lowContrast })
      expect(lowContrast.ratio).toBe(1)
      await marker.evaluate(node => (node as HTMLElement).style.removeProperty('--marker-color'))
      expect((await positive('marker-color-restored')).ratio).toBe(markerNormal.ratio)

      for (const [property, value, state] of [
        ['--marker-fill', 'var(--ui-bg)', 'marker-background-text-fill'],
        ['--marker-outline', '30px solid currentColor', 'marker-visible-outline'],
        ['--marker-outline', 'auto', 'marker-auto-outline'],
        ['--marker-shadow', '0 30px currentColor', 'marker-text-shadow'],
        ['--marker-font-style', 'italic', 'marker-italic'],
        ['--marker-content', '"**"', 'marker-multiple-glyphs'],
        ['--marker-gap', '-12px', 'marker-overlaps-host'],
      ]) {
        await marker.evaluate((node, [property, value]) => (node as HTMLElement).style.setProperty(property!, value!), [property!, value!])
        await reject(state!)
        await marker.evaluate((node, property) => (node as HTMLElement).style.removeProperty(property), property!)
        expect((await positive(`${state}-restored`)).ratio).toBe(markerNormal.ratio)
      }

      for (const [attribute, value, state] of [
        ['lang', '', 'marker-unknown-language'], ['xml:lang', 'tr', 'marker-xml-language'],
      ]) {
        await marker.evaluate((node, [attribute, value]) => node.setAttribute(attribute!, value!), [attribute!, value!])
        await reject(state!)
        await marker.evaluate((node, attribute) => node.removeAttribute(attribute), attribute!)
        expect((await positive(`${state}-restored`)).ratio).toBe(markerNormal.ratio)
      }

      // Move the real inline generated text onto the independent error Range;
      // the host remains an ordinary untranslated box and retains its content.
      await marker.evaluate(node => {
        const label = node as HTMLElement, error = document.getElementById('marker-error')!
        label.style.position = 'absolute'
        const parent = label.parentElement!.getBoundingClientRect(), errorBox = error.getBoundingClientRect()
        const range = document.createRange(); range.selectNodeContents(label)
        const width = range.getBoundingClientRect().width
        Object.assign(label.style, { position: 'absolute', top: `${errorBox.top - parent.top}px`, left: `${errorBox.left - parent.left - width + 15}px` })
      })
      await reject('marker-overlaps-error', error, null, 'overlapping generated text')
      await marker.evaluate(node => { for (const name of ['position', 'top', 'left']) (node as HTMLElement).style.removeProperty(name) })
      expect((await positive('error-position-restored', error, null)).ratio).toBe(errorNormal.ratio)
      await marker.evaluate(node => (node as HTMLElement).style.setProperty('--marker-content', 'none'))
      await reject('marker-removed')
      const removed = await positive('error-marker-removed', error, null)
      expect(removed.excludedPaint.some(paint => paint.reason === 'outside verified CDP generated text bounds')).toBe(false)
      await marker.evaluate(node => (node as HTMLElement).style.removeProperty('--marker-content'))
      await positive('marker-presence-restored')

      const underlayNormal = await positive('underlay-normal', text, null)
      expect(underlayNormal.layers.flatMap(layer => layer.underlays).some(paint => paint.kind === 'absolute-link-underlay')).toBe(true)
      for (const [property, value, state] of [
        ['z-index', '2', 'underlay-higher-stack'],
        ['width', '25px', 'underlay-partial-coverage'],
        ['border-radius', '50%', 'underlay-rounded-corner'],
        ['transform', 'translateX(1px)', 'underlay-transformed'],
      ]) {
        await link.evaluate((node, [property, value]) => (node as HTMLElement).style.setProperty(property!, value!), [property!, value!])
        await reject(state!, text, null)
        await link.evaluate((node, property) => (node as HTMLElement).style.removeProperty(property), property!)
        expect((await positive(`${state}-restored`, text, null)).ratio).toBe(underlayNormal.ratio)
      }
      for (const display of ['flex', 'grid']) {
        await page.evaluate(display => {
          document.getElementById('underlay-row')!.style.display = display
          document.getElementById('underlay-branch')!.style.order = '-1'
        }, display)
        await reject(`underlay-${display}-order`, text, null)
        await page.evaluate(() => {
          document.getElementById('underlay-row')!.style.removeProperty('display')
          document.getElementById('underlay-branch')!.style.removeProperty('order')
        })
        expect((await positive(`underlay-${display}-restored`, text, null)).ratio).toBe(underlayNormal.ratio)
      }
      await page.locator('#underlay-branch').evaluate(node => (node as HTMLElement).style.display = 'contents')
      await reject('underlay-branch-contents', text, null)
      await page.locator('#underlay-branch').evaluate(node => (node as HTMLElement).style.removeProperty('display'))
      expect((await positive('underlay-branch-box-restored', text, null)).ratio).toBe(underlayNormal.ratio)
      await link.evaluate(node => node.append(document.createComment('['), document.createComment(']')))
      expect((await positive('underlay-comments-only', text, null)).ratio).toBe(underlayNormal.ratio)
      await link.evaluate(node => node.replaceChildren())
      await positive('underlay-comments-removed', text, null)
      await link.evaluate(node => node.append(document.createTextNode(''), document.createTextNode('')))
      expect((await positive('underlay-zero-length-text', text, null)).ratio).toBe(underlayNormal.ratio)
      for (const [content, state] of [[' ', 'underlay-whitespace-text'], ['\n', 'underlay-newline-text'], ['Overlay text', 'underlay-nonempty-text']]) {
        await link.evaluate((node, content) => { (node.firstChild as Text).data = content }, content!)
        await reject(state!, text, null)
        await link.evaluate(node => { (node.firstChild as Text).data = '' })
        expect((await positive(`${state}-restored`, text, null)).ratio).toBe(underlayNormal.ratio)
      }
      await link.evaluate(node => node.replaceChildren(document.createElement('span')))
      await reject('underlay-empty-element', text, null)
      await link.evaluate(node => node.replaceChildren())
      expect((await positive('underlay-empty-element-removed', text, null)).ratio).toBe(underlayNormal.ratio)
      await text.evaluate(node => Object.assign((node as HTMLElement).style, { position: 'relative', zIndex: '-1' }))
      await reject('underlay-target-negative-stack', text, null)
      await text.evaluate(node => { for (const name of ['position', 'z-index']) (node as HTMLElement).style.removeProperty(name) })
      await positive('underlay-target-stack-restored', text, null)
      await link.evaluate(node => { node.parentElement!.append(node) })
      await reject('underlay-later-dom-order', text, null, 'unverified sibling stacking order')
      await link.evaluate(node => node.parentElement!.prepend(node))
      await positive('underlay-order-restored', text, null)
      await link.evaluate(node => { node.textContent = 'Overlay text' })
      await reject('underlay-with-content', text, null)
      await link.evaluate(node => { node.textContent = '' })
      await positive('underlay-content-removed', text, null)
      await link.evaluate(node => (node as HTMLElement).style.backgroundColor = 'transparent')
      const cleared = await positive('underlay-paint-removed', text, null)
      expect(cleared.layers.flatMap(layer => layer.underlays).some(paint => paint.kind === 'absolute-link-underlay')).toBe(false)
      await link.evaluate(node => (node as HTMLElement).style.removeProperty('background-color'))
      expect((await positive('underlay-paint-restored', text, null)).ratio).toBe(underlayNormal.ratio)
    }
    finally {
      await writeFile(resolve(artifacts, `${theme}-generated-paint.json`), JSON.stringify({ source, theme, evidence }, null, 2))
      await page.context().tracing.stop({ path: resolve(artifacts, `${theme}-generated-paint-trace.zip`) })
      await page.close()
    }
  })

  test(`${theme}: generated ink follows the DOM language`, async () => {
    const page = await createPage('/__contrast')
    const evidence: Array<Record<string, unknown>> = []
    await page.context().tracing.start({ screenshots: true, snapshots: true })
    try {
      await page.setViewportSize({ width: 1440, height: 1000 })
      await page.evaluate(theme => { (window as any).useNuxtApp().$colorMode.preference = theme }, theme)
      await expect.poll(() => page.locator('html').getAttribute('class')).toContain(theme)
      await page.evaluate(() => {
        const control = document.createElement('section')
        control.id = 'locale-paint-control'
        control.lang = 'en'
        control.innerHTML = '<label id="locale-marker" lang="en">Required field</label><span id="locale-error">ERROR TEXT</span>'
        document.querySelector('[data-testid="contrast-fixture"]')!.prepend(control)
      })
      await page.addStyleTag({ content: `
        @font-face { font-family: ReviewLocale; src: url(data:font/ttf;base64,${localeFont}); }
        #locale-paint-control { position: relative; width: 720px; height: 150px; margin: 20px; background: var(--ui-bg); color: var(--ui-text); }
        #locale-marker { position: absolute; left: 40px; top: 60px; font: 20px Arial; }
        #locale-marker::after { content: var(--locale-content, '*'); font-family: ReviewLocale; margin-left: 4px; }
        #locale-error { position: absolute; left: 195px; top: 62px; font: 20px Arial; }
      ` })
      await page.evaluate(async () => { await document.fonts.load('20px ReviewLocale', '*'); await document.fonts.ready })
      const marker = page.locator('#locale-marker'), error = page.locator('#locale-error'), region = page.locator('#locale-paint-control')
      await region.scrollIntoViewIfNeeded()
      const computed = () => page.evaluate(() => {
        const marker = document.getElementById('locale-marker')!, error = document.getElementById('locale-error')!
        const range = document.createRange(); range.selectNodeContents(error)
        const pseudo = getComputedStyle(marker, '::after')
        const canvas = document.createElement('canvas').getContext('2d')! as CanvasRenderingContext2D & { lang: string }
        canvas.font = '400 20px ReviewLocale'
        const metrics = ['en', 'tr'].map(language => {
          canvas.lang = language
          const metric = canvas.measureText('*')
          return { language, width: metric.width, right: metric.actualBoundingBoxRight, left: metric.actualBoundingBoxLeft,
            fontAscent: metric.fontBoundingBoxAscent, fontDescent: metric.fontBoundingBoxDescent }
        })
        return { language: marker.getAttribute('lang'), locale: pseudo.getPropertyValue('-webkit-locale'),
          marker: marker.getBoundingClientRect().toJSON(), error: range.getBoundingClientRect().toJSON(), metrics }
      })
      const capture = async (state: string, details: Record<string, unknown>) => {
        const record = { state, source, theme, computed: await computed(), ...details }
        evidence.push(record)
        await writeFile(resolve(artifacts, `${theme}-generated-locale-${state}.json`), JSON.stringify(record, null, 2))
        await region.screenshot({ path: resolve(artifacts, `${theme}-generated-locale-${state}.png`) })
      }
      const normal = await measure(error)
      await capture('english-separated', { classification: 'positive detector control', measurement: normal })
      expect(normal.ratio).toBeGreaterThanOrEqual(4.5)
      const english = normal.excludedPaint.find(paint => paint.reason === 'outside verified CDP generated text bounds')
      expect(english.language).toBe('en')
      expect(english.platformFonts).toMatchObject({ fonts: [expect.objectContaining({ familyName: 'ReviewLocale', glyphCount: 1 })] })
      const initial = await computed()
      expect(initial.metrics[0]!.width).toBe(initial.metrics[1]!.width)
      expect(initial.metrics[0]!.fontAscent).toBe(initial.metrics[1]!.fontAscent)
      expect(initial.metrics[0]!.fontDescent).toBe(initial.metrics[1]!.fontDescent)
      expect(initial.metrics[1]!.right).toBeGreaterThan(initial.metrics[0]!.right)
      expect(english.box.right).toBeLessThan(initial.error.left)

      await marker.evaluate(node => node.setAttribute('lang', 'tr'))
      let measurement: Measurement | null = null, rejection: string | null = null
      try { measurement = await measure(error) }
      catch (error) { rejection = error instanceof Error ? error.message : String(error) }
      await capture('turkish-ink-overlap', { classification: 'negative detector control', measurement, rejection })
      expect(measurement).toBeNull()
      expect(rejection).toContain('overlapping generated text')
      // Matching advance/height cannot conceal the actual locl overhang.
      await error.evaluate(node => (node as HTMLElement).style.top = '110px')
      const turkishMarker = await measure(marker, '::after')
      await capture('turkish-marker-geometry', { classification: 'generated glyph geometry control', errorMovedForGeometry: true, originalErrorBounds: initial.error, measurement: turkishMarker })
      expect(turkishMarker.generatedText?.language).toBe('tr')
      expect(turkishMarker.generatedText!.box.left).toBeLessThan((await computed()).error.right)
      expect(turkishMarker.generatedText!.box.right).toBeGreaterThan((await computed()).error.left)
      expect(turkishMarker.generatedText!.metrics.right).toBe(initial.metrics[1]!.right)
      await error.evaluate(node => (node as HTMLElement).style.removeProperty('top'))

      await marker.evaluate(node => (node as HTMLElement).style.setProperty('--locale-content', 'none'))
      const removed = await measure(error)
      await capture('turkish-marker-removed', { classification: 'positive detector control', measurement: removed })
      expect(removed.ratio).toBe(normal.ratio)
      await marker.evaluate(node => { node.setAttribute('lang', 'en'); (node as HTMLElement).style.removeProperty('--locale-content') })
      const restored = await measure(error)
      await capture('english-restored', { classification: 'positive detector control', measurement: restored })
      expect(restored.ratio).toBe(normal.ratio)
      expect(restored.excludedPaint.find(paint => paint.reason === 'outside verified CDP generated text bounds').language).toBe('en')
    }
    finally {
      await writeFile(resolve(artifacts, `${theme}-generated-locale.json`), JSON.stringify({ source, theme, evidence }, null, 2))
      await page.context().tracing.stop({ path: resolve(artifacts, `${theme}-generated-locale-trace.zip`) })
      await page.close()
    }
  })


  test(`${theme}: generated snapshot rejects interleaved DOM CSSOM and font changes`, async () => {
    const page = await createPage('/__contrast')
    const evidence: Array<Record<string, unknown>> = []
    const context = page.context(), originalSession = context.newCDPSession.bind(context)
    let injection: string | null = null, injected = false
    context.newCDPSession = async (target) => {
      const session = await originalSession(target), originalSend = session.send.bind(session)
      session.send = (async (method: string, params: Record<string, unknown>) => {
        const result = await originalSend(method as any, params as any)
        if (method === 'DOMSnapshot.captureSnapshot' && injection && !injected) {
          injected = true
          // Change real page state after the protocol has already returned its
          // snapshot. Never alter the returned proof or the measurement result.
          await page.evaluate(mode => {
            const marker = document.getElementById('race-marker')!
            if (mode === 'dom-newline' || mode === 'dom-roundtrip') {
              const original = marker.textContent
              marker.textContent += '\n'
              if (mode === 'dom-roundtrip') marker.textContent = original
            }
            if (mode === 'cssom-roundtrip') {
              const sheet = (document.getElementById('race-style') as HTMLStyleElement).sheet!
              const index = sheet.insertRule('#race-marker { text-align: right; }', sheet.cssRules.length)
              sheet.deleteRule(index)
            }
            if (mode === 'fonts-roundtrip') {
              const face = new FontFace('RaceProbe', 'local(Arial)')
              document.fonts.add(face); document.fonts.delete(face)
            }
          }, injection)
        }
        return result
      }) as typeof session.send
      return session
    }
    await context.tracing.start({ screenshots: true, snapshots: true })
    try {
      await page.setViewportSize({ width: 1440, height: 1000 })
      await page.evaluate(theme => { (window as any).useNuxtApp().$colorMode.preference = theme }, theme)
      await expect.poll(() => page.locator('html').getAttribute('class')).toContain(theme)
      await page.evaluate(() => {
        const control = document.createElement('section'); control.id = 'race-paint-control'; control.lang = 'en'
        control.innerHTML = '<label id="race-marker">Required field</label><span id="race-error">ERROR TEXT</span>'
        document.querySelector('[data-testid="contrast-fixture"]')!.prepend(control)
      })
      const style = await page.addStyleTag({ content: `
        #race-paint-control { position: relative; width: 600px; height: 180px; margin: 20px; background: var(--ui-bg); color: var(--ui-text); }
        #race-marker { position: absolute; left: 40px; top: 40px; width: 400px; height: 60px; white-space: pre; font: 20px/30px Arial; }
        #race-marker::after { content: '*'; }
        #race-error { position: absolute; left: 40px; top: 70px; font: 20px/30px Arial; }
      ` })
      await style.evaluate(node => (node as Element).id = 'race-style')
      await page.evaluate(() => document.fonts.ready)
      const target = page.locator('#race-error'), region = page.locator('#race-paint-control')
      await region.scrollIntoViewIfNeeded()
      const capture = async (state: string, details: Record<string, unknown>) => {
        const computed = await page.evaluate(() => {
          const marker = document.getElementById('race-marker')!, error = document.getElementById('race-error')!
          const range = document.createRange(); range.selectNodeContents(marker)
          return { markerText: marker.textContent, host: marker.getBoundingClientRect().toJSON(), error: error.getBoundingClientRect().toJSON(),
            hostTextRanges: Array.from(range.getClientRects(), box => box.toJSON()), pseudoContent: getComputedStyle(marker, '::after').content }
        })
        const record = { state, source, theme, computed, ...details }; evidence.push(record)
        await writeFile(resolve(artifacts, `${theme}-generated-race-${state}.json`), JSON.stringify(record, null, 2))
        await region.screenshot({ path: resolve(artifacts, `${theme}-generated-race-${state}.png`) })
      }
      const baseline = await measure(target)
      await capture('baseline', { classification: 'positive detector control', measurement: baseline })
      expect(baseline.ratio).toBeGreaterThanOrEqual(4.5)
      expect(baseline.generatedConsistency).toEqual({ domMutations: 0, events: 0, geometryMatches: true })
      expect(baseline.snapshotConsistency).toEqual({ cssOrFontEvents: 0, snapshotsMatch: true })
      for (const mode of ['dom-newline', 'dom-roundtrip', 'cssom-roundtrip', 'fonts-roundtrip']) {
        injection = mode; injected = false
        let measurement: Measurement | null = null, rejection: string | null = null
        try { measurement = await measure(target) }
        catch (error) { rejection = error instanceof Error ? error.message : String(error) }
        injection = null
        await capture(mode, { classification: 'negative detector control', injected, measurement, rejection })
        expect(injected).toBe(true)
        expect(measurement).toBeNull()
        expect(rejection).toContain('unresolved: generated snapshot changed')
        if (mode === 'dom-newline') {
          let freshRejection: string | null = null
          try { await measure(target) }
          catch (error) { freshRejection = error instanceof Error ? error.message : String(error) }
          await capture('fresh-overlap', { classification: 'negative detector control', rejection: freshRejection })
          expect(freshRejection).toContain('overlapping generated text')
        }
        await page.locator('#race-marker').evaluate(node => { node.textContent = 'Required field' })
        const restored = await measure(target)
        await capture(`${mode}-restored`, { classification: 'positive detector control', measurement: restored })
        expect(restored.ratio).toBe(baseline.ratio)
      }
    }
    finally {
      context.newCDPSession = originalSession
      await writeFile(resolve(artifacts, `${theme}-generated-race.json`), JSON.stringify({ source, theme, evidence }, null, 2))
      await context.tracing.stop({ path: resolve(artifacts, `${theme}-generated-race-trace.zip`) })
      await page.close()
    }
  })

}
