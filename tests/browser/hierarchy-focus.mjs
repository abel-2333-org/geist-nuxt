import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { execFileSync } from 'node:child_process'
import path from 'node:path'
import { chromium } from 'playwright-core'

// Normal production animations remain enabled throughout these observations.
const base = process.env.BASE_URL || 'http://127.0.0.1:3017'
const output = path.resolve(process.env.EVIDENCE_DIR || 'output/playwright/hierarchy-focus')
await mkdir(output, { recursive: true })
const report = {
  sourceSha: process.env.SOURCE_SHA || execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  base, browser: '', viewport: { width: 1024, height: 900 }, cases: [], errors: [],
  scope: 'Chromium, normal motion. Ancestor closure uses the standard HTMLButtonElement.click() activation API on the actual supported disclosure trigger handler; this is programmatic activation, not pointer input or an advertised ancestor keyboard shortcut. It does not move focus before closing. No DOM visibility, focus, or event-handler mutations.',
}
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
      let clip = { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom }
      for (let p = active.parentElement; p; p = p.parentElement) {
        const style = getComputedStyle(p)
        const box = p.getBoundingClientRect()
        if (/(hidden|clip|auto|scroll)/.test(style.overflowX)) { clip.left = Math.max(clip.left, box.left); clip.right = Math.min(clip.right, box.right) }
        if (/(hidden|clip|auto|scroll)/.test(style.overflowY)) { clip.top = Math.max(clip.top, box.top); clip.bottom = Math.min(clip.bottom, box.bottom) }
      }
      rows.push({ event, ms: performance.now() - start, expanded: trigger.getAttribute('aria-expanded'), hidden: content.getAttribute('hidden'),
        active: describe(active), inside: content.contains(active), focusVisible: active.matches(':focus-visible'),
        visible: active.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true }) && !active.closest('[hidden], [inert]'),
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

try {
  for (const [label, selector, route] of [
    ['children', '#body_gitSource button[aria-expanded]', '/kits/api-docs'],
    ['value', '#tx_txnOrderMsg [data-value-structure-toggle]', '/kits/api-docs'],
    ['anyOf', 'button[aria-controls*="phone"]', '/kits/api-docs/schema-composition'],
  ]) for (const mode of ['rapid-tab', 'ancestor-programmatic-activation']) {
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
  assert.deepEqual(report.errors, [], 'no page errors')
  // Findings are an observation artifact for base/head comparison, not silently asserted as passing.
  report.status = report.cases.some(c => c.status === 'coverage-gap') ? 'coverage-gap' : report.cases.some(c => c.status === 'finding') ? 'findings-require-baseline-comparison' : 'passed'
  if (report.status === 'coverage-gap') process.exitCode = 1
} catch (error) { report.status = 'error'; report.error = error.stack; process.exitCode = 1 }
finally {
  await writeFile(path.join(output, 'focus-report.json'), JSON.stringify(report, null, 2))
  await browser.close()
}
console.log(JSON.stringify({ status: report.status, output, cases: report.cases.map(({ label, mode, status, tabDuringCloseAnimation, invisibleFocus }) => ({ label, mode, status, tabDuringCloseAnimation, invisibleFocusSamples: invisibleFocus?.length })), error: report.error }))
