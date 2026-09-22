import { expect, test } from 'vitest'
import type { Locator } from 'playwright-core'
import { pickRole, roles, scenario, settle, setupFunctionalTests } from './functional-support'

await setupFunctionalTests()

// Start before input. Declaration checks prove the solid button has no color
// interpolation; transition events and running-animation records independently
// verify native hover/press/focus reversals. RAF is evidence, not an assertion
// that a finite set of sampled frames covers a continuous interpolation.
async function installRecorder(target: Locator) {
  await target.evaluate(node => {
    let frame = 0, phase = 'idle'
    const samples: any[] = [], events: any[] = []
    const ms = (value: string) => parseFloat(value) * (value.trim().endsWith('ms') ? 1 : 1000)
    const sample = (reason: string) => {
      const css = getComputedStyle(node)
      const properties = css.transitionProperty.split(',').map(value => value.trim())
      const durations = css.transitionDuration.split(',').map(ms)
      const delays = css.transitionDelay.split(',').map(ms)
      const declarations = ['color', 'background-color', 'opacity'].flatMap(property => {
        const index = properties.findLastIndex(value => value === property || value === 'all')
        return index < 0 ? [] : [{ property, duration: durations[index % durations.length], delay: delays[index % delays.length] }]
      })
      const animations = node.getAnimations({ subtree: true }).map(animation => {
        const keyframes = animation.effect instanceof KeyframeEffect ? animation.effect.getKeyframes() : []
        const property = animation instanceof CSSTransition ? animation.transitionProperty : null
        return { property, pending: animation.pending, playState: animation.playState, keyframes,
          relevant: ['color', 'background-color', 'opacity'].includes(property || '') || keyframes.some(keyframe => ['color', 'backgroundColor', 'opacity'].some(property => property in keyframe)) }
      })
      const state = { phase, reason, at: performance.now(), color: css.color, background: css.backgroundColor, opacity: css.opacity,
        reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches,
        focused: document.activeElement === node, focusVisible: node.matches(':focus-visible'), hovered: node.matches(':hover'), active: node.matches(':active'),
        transition: { property: css.transitionProperty, duration: css.transitionDuration, delay: css.transitionDelay, easing: css.transitionTimingFunction }, declarations, animations }
      samples.push(state)
      return state
    }
    const onEvent = (event: Event) => {
      events.push({ phase, type: event.type, trusted: event.isTrusted, at: performance.now(),
        property: event instanceof TransitionEvent ? event.propertyName : null,
        key: event instanceof KeyboardEvent ? event.key : null,
        shift: event instanceof KeyboardEvent ? event.shiftKey : null })
      sample(event.type)
    }
    const names = ['focus', 'blur', 'pointerenter', 'pointerleave', 'pointerdown', 'pointerup', 'keydown', 'keyup', 'transitionrun', 'transitionstart', 'transitionend', 'transitioncancel']
    for (const name of names) node.addEventListener(name, onEvent)
    const tick = () => { sample('animation-frame'); frame = requestAnimationFrame(tick) }
    frame = requestAnimationFrame(tick)
    ;(node as any).__functionalMotion = {
      mark(value: string) { phase = value; return sample('before-input') },
      sample,
      stop() { cancelAnimationFrame(frame); sample('stop'); for (const name of names) node.removeEventListener(name, onEvent); return { samples, events } },
    }
    sample('installed')
  })
}

for (const theme of ['light', 'dark'] as const) for (const motion of ['no-preference', 'reduce'] as const) {
  test(`${theme}/${motion}: Button color transitions stay absent across native reversals`, () => scenario(theme, 1440, `button-motion-${motion}`, async (page, capture, evidence) => {
    await page.emulateMedia({ reducedMotion: motion })
    const violations: any[] = []
    for (const role of roles) for (const variant of ['solid', 'link']) {
      await pickRole(page, role)
      const button = page.locator(`[data-role="${role}"] [data-audit="button-${variant}"]`)
      const label = button.locator('[data-label]')
      await button.scrollIntoViewIfNeeded(); await page.mouse.move(0, 0)
      if (await button.evaluate(node => document.activeElement === node)) await page.keyboard.press('Tab')
      await settle(button)
      await installRecorder(button)
      const mark = (state: string) => button.evaluate((node, state) => (node as any).__functionalMotion.mark(state), state)
      const pointerEnter = async () => {
        const box = await button.boundingBox()
        if (!box) throw new Error('Button has no native hit-test box')
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
      }
      const checkpoint = async (state: string, expected: Record<string, boolean>) => {
        const actual = await button.evaluate(node => (node as any).__functionalMotion.sample('checkpoint'))
        for (const [key, value] of Object.entries(expected)) if (actual[key] !== value) violations.push({ role, variant, state, key, expected: value, actual: actual[key] })
        return (await capture(label, { component: 'Button', role, variant, motion, state, actual }))[0]
      }
      const idle = await checkpoint('idle', { hovered: false, active: false, focused: false })
      await mark('pointer-enter'); await pointerEnter()
      await checkpoint('hover', { hovered: true, active: false })
      await mark('pointer-down'); await page.mouse.down()
      await checkpoint('active+hover', { hovered: true, active: true })
      await mark('pointer-up'); await page.mouse.up()
      await checkpoint('released-to-hover', { hovered: true, active: false })
      await mark('pointer-leave'); await page.mouse.move(0, 0)
      await checkpoint('pointer-restored', { hovered: false, active: false })
      // Mouse press gives the actual focus position. Re-enter through trusted
      // Tab traversal, without programmatic focus or injected tabindex.
      expect(await button.evaluate(node => document.activeElement === node)).toBe(true)
      await mark('keyboard-enter'); await page.keyboard.press('Shift+Tab'); await page.keyboard.press('Tab')
      await checkpoint('keyboard-focus', { focused: true, focusVisible: true, hovered: false, active: false })
      await mark('keyboard-down'); await page.keyboard.down('Space')
      await checkpoint('keyboard-active+focus', { focused: true, focusVisible: true, active: true })
      await mark('keyboard-up'); await page.keyboard.up('Space')
      await checkpoint('keyboard-release', { focused: true, focusVisible: true, active: false })
      await mark('focus-plus-hover'); await pointerEnter()
      await checkpoint('focus+hover', { focused: true, focusVisible: true, hovered: true })
      await mark('blur-to-hover'); await page.keyboard.press('Tab')
      await checkpoint('blurred-hover', { focused: false, hovered: true })
      await mark('rapid-reversals')
      // No settle calls between inputs: cover cancellation/reversal as well as
      // stable endpoints. Events capture changes shorter than an RAF interval.
      for (let iteration = 0; iteration < 3; iteration++) {
        await page.mouse.move(0, 0); await pointerEnter(); await page.mouse.down(); await page.mouse.up()
        await page.mouse.move(0, 0); await page.keyboard.press('Tab'); await page.keyboard.press('Shift+Tab')
        await page.keyboard.down('Space'); await page.keyboard.up('Space'); await page.keyboard.press('Tab')
      }
      await mark('restored-idle'); await page.mouse.move(0, 0)
      if (await button.evaluate(node => document.activeElement === node)) await page.keyboard.press('Tab')
      const restored = await checkpoint('restored-idle', { focused: false, hovered: false, active: false })
      const observation = await button.evaluate(node => (node as any).__functionalMotion.stop())
      evidence.push({ component: 'Button', role, variant, motion, observation })
      for (const sample of observation.samples) {
        if (sample.reducedMotion !== (motion === 'reduce')) violations.push({ role, variant, type: 'wrong media condition', sample })
        if (variant === 'solid' && sample.declarations.some((declaration: any) => declaration.duration > 0)) violations.push({ role, variant, type: 'color transition declaration', sample })
        if (sample.animations.some((animation: any) => animation.relevant && (animation.pending || animation.playState === 'running'))) violations.push({ role, variant, type: 'running color animation', sample })
        if (variant === 'link' && (sample.color !== observation.samples[0].color || sample.background !== observation.samples[0].background || sample.opacity !== observation.samples[0].opacity)) violations.push({ role, variant, type: 'link paint changed', sample })
      }
      for (const event of observation.events) if (['transitionrun', 'transitionstart'].includes(event.type) && ['color', 'background-color', 'opacity'].includes(event.property)) violations.push({ role, variant, type: 'color transition event', event })
      expect(observation.events.some((event: any) => event.type === 'keydown' && event.key === 'Tab' && event.trusted)).toBe(true)
      expect(observation.events.some((event: any) => event.type === 'pointerdown' && event.trusted)).toBe(true)
      if (idle?.status === 'pass' && restored?.status === 'pass') {
        expect(restored.effectiveForeground).toEqual(idle.effectiveForeground)
        expect(restored.effectiveBackground).toEqual(idle.effectiveBackground)
      }
    }
    evidence.push({ classification: 'motion proof violations', violations })
    expect(violations, 'declarations, native transition events and animations must all agree').toEqual([])
  }))
}
