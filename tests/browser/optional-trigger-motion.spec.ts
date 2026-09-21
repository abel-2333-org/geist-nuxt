import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createPage, setup } from '@nuxt/test-utils/e2e'
import { expect, test } from 'vitest'
import type { Locator } from 'playwright-core'
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
type ExpectedState = { focused: boolean, focusVisible: boolean, hovered: boolean }
type ColorTransition = { property: string, matchedProperty: string, durationMs: number, delayMs: number }
type AnimationRecord = {
  type: string, property: string | null, playState: string, pending: boolean,
  currentTime: number | string | null, relevant: boolean, keyframes: ComputedKeyframe[],
}
type Snapshot = ExpectedState & {
  at: number, phase: string, reason: string, reducedMotion: boolean, triggerState: string | null,
  color: string, backgroundColor: string, transitionProperty: string, transitionDuration: string,
  transitionDelay: string, transitionTimingFunction: string, colorTransitions: ColorTransition[],
  animations: AnimationRecord[], rect: ReturnType<DOMRect['toJSON']>,
  tooltips: Array<{ text: string | null, state: string | null, opacity: string, transform: string, activeAnimations: number }>,
}
type MotionEvent = { at: number, phase: string, type: string, trusted: boolean, property: string | null, elapsedTime: number | null }
type KeyboardEventRecord = { at: number, phase: string, key: string, shiftKey: boolean, trusted: boolean, target: string }
type Observation = { samples: Snapshot[], events: MotionEvent[], keyboard: KeyboardEventRecord[] }
type Recorder = { mark: (phase: string) => Snapshot, sample: (reason: string) => Snapshot, stop: () => Observation }
declare global { interface Window { __optionalTriggerMotion?: Recorder } }

// Observation starts before the first input. RAF and transition events retain
// actual motion evidence; the declaration check makes absence of interpolation
// independent of whether a short transition happened between sampled frames.
async function installRecorder(target: Locator) {
  await target.evaluate((node) => {
    let phase = 'idle'
    let frame = 0
    const samples: Snapshot[] = []
    const events: MotionEvent[] = []
    const keyboard: KeyboardEventRecord[] = []
    const milliseconds = (value: string) => Number.parseFloat(value) * (value.trim().endsWith('ms') ? 1 : 1000)
    const sample = (reason: string): Snapshot => {
      const css = getComputedStyle(node)
      const properties = css.transitionProperty.split(',').map(value => value.trim())
      const durations = css.transitionDuration.split(',').map(milliseconds)
      const delays = css.transitionDelay.split(',').map(milliseconds)
      const colorTransitions = ['color', 'background-color'].flatMap((property) => {
        // CSS lists repeat duration/delay values. The last matching property
        // wins when an explicit property follows `all`.
        const index = properties.findLastIndex(value => value === property || value === 'all')
        return index < 0 ? [] : [{ property, matchedProperty: properties[index]!, durationMs: durations[index % durations.length]!, delayMs: delays[index % delays.length]! }]
      })
      const animations = node.getAnimations().map((animation): AnimationRecord => {
        const keyframes = animation.effect instanceof KeyframeEffect ? animation.effect.getKeyframes() : []
        const property = animation instanceof CSSTransition ? animation.transitionProperty : null
        return {
          type: animation.constructor.name, property, playState: animation.playState, pending: animation.pending,
          currentTime: typeof animation.currentTime === 'number' || animation.currentTime === null ? animation.currentTime : String(animation.currentTime),
          relevant: property === 'color' || property === 'background-color' || keyframes.some(keyframe => 'color' in keyframe || 'backgroundColor' in keyframe),
          keyframes,
        }
      })
      const tooltips = Array.from(document.querySelectorAll<HTMLElement>('[data-reka-popper-content-wrapper] [data-slot="content"][data-side="top"]'))
        .filter(content => content.querySelector('[data-slot="text"]') && content.getClientRects().length && getComputedStyle(content).visibility === 'visible')
        .map((content) => {
          const style = getComputedStyle(content)
          return {
            text: content.querySelector('[data-slot="text"]')!.textContent, state: content.getAttribute('data-state'),
            opacity: style.opacity, transform: style.transform,
            activeAnimations: content.getAnimations({ subtree: true }).filter(animation => animation.pending || animation.playState === 'running').length,
          }
        })
      const result: Snapshot = {
        at: performance.now(), phase, reason, reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches,
        focused: document.activeElement === node, focusVisible: node.matches(':focus-visible'), hovered: node.matches(':hover'),
        triggerState: node.getAttribute('data-state'), color: css.color, backgroundColor: css.backgroundColor,
        transitionProperty: css.transitionProperty, transitionDuration: css.transitionDuration,
        transitionDelay: css.transitionDelay, transitionTimingFunction: css.transitionTimingFunction,
        colorTransitions, animations, rect: node.getBoundingClientRect().toJSON(), tooltips,
      }
      samples.push(result)
      return result
    }
    const onEvent = (event: Event) => {
      if (event.target !== node) return
      events.push({ at: performance.now(), phase, type: event.type, trusted: event.isTrusted,
        property: event instanceof TransitionEvent ? event.propertyName : null,
        elapsedTime: event instanceof TransitionEvent ? event.elapsedTime : null })
      sample(event.type)
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Tab') keyboard.push({ at: performance.now(), phase, key: event.key, shiftKey: event.shiftKey,
        trusted: event.isTrusted, target: (event.target as Element).tagName })
    }
    const onScroll = (event: Event) => {
      if (!(event.target instanceof Node) || !event.target.contains(node)) return
      events.push({ at: performance.now(), phase, type: 'ancestor-scroll', trusted: event.isTrusted, property: null, elapsedTime: null })
      sample('ancestor-scroll')
    }
    const eventNames = ['focus', 'blur', 'pointerenter', 'pointerleave', 'transitionrun', 'transitionstart', 'transitionend', 'transitioncancel']
    for (const name of eventNames) node.addEventListener(name, onEvent)
    document.addEventListener('keydown', onKey, true)
    window.addEventListener('scroll', onScroll, true)
    const tick = () => { sample('animation-frame'); frame = requestAnimationFrame(tick) }
    frame = requestAnimationFrame(tick)
    window.__optionalTriggerMotion = {
      mark(next) { phase = next; return sample('before-input') }, sample,
      stop() {
        cancelAnimationFrame(frame)
        sample('stop')
        for (const name of eventNames) node.removeEventListener(name, onEvent)
        document.removeEventListener('keydown', onKey, true)
        window.removeEventListener('scroll', onScroll, true)
        return { samples, events, keyboard }
      },
    }
    sample('installed')
  })
}

async function motionScenario(theme: Theme) {
  const route = '/kits/api-docs'
  const name = `${theme}-optional-trigger-motion`
  const page = await createPage(route)
  const records: Array<{ state: string, motion: string, expected: ExpectedState, computed: Snapshot, readinessFailure: string | null, measurement: Awaited<ReturnType<typeof measure>> | null, rejection: string | null }> = []
  const actions: Array<{ state: string, expected: ExpectedState, actual: Snapshot }> = []
  let observation: Observation | null = null
  let platformFonts: unknown
  let failure: string | null = null
  await page.context().tracing.start({ screenshots: true, snapshots: true })
  try {
    await page.setViewportSize({ width: 1440, height: 1000 })
    await page.emulateMedia({ reducedMotion: 'no-preference' })
    await page.evaluate(theme => { (window as any).useNuxtApp().$colorMode.preference = theme }, theme)
    await expect.poll(() => page.locator('html').getAttribute('class')).toContain(theme)
    await page.evaluate(() => document.fonts.ready)
    const target = page.locator('[data-field-optional]').filter({ visible: true }).first()
    await target.waitFor({ state: 'visible' })
    await target.scrollIntoViewIfNeeded()
    await page.mouse.move(0, 0)
    await target.evaluate(node => node.setAttribute('data-optional-motion-target', ''))
    const label = await target.getAttribute('aria-label')
    const cdp = await page.context().newCDPSession(page)
    await cdp.send('DOM.enable'); await cdp.send('CSS.enable')
    const documentNode = await cdp.send('DOM.getDocument')
    const fontNode = await cdp.send('DOM.querySelector', { nodeId: documentNode.root.nodeId, selector: '[data-optional-motion-target]' })
    platformFonts = await cdp.send('CSS.getPlatformFontsForNode', { nodeId: fontNode.nodeId })
    await cdp.detach()
    await installRecorder(target)
    const sample = () => page.evaluate(() => window.__optionalTriggerMotion!.sample('readback'))
    const mark = (state: string) => page.evaluate(state => window.__optionalTriggerMotion!.mark(state), state)
    const idle = { focused: false, focusVisible: false, hovered: false }
    const focused = { focused: true, focusVisible: true, hovered: false }
    const hovered = { focused: false, focusVisible: false, hovered: true }
    const hoverFocused = { focused: true, focusVisible: true, hovered: true }
    const pointerEnter = async () => {
      const box = await target.boundingBox()
      if (!box) throw new Error('Actual optional trigger has no hit-test box')
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
    }
    const action = async (state: string, input: () => Promise<unknown>, expected: ExpectedState) => {
      await mark(state)
      await input()
      // Flush the actual input's style update, without waiting for a transition
      // to finish or assuming a fortunate elapsed-time sample proves safety.
      await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => resolve())))
      actions.push({ state, expected, actual: await sample() })
    }
    const checkpoint = async (state: string, expected: ExpectedState, tooltip: 'open' | 'closed' | 'either') => {
      await mark(state)
      let readinessFailure: string | null = null
      try {
        await expect.poll(async () => {
          const current = await sample()
          const quiet = !current.animations.some(animation => animation.pending || animation.playState === 'running')
            && current.tooltips.every(content => content.activeAnimations === 0 && content.opacity === '1' && content.transform === 'none')
          const open = /^(delayed|instant)-open$/.test(current.triggerState || '') && current.tooltips.length === 1 && current.tooltips[0]!.text === label
          return quiet && (tooltip === 'either' || (tooltip === 'open' ? open : current.tooltips.length === 0))
        }, { timeout: 10_000 }).toBe(true)
      }
      catch (error) { readinessFailure = String(error) }
      const computed = await sample()
      const detection = await measure(target).then(measurement => ({ measurement, rejection: null }), error => ({ measurement: null, rejection: String(error) }))
      const record = { state, motion: computed.reducedMotion ? 'reduce' : 'no-preference', expected, computed, readinessFailure, ...detection }
      records.push(record)
      await page.screenshot({ path: resolve(artifacts, `${name}-${state}.png`) })
      await writeFile(resolve(artifacts, `${name}-${state}.json`), JSON.stringify({ source, route, theme, classification: 'actual trigger endpoint and composed contrast', ...record }, null, 2))
    }

    for (const motion of ['no-preference', 'reduce'] as const) {
      // Keep the same input matrix under both preferences. A global nonzero
      // reduced duration is safe when property:none matches no color property.
      await page.emulateMedia({ reducedMotion: motion })
      const prefix = motion === 'reduce' ? 'reduced' : 'normal'
      const act = (state: string, input: () => Promise<unknown>, expected: ExpectedState) => action(`${prefix}-${state}`, input, expected)
      const check = (state: string, expected: ExpectedState, tooltip: 'open' | 'closed' | 'either') => checkpoint(`${prefix}-${state}`, expected, tooltip)
      await check('idle', idle, 'closed')
      await mark(`${prefix}-keyboard-tab-navigation`)
      // Enter through the real sequential keyboard order; no programmatic
      // focus, inserted tab stops, or click establishes :focus-visible.
      for (let count = 0; count < 100 && !await target.evaluate(node => document.activeElement === node); count++) await page.keyboard.press('Tab')
      actions.push({ state: `${prefix}-keyboard-tab-navigation`, expected: focused, actual: await sample() })
      // Sequential navigation may scroll a trigger ancestor, which legitimately
      // closes Reka Tooltip. Preserve this arrival, then re-enter from the
      // adjacent real tab stop and require the normal open Tooltip behavior.
      await check('keyboard-arrival', focused, 'either')
      await act('keyboard-arrival-blur', () => page.keyboard.press('Shift+Tab'), idle)
      await check('keyboard-arrival-blurred', idle, 'closed')
      await act('keyboard-reenter', () => page.keyboard.press('Tab'), focused)
      await check('keyboard-focus', focused, 'open')
      await act('keyboard-blur', () => page.keyboard.press('Shift+Tab'), idle)
      await check('keyboard-blurred', idle, 'closed')

      await act('pointer-enter', pointerEnter, hovered)
      await check('hover-only', hovered, 'open')
      await act('hover-keyboard-focus', () => page.keyboard.press('Tab'), hoverFocused)
      await check('hover-focused', hoverFocused, 'open')
      await act('hover-keyboard-blur', () => page.keyboard.press('Shift+Tab'), hovered)
      await check('blurred-to-hover', hovered, 'either')
      await act('pointer-leave', () => page.mouse.move(0, 0), idle)
      await check('pointer-left', idle, 'closed')

      // Do not wait for settled endpoints between these reversals. Record all
      // actual native events, without requiring a nonexistent intermediate frame.
      await act('rapid-focus-in', () => page.keyboard.press('Tab'), focused)
      await act('rapid-focus-out', () => page.keyboard.press('Shift+Tab'), idle)
      await act('rapid-focus-reenter', () => page.keyboard.press('Tab'), focused)
      await act('rapid-focus-exit', () => page.keyboard.press('Shift+Tab'), idle)
      await check('rapid-keyboard-restored', idle, 'closed')
      await act('rapid-hover-in', pointerEnter, hovered)
      await act('rapid-hover-focus', () => page.keyboard.press('Tab'), hoverFocused)
      await act('rapid-hover-out-focused', () => page.mouse.move(0, 0), focused)
      await act('rapid-mixed-blur', () => page.keyboard.press('Shift+Tab'), idle)
      await act('rapid-hover-reenter', pointerEnter, hovered)
      await act('rapid-mixed-refocus', () => page.keyboard.press('Tab'), hoverFocused)
      await act('rapid-mixed-reblur', () => page.keyboard.press('Shift+Tab'), hovered)
      await act('rapid-hover-exit', () => page.mouse.move(0, 0), idle)
      await check('rapid-mixed-restored', idle, 'closed')
    }
    observation = await page.evaluate(() => window.__optionalTriggerMotion!.stop())

    // Assert only after all paths and restored endpoint evidence are saved.
    expect(label).toBeTruthy()
    expect((platformFonts as { fonts: Array<{ isCustomFont: boolean, familyName: string }> }).fonts.some(font => font.isCustomFont && font.familyName.includes('Geist'))).toBe(true)
    for (const item of [...actions, ...records.map(record => ({ state: record.state, expected: record.expected, actual: record.computed }))]) {
      expect({ focused: item.actual.focused, focusVisible: item.actual.focusVisible, hovered: item.actual.hovered }, item.state).toEqual(item.expected)
    }
    expect(observation.keyboard.some(event => event.trusted && !event.shiftKey), 'real Tab input was observed').toBe(true)
    expect(observation.keyboard.some(event => event.trusted && event.shiftKey), 'real reverse Tab input was observed').toBe(true)
    expect(records.filter(record => record.motion === 'no-preference').length).toBeGreaterThan(0)
    expect(records.filter(record => record.motion === 'reduce').length).toBeGreaterThan(0)
    const unsafeDeclarations = observation.samples.filter(sample => sample.colorTransitions.some(transition => transition.durationMs > 0))
    const activeColorAnimations = observation.samples.filter(sample => sample.animations.some(animation => animation.relevant && (animation.pending || animation.playState === 'running')))
    const colorTransitionEvents = observation.events.filter(event => ['color', 'background-color'].includes(event.property || '') && ['transitionrun', 'transitionstart'].includes(event.type))
    expect({
      declarations: Array.from(new Map(unsafeDeclarations.map(sample => [sample.phase, { phase: sample.phase, reducedMotion: sample.reducedMotion, colorTransitions: sample.colorTransitions }])).values()),
      activeAnimationPhases: Array.from(new Set(activeColorAnimations.map(sample => sample.phase))),
      colorTransitionEvents,
    }, 'actual keyboard and pointer paths must not interpolate optional-trigger foreground or background colors').toEqual({ declarations: [], activeAnimationPhases: [], colorTransitionEvents: [] })
    for (const record of records) {
      expect(record.readinessFailure, `${record.state}: actual endpoint readiness`).toBeNull()
      expect(record.rejection, `${record.state}: actual composed contrast resolves`).toBeNull()
      expect(record.measurement!.ratio, `${record.state}: normal text contrast`).toBeGreaterThanOrEqual(4.5)
    }
    const measurement = (state: string) => records.find(record => record.state === state)!.measurement!
    const normal = measurement('normal-idle')
    for (const prefix of ['normal', 'reduced']) {
      for (const state of ['idle', 'keyboard-blurred', 'pointer-left', 'rapid-keyboard-restored', 'rapid-mixed-restored']) {
        const restored = measurement(`${prefix}-${state}`)
        expect(restored.effectiveForeground, `${prefix}-${state}`).toEqual(normal.effectiveForeground)
        expect(restored.effectiveBackground, `${prefix}-${state}`).toEqual(normal.effectiveBackground)
        expect(restored.ratio, `${prefix}-${state}`).toBe(normal.ratio)
      }
      const focus = measurement(`${prefix}-keyboard-focus`)
      expect(focus.effectiveBackground, 'keyboard focus retains a visible fill').not.toEqual(normal.effectiveBackground)
      expect(focus.effectiveForeground, 'keyboard focus retains inverse text').not.toEqual(normal.effectiveForeground)
      expect(measurement(`${prefix}-hover-focused`).effectiveBackground).toEqual(focus.effectiveBackground)
      expect(measurement(`${prefix}-hover-focused`).effectiveForeground).toEqual(focus.effectiveForeground)
      expect(measurement(`${prefix}-blurred-to-hover`).effectiveBackground).toEqual(measurement(`${prefix}-hover-only`).effectiveBackground)
      expect(measurement(`${prefix}-blurred-to-hover`).effectiveForeground).toEqual(measurement(`${prefix}-hover-only`).effectiveForeground)
    }
  }
  catch (error) { failure = String(error); throw error }
  finally {
    if (!observation) observation = await page.evaluate(() => window.__optionalTriggerMotion?.stop() || null)
    const fonts = await page.evaluate(() => Array.from(document.fonts).map(font => ({ family: font.family, status: font.status })))
    await page.screenshot({ path: resolve(artifacts, `${name}.png`), fullPage: true })
    const report = { source, route, theme, browser: page.context().browser()?.version(), fonts, platformFonts, failure, records, actions, observation }
    await page.context().tracing.stop({ path: resolve(artifacts, `${name}.zip`) })
    await page.context().close()
    await writeFile(resolve(artifacts, `${name}.json`), JSON.stringify(report, null, 2))
  }
}

for (const theme of ['light', 'dark'] as const) {
  test(`${theme}: optional trigger keyboard and pointer paths do not interpolate text colors`, () => motionScenario(theme))
}
