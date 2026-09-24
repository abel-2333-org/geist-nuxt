import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { execFileSync } from 'node:child_process'
import path from 'node:path'
import { chromium } from 'playwright-core'

// Baseline observations retain normal motion; HEAD_STRICT adds positive normal/reduced-motion gates.
const strict = process.env.HEAD_STRICT === '1'
const base = process.env.BASE_URL || 'http://127.0.0.1:3017'
const output = path.resolve(process.env.EVIDENCE_DIR || 'output/playwright/hierarchy-focus')
await mkdir(output, { recursive: true })
const report = {
  sourceSha: process.env.SOURCE_SHA || execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  strictRequested: strict, strictCases: [],
  base, browser: '', viewport: { width: 1024, height: 900 }, cases: [], errors: [],
  scope: 'Chromium; baseline observations use normal motion, strict cases cover normal and reduced motion. Ancestor closure uses the standard HTMLButtonElement.click() activation API on the actual supported disclosure trigger handler; this is programmatic activation, not pointer input or an advertised ancestor keyboard shortcut. It does not move focus before closing. No DOM visibility, focus, or event-handler mutations.',
}
const scenarios = [
  ['children', '#body_gitSource button[aria-expanded]', '/kits/api-docs'],
  ['value', '#tx_txnOrderMsg [data-value-structure-toggle]', '/kits/api-docs'],
  ['anyOf', 'button[aria-controls*="phone"]', '/kits/api-docs/schema-composition'],
]
const browser = await chromium.launch({ channel: 'chromium', headless: true })
report.browser = browser.version()
const page = await browser.newPage({ viewport: report.viewport, reducedMotion: 'no-preference' })
page.on('pageerror', error => report.errors.push(error.message))

async function tabTo(button) {
  for (let n = 0; n < 700; n++) {
    await page.keyboard.press('Tab')
    if (await button.evaluate(el => document.activeElement === el)) return
  }
  throw new Error('Real Tab traversal did not reach disclosure')
}

async function prepare(selector, route) {
  await page.goto(`${base}${route}`, { waitUntil: 'networkidle' })
  await page.waitForFunction(() => document.querySelector('#__nuxt')?.__vue_app__?.$nuxt?.isHydrating === false)
  const button = page.locator(selector).first()
  await button.evaluate(el => { el.dataset.focusProbe = 'trigger' })
  await tabTo(button)
  await page.keyboard.press('Enter')
  await page.waitForFunction(() => {
    const button = document.querySelector('[data-focus-probe="trigger"]')
    const controlled = document.getElementById(button.getAttribute('aria-controls'))
    const content = controlled.closest('[data-slot="content"]') || controlled
    return button.getAttribute('aria-expanded') === 'true' && controlled.checkVisibility() && content.getAnimations().every(a => a.playState === 'finished')
  })
  return button
}

async function observe() {
  await page.evaluate(() => {
    const trigger = document.querySelector('[data-focus-probe="trigger"]')
    const controlled = document.getElementById(trigger.getAttribute('aria-controls'))
    const content = controlled.closest('[data-slot="content"]') || controlled
    const start = performance.now()
    const rows = []
    const describe = el => ({ tag: el?.tagName, id: el?.id, ariaLabel: el?.getAttribute('aria-label'), field: el?.closest('[id]')?.id, text: el?.textContent?.trim().slice(0, 100), tabindex: el?.getAttribute('tabindex') })
    const snapshot = event => {
      const active = document.activeElement
      const rect = active.getBoundingClientRect()
      const activeStyle = getComputedStyle(active)
      let clip = { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom }
      for (let p = active.parentElement; p; p = p.parentElement) {
        const style = getComputedStyle(p)
        const box = p.getBoundingClientRect()
        if (/(hidden|clip|auto|scroll)/.test(style.overflowX)) { clip.left = Math.max(clip.left, box.left); clip.right = Math.min(clip.right, box.right) }
        if (/(hidden|clip|auto|scroll)/.test(style.overflowY)) { clip.top = Math.max(clip.top, box.top); clip.bottom = Math.min(clip.bottom, box.bottom) }
      }
      rows.push({ event, ms: performance.now() - start, expanded: trigger.getAttribute('aria-expanded'), hidden: content.getAttribute('hidden'),
        active: describe(active), isTrigger: active === trigger, isExternalFocus: active === window.__externalFocus, inside: content.contains(active), focusVisible: active.matches(':focus-visible'),
        visible: active.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true }) && !active.closest('[hidden], [inert]'),
        structurallyVisible: active.checkVisibility({ checkVisibilityCSS: true }) && !active.closest('[hidden], [inert]'),
        opacity: Number(activeStyle.opacity),
        focusOutline: { style: activeStyle.outlineStyle, width: parseFloat(activeStyle.outlineWidth), color: activeStyle.outlineColor },
        focusOpacityTransitions: active.getAnimations().filter(a => a instanceof CSSTransition && a.transitionProperty === 'opacity').map(a => ({
          state: a.playState, currentTime: a.currentTime, duration: a.effect.getTiming().duration, target: Number(a.effect.getKeyframes().at(-1).opacity),
        })),
        unclippedPixels: Math.max(0, clip.right - clip.left) * Math.max(0, clip.bottom - clip.top),
        contentHeight: content.getBoundingClientRect().height,
        animations: content.getAnimations().map(a => ({ name: a.animationName, state: a.playState, currentTime: a.currentTime, duration: a.effect.getTiming().duration })),
      })
    }
    const listeners = []
    for (const event of ['animationstart', 'animationend', 'focusin', 'keydown', 'keyup']) {
      const listener = e => { if (!event.startsWith('key') || ['Tab', ' ', 'Enter'].includes(e.key)) snapshot(`${event}${e.key ? ':' + e.key : ''}`) }
      document.addEventListener(event, listener, true)
      listeners.push([event, listener])
    }
    let running = true
    const frame = () => { if (running) { snapshot('frame'); requestAnimationFrame(frame) } }
    snapshot('before-close')
    requestAnimationFrame(frame)
    window.__focusProbe = { rows, snapshot, stop() { running = false; for (const [event, listener] of listeners) document.removeEventListener(event, listener, true); snapshot('settled'); return rows } }
  })
}

async function settledClosed(button) {
  await page.waitForFunction(() => {
    const trigger = document.querySelector('[data-focus-probe="trigger"]')
    const controlled = document.getElementById(trigger.getAttribute('aria-controls'))
    const content = controlled.closest('[data-slot="content"]') || controlled
    return trigger.getAttribute('aria-expanded') === 'false' && content.hasAttribute('hidden')
      && content.getAnimations().every(animation => animation.playState === 'finished')
  })
  assert.equal(await button.getAttribute('aria-expanded'), 'false')
}

async function runStrict() {
  for (const motion of ['no-preference', 'reduce']) {
    await page.emulateMedia({ reducedMotion: motion })
    for (const [label, selector, route] of scenarios) {
      for (const mode of ['rapid-tab', 'ancestor-programmatic-activation', 'external-focus', 'rapid-reopen']) {
        const result = { label, mode, motion, status: 'running' }
        report.strictCases.push(result)
        const button = await prepare(selector, route)
        if (mode === 'ancestor-programmatic-activation') {
          await page.keyboard.press('Tab')
          assert.ok(await button.evaluate(el => document.getElementById(el.getAttribute('aria-controls')).contains(document.activeElement)), `${label}: focused descendant required`)
        } else if (mode === 'external-focus') {
          // Shift+Tab from the trigger reaches a real preceding control outside its region.
          await page.keyboard.press('Shift+Tab')
          await button.evaluate(el => {
            const active = document.activeElement
            if (!active || active === document.body || active === el || document.getElementById(el.getAttribute('aria-controls')).contains(active)) throw new Error('Expected an external focused control')
            window.__externalFocus = active
          })
        }
        await observe()
        if (mode === 'rapid-tab') {
          await page.keyboard.press('Space')
          await page.keyboard.press('Tab')
        } else if (mode === 'rapid-reopen') {
          await button.evaluate(el => {
            window.__rapidReverse = new Promise(resolve => {
              el.addEventListener('click', () => requestAnimationFrame(() => {
                const controlled = document.getElementById(el.getAttribute('aria-controls'))
                const content = controlled.closest('[data-slot="content"]') || controlled
                const observation = {
                  closed: el.getAttribute('aria-expanded') === 'false',
                  running: !content.hasAttribute('hidden') && content.getAnimations().some(a => a.playState === 'running'),
                }
                el.click()
                resolve(observation)
              }), { once: true })
            })
          })
          await page.keyboard.press('Space')
          const reversal = await page.evaluate(() => window.__rapidReverse)
          result.reversalActivation = 'Space closes; next-frame HTMLButtonElement.click() reopens programmatically'
          result.reversedWhileClosing = reversal.running
          assert.ok(reversal.closed, `${label}: reversal must follow the close state`)
          if (motion === 'no-preference') assert.ok(result.reversedWhileClosing, `${label}: rapid reversal must interrupt a running exit`)
          assert.equal(await button.getAttribute('aria-expanded'), 'true')
          await page.keyboard.press('Tab')
          result.immediateReopenFocusInside = await button.evaluate(el => document.getElementById(el.getAttribute('aria-controls')).contains(document.activeElement))
        } else {
          await button.evaluate(el => el.click())
        }
        await page.evaluate(() => window.__focusProbe.snapshot('after-action'))
        if (mode === 'rapid-reopen') {
          await page.waitForFunction(() => {
            const el = document.querySelector('[data-focus-probe="trigger"]')
            const content = document.getElementById(el.getAttribute('aria-controls')).closest('[data-slot="content"]')
            return el.getAttribute('aria-expanded') === 'true' && content.getAnimations().every(a => a.playState === 'finished')
          })
        } else {
          await settledClosed(button)
        }
        // Keep collecting all immediate/frame samples while the newly focused
        // anchor's own fade completes. With reduced motion the panel may settle
        // first; that does not make the focus transition a settled UI state.
        await page.evaluate(async () => {
          await Promise.all(document.activeElement.getAnimations()
            .filter(animation => Number.isFinite(animation.effect.getComputedTiming().endTime))
            .map(animation => animation.finished.catch(() => {})))
        })
        result.samples = await page.evaluate(() => window.__focusProbe.stop())
        // Ignore capture-phase keyup/animation events before Vue commits its focus recovery.
        // Frames, focusin, Tab keydown and explicit checkpoints cover observable focus states.
        const samples = result.samples.filter(s => ['frame', 'focusin', 'keydown:Tab', 'after-action', 'settled'].includes(s.event))
        // A field anchor (outside the region or in its reopened content) fades in on :focus-visible. This is
        // distinct from a hidden/clipped exit: accept only its active opacity-to-1
        // transition with a configured focus outline, and require full visibility
        // at settlement. Hidden, inert, clipped and closed-region focus never qualify.
        const enteringFocusOpacity = s => s.event !== 'settled' && (!s.inside || s.expanded === 'true') && s.focusVisible
          && s.structurallyVisible && s.unclippedPixels > 0
          && s.focusOutline.style !== 'none' && s.focusOutline.width > 0
          && s.focusOutline.color !== 'rgba(0, 0, 0, 0)'
          && s.focusOpacityTransitions.some(a => a.state === 'running' && a.target === 1 && a.duration > 0 && a.currentTime >= 0 && a.currentTime <= a.duration)
        result.enteringFocusOpacitySamples = samples.filter(s => !s.visible && enteringFocusOpacity(s))
        const invalid = samples.filter(s => s.active.tag === 'BODY' || (!s.visible && !enteringFocusOpacity(s)) || s.unclippedPixels === 0 || (s.expanded === 'false' && s.inside))
        assert.equal(result.samples.at(-1).opacity, 1, `${label}: settled focus must be fully opaque`)
        result.invalidSamples = invalid
        assert.deepEqual(invalid, [], `${label}/${motion}/${mode}: focus must remain visible and outside the exiting region`)
        if (mode === 'rapid-tab' && motion === 'no-preference') {
          assert.ok(samples.some(s => s.event === 'keydown:Tab' && s.expanded === 'false' && s.animations.some(a => a.state === 'running')), `${label}: Tab must occur during normal-motion exit`)
        }
        if (mode === 'ancestor-programmatic-activation') assert.ok(await button.evaluate(el => document.activeElement === el), `${label}: closing ancestor must recover focus to its trigger`)
        if (mode === 'external-focus') {
          assert.ok(samples.every(s => s.isExternalFocus), `${label}: external focus must not be stolen even transiently`)
          assert.ok(await page.evaluate(() => document.activeElement === window.__externalFocus), `${label}: external focus must not be stolen`)
        }
        await page.evaluate(() => document.activeElement.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'instant' }))
        result.screenshotScroll = 'Focused control centered only after all focus assertions; full outline retained'
        result.screenshot = `strict-${label}-${motion}-${mode}-settled.png`
        await page.screenshot({ path: path.join(output, result.screenshot) })
        if (mode === 'rapid-reopen') {
          // The immediate Tab above is measured throughout expansion. Once the
          // content fits its visible box, a separate navigation probe confirms
          // that the temporary opening restriction has actually been removed.
          await button.focus()
          await page.keyboard.press('Tab')
          assert.ok(await button.evaluate(el => document.getElementById(el.getAttribute('aria-controls')).contains(document.activeElement)), `${label}: fully expanded descendants must regain keyboard navigation`)
        }
        result.status = 'passed'
      }
    }
  }
  report.strictPassed = true
}

try {
  for (const [label, selector, route] of scenarios) for (const mode of ['rapid-tab', 'ancestor-programmatic-activation']) {
    const button = await prepare(selector, route)
    const result = { label, mode, route, selector }
    report.cases.push(result)
    if (mode === 'ancestor-programmatic-activation') {
      await page.keyboard.press('Tab')
      assert.ok(await button.evaluate(el => document.getElementById(el.getAttribute('aria-controls')).contains(document.activeElement)), `${label}: real Tab places focus inside ancestor`)
    }
    // Screenshot the real focused state with surrounding space, not a clipped button crop.
    await page.screenshot({ path: path.join(output, `${label}-${mode}-before.png`) })
    await observe()
    if (mode === 'rapid-tab') {
      await page.keyboard.press('Space')
      await page.keyboard.press('Tab')
    } else {
      result.api = await button.evaluate(el => {
        const controlled = document.getElementById(el.getAttribute('aria-controls'))
        const active = document.activeElement
        if (!controlled.contains(active)) throw new Error('Focus must remain inside before activation')
        window.__focusProbe.snapshot('before-native-activation')
        el.click()
        window.__focusProbe.snapshot('after-native-activation-sync')
        return { publicApi: 'HTMLButtonElement.click()', existingHandler: 'disclosure trigger click', inputKind: 'programmatic DOM activation, not pointer or keyboard shortcut', focusUnchangedSynchronously: document.activeElement === active }
      })
    }
    await page.waitForFunction(() => {
      const button = document.querySelector('[data-focus-probe="trigger"]')
      const content = document.getElementById(button.getAttribute('aria-controls')).closest('[data-slot="content"]')
      return button.getAttribute('aria-expanded') === 'false' && content?.hasAttribute('hidden') && content.getAnimations().every(a => a.playState === 'finished')
    })
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))
    result.samples = await page.evaluate(() => window.__focusProbe.stop())
    result.tabDuringCloseAnimation = result.samples.some(s => s.event === 'keydown:Tab' && s.expanded === 'false' && s.animations.some(a => a.state === 'running'))
    result.invisibleFocus = result.samples.filter(s => s.inside && (s.hidden !== null || s.unclippedPixels === 0))
    result.opacityOrVisibilitySamples = result.samples.filter(s => s.inside && !s.visible && s.hidden === null && s.unclippedPixels > 0)
    result.closedContentFocus = result.samples.some(s => s.expanded === 'false' && s.inside)
    result.settled = result.samples.at(-1)
    result.status = mode === 'rapid-tab' && !result.tabDuringCloseAnimation ? 'coverage-gap' : result.invisibleFocus.length ? 'finding' : 'observed'
    await page.screenshot({ path: path.join(output, `${label}-${mode}-after.png`) })
  }
  if (strict) await runStrict()
  assert.deepEqual(report.errors, [], 'no page errors')
  // Findings are an observation artifact for base/head comparison, not silently asserted as passing.
  report.status = report.cases.some(c => c.status === 'coverage-gap') ? 'coverage-gap' : report.cases.some(c => c.status === 'finding') ? 'findings-require-baseline-comparison' : 'passed'
  if (report.status === 'coverage-gap') process.exitCode = 1
} catch (error) { if (strict) report.strictPassed = false; report.status = 'error'; report.error = error.stack; process.exitCode = 1 }
finally {
  await writeFile(path.join(output, 'focus-report.json'), JSON.stringify(report, null, 2))
  await browser.close()
}
console.log(JSON.stringify({ status: report.status, strictPassed: report.strictPassed, strictCases: report.strictCases.map(({ label, mode, motion, status }) => ({ label, mode, motion, status })), output, cases: report.cases.map(({ label, mode, status, tabDuringCloseAnimation, invisibleFocus }) => ({ label, mode, status, tabDuringCloseAnimation, invisibleFocusSamples: invisibleFocus?.length })), error: report.error }))
