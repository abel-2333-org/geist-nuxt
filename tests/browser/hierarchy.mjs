import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { execFileSync } from 'node:child_process'
import path from 'node:path'
import { chromium } from 'playwright-core'
import { settle, tabsEvidence, focusScreenshot } from './hierarchy-evidence.mjs'

// Run against a locally built gallery: BASE_URL=http://127.0.0.1:3015 pnpm test:browser:hierarchy
const base = process.env.BASE_URL || 'http://127.0.0.1:3015'
const output = path.resolve(process.env.EVIDENCE_DIR || 'output/playwright/pr153')
await mkdir(output, { recursive: true })
const report = { head: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), base, browser: '', measurements: [], lifecycle: [], checks: [] }
const browser = await chromium.launch({ headless: true, channel: 'chromium' })
report.browser = browser.version()
const page = await browser.newPage({ viewport: { width: 1024, height: 900 } })
const screenshotStyle = 'header, #nuxt-devtools-container { visibility: hidden !important; }'
report.screenshotPresentation = 'Only while capturing: hide headers and Nuxt devtools; measurements and interaction use unmodified presentation.'
const failures = []
page.on('pageerror', error => failures.push(error.message))
page.on('console', message => {
  if (['warning', 'error'].includes(message.type()) && /hydrat/i.test(message.text())) failures.push(message.text())
})
async function load(route) {
  await page.goto(`${base}${route}`, { waitUntil: 'networkidle' })
  // Vue exposes its mounted app on the root; Nuxt attaches $nuxt to that app.
  await page.waitForFunction(() => document.querySelector('#__nuxt')?.__vue_app__?.$nuxt?.isHydrating === false)
}
async function state(button) {
  return button.evaluate(el => {
    const id = el.getAttribute('aria-controls')
    const target = id ? document.getElementById(id) : null
    const hidden = target?.closest('[hidden]')
    const s = getComputedStyle(el)
    return { expanded: el.getAttribute('aria-expanded'), controls: id, targetExists: !!target, hidden: hidden?.getAttribute('hidden') ?? null, focused: document.activeElement === el, focusVisible: el.matches(':focus-visible'), outline: `${s.outlineStyle} ${s.outlineWidth}`, display: target ? getComputedStyle(target).display : null }
  })
}
async function waitForDisclosure(button, open) {
  await page.waitForFunction(({ selector, open }) => {
    const button = document.querySelector(selector)
    const target = document.getElementById(button?.getAttribute('aria-controls'))
    return button?.getAttribute('aria-expanded') === String(open) && target &&
      (open ? !target.closest('[hidden]') && target.checkVisibility() : target.closest('[hidden]')?.getAttribute('hidden') === 'until-found')
  }, { selector: await button.evaluate(el => {
    el.dataset.hierarchyProbe = 'active'
    return '[data-hierarchy-probe="active"]'
  }), open }).catch(async error => { throw new Error(`${await button.textContent()}: ${JSON.stringify(await state(button))}`, { cause: error }) })
  await button.evaluate(el => delete el.dataset.hierarchyProbe)
}
async function keyboardCase(label, selector) {
  const button = page.locator(selector).first()
  report.lifecycle.push({ label, stage: 'hydrated-closed', ...await state(button) })
  // Reach the trigger with real Tab events, not element.focus().
  await page.evaluate(() => { document.activeElement?.blur(); window.scrollTo(0, 0) })
  let reached = false
  for (let n = 0; n < 700; n++) {
    await page.keyboard.press('Tab')
    if (await button.evaluate(el => document.activeElement === el)) { reached = true; break }
  }
  assert.ok(reached, `${label}: Tab reaches trigger`)
  await page.keyboard.press('Enter')
  await waitForDisclosure(button, true)
  const opened = await state(button)
  assert.equal(opened.expanded, 'true')
  assert.ok(opened.targetExists && opened.focused && opened.focusVisible)
  assert.equal(opened.hidden, null)
  assert.match(opened.outline, /solid [1-9]/)
  report.lifecycle.push({ label, stage: 'opened', ...opened })
  await focusScreenshot(page, button, { style: screenshotStyle, path: path.join(output, `${label}-keyboard-focus.png`) })
  await page.keyboard.press('Space')
  await waitForDisclosure(button, false)
  const closed = await state(button)
  assert.equal(closed.expanded, 'false')
  assert.ok(closed.focused && closed.focusVisible)
  assert.equal(closed.hidden, 'until-found')
  await page.keyboard.press('Tab')
  assert.ok(await button.evaluate(el => !document.getElementById(el.getAttribute('aria-controls'))?.contains(document.activeElement)))
  report.lifecycle.push({ label, stage: 'closed-after-animation', ...closed })
  report.checks.push(`${label}: Tab / Enter / Space / focus ring / Tab skips hidden content`)
}
async function expandValues() {
  for (let n = 0; n < 30; n++) {
    const buttons = page.locator('[data-value-structure-toggle][aria-expanded="false"]')
    let clicked = false
    for (const button of await buttons.all()) if (await button.isVisible()) { await button.click(); clicked = true; break }
    if (!clicked) return
  }
  throw new Error('Value expansion did not settle')
}
// Query widths are content-box widths, unlike getBoundingClientRect().
async function measureSubtrees(selector) {
  return page.locator(selector).evaluateAll(elements => elements.filter(el => el.checkVisibility()).map(el => {
    const style = getComputedStyle(el)
    let container = el.parentElement
    while (container && !getComputedStyle(container).containerName.split(/\s+/).includes('field')) container = container.parentElement
    const cs = container && getComputedStyle(container)
    const contentWidth = cs ? parseFloat(cs.width) - (cs.boxSizing === 'border-box' ?
      parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight) + parseFloat(cs.borderLeftWidth) + parseFloat(cs.borderRightWidth) : 0) : null
    return { id: el.id, width: el.getBoundingClientRect().width, height: el.getBoundingClientRect().height, padding: style.paddingInlineStart, border: style.borderInlineStartWidth, containerWidth: contentWidth,
      threshold: 24 * parseFloat(getComputedStyle(document.documentElement).fontSize) }
  }))
}
function assertSubtrees(regions, label) {
  assert.ok(regions.length > 0, `${label}: visible subtree coverage is nonempty`)
  for (const region of regions) {
    assert.ok(Number.isFinite(region.containerWidth), `${label}: field query container exists`)
    assert.equal(region.border, '1px')
    assert.equal(region.padding, region.containerWidth >= region.threshold ? '16px' : '12px', `${label}: container-relative indent`)
  }
}
async function checkComposition() {
  const snapshots = []
  // AnyOf sections are independent; reveal each before measuring the shared descendants.
  for (let step = 0; step < 30; step++) {
    let changed = false
    for (const candidate of await page.locator('[data-schema-composition] button[aria-expanded="false"]').all()) {
      if (!await candidate.isVisible()) continue
      // Freeze element identity before its expanded attribute changes the locator list.
      const button = await candidate.elementHandle()
      assert.ok(button)
      await button.click()
      await waitForDisclosure(button, true)
      await button.dispose()
      changed = true
      break
    }
    if (!changed) break
    assert.ok(step < 29, 'Composition disclosures settle')
  }
  const collect = async label => {
    const subtrees = await measureSubtrees('.subtree')
    assertSubtrees(subtrees, label)
    snapshots.push({ label, subtrees })
  }
  await collect('initial variants')
  // Visit every visible tab, then its nested tabs, without assuming fixture counts.
  const visited = new Set()
  for (let step = 0; step < 40; step++) {
    let changed = false
    for (const tab of await page.getByRole('tab').all()) {
      const id = await tab.getAttribute('id')
      if (!await tab.isVisible() || visited.has(id)) continue
      visited.add(id)
      await tab.click()
      await settle(page)
      await collect(`tab:${id}`)
      changed = true
      break
    }
    if (!changed) return snapshots
  }
  throw new Error('Composition tab traversal did not settle')
}
try {
  // Parse the actual server response with JavaScript disabled, separately from hydration.
  const ssrContext = await browser.newContext({ javaScriptEnabled: false })
  const ssr = await ssrContext.newPage()
  await ssr.goto(`${base}/kits/api-docs`)
  for (const [label, selector] of [['children', '#body_gitSource button[aria-expanded]'], ['value', '#tx_retailers [data-value-structure-toggle]']]) {
    report.lifecycle.push({ label, stage: 'SSR', ...await state(ssr.locator(selector).first()) })
  }
  await ssr.goto(`${base}/kits/api-docs/schema-composition`)
  report.lifecycle.push({ label: 'anyOf', stage: 'SSR', ...await state(ssr.locator('button[aria-controls*="phone"]').first()) })
  await ssrContext.close()
  await load('/kits/api-docs')
  await keyboardCase('children', '#body_gitSource button[aria-expanded]')
  await load('/kits/api-docs')
  await keyboardCase('value', '#tx_retailers [data-value-structure-toggle]')
  await load('/kits/api-docs/schema-composition')
  await keyboardCase('anyOf', 'button[aria-controls*="phone"]')
  // Observe real Web Animations API cue creation, including a repeated same-path jump.
  await page.evaluate(() => {
    window.__arrivalAnimations = []
    const original = Element.prototype.animate
    Element.prototype.animate = function (...args) {
      if (this.hasAttribute('data-field-arrival-cue')) window.__arrivalAnimations.push({ parent: this.parentElement.id, frames: args[0], options: args[1] })
      return original.apply(this, args)
    }
  })
  const jump = page.getByRole('button', { name: /phone → sms_opt_in/ })
  for (let attempt = 0; attempt < 2; attempt++) {
    await jump.click()
    await page.waitForFunction(() => document.activeElement?.id === 'contact_phone_sms-opt-in')
    assert.ok(await page.locator('#contact_phone_sms-opt-in').isVisible())
    const box = await page.locator('#contact_phone_sms-opt-in').boundingBox()
    assert.ok(box.y >= 0 && box.y < 900, 'deep-link lands inside viewport')
    if (attempt === 0) { await page.locator('button[aria-controls*="phone"]').first().click(); await page.waitForTimeout(350) }
  }
  report.arrivalAnimations = await page.evaluate(() => window.__arrivalAnimations)
  assert.equal(report.arrivalAnimations.length, 2)
  report.checks.push('anyOf same-path deep link twice: reveal, focus, viewport landing, real cue animation')
  await load('/kits/api-docs#out_refunds_id')
  await page.waitForFunction(() => document.getElementById('out_refunds_id')?.getBoundingClientRect().height > 0)
  assert.equal(await page.locator('#out_refunds [data-value-structure-toggle]').first().getAttribute('aria-expanded'), 'true')
  report.checks.push('cold hash deep link reveals refund value region')
  for (const theme of ['light', 'dark']) for (const width of [1024, 375, 320]) {
    await page.setViewportSize({ width, height: 900 })
    await page.emulateMedia({ colorScheme: theme })
    await load('/kits/api-docs')
    await page.evaluate(theme => { localStorage.setItem('nuxt-color-mode', theme); document.documentElement.classList.toggle('dark', theme === 'dark') }, theme)
    await expandValues()
    const measurements = await page.evaluate(() => ({ scrollWidth: document.documentElement.scrollWidth, viewport: innerWidth,
      compact: document.querySelector('#out_extra [data-compact]')?.getAttribute('data-compact') }))
    measurements.regions = await measureSubtrees('[data-value-structure-region]')
    measurements.nested = await measureSubtrees('#tx_txnOrderMsg .subtree')
    assert.ok(measurements.scrollWidth <= width)
    assert.equal(measurements.compact, 'presence')
    assertSubtrees(measurements.regions, 'value regions')
    assertSubtrees(measurements.nested, 'nested transaction values')
    // Closing an ancestor preserves the independently chosen inner disclosure state.
    const outer = page.locator('#tx_txnOrderMsg [data-value-structure-toggle]').first()
    const inner = page.locator('#tx_txnOrderMsg_products [data-value-structure-toggle]').first()
    assert.equal(await inner.getAttribute('aria-expanded'), 'true')
    await outer.click(); await waitForDisclosure(outer, false)
    assert.equal(await inner.getAttribute('aria-expanded'), 'true')
    await outer.click(); await waitForDisclosure(outer, true)
    assert.equal(await inner.getAttribute('aria-expanded'), 'true')
    assert.ok(await inner.isVisible())
    await inner.click(); await waitForDisclosure(inner, false)
    await outer.click(); await waitForDisclosure(outer, false)
    await outer.click(); await waitForDisclosure(outer, true)
    assert.equal(await inner.getAttribute('aria-expanded'), 'false')
    await inner.click(); await waitForDisclosure(inner, true)
    report.checks.push(`${theme}/${width}: parent reopen preserves both open and closed child state`)
    if (width === 320) {
      // DOM-only stress substitution, deliberately not represented as a real source fixture.
      const notation = page.locator('#out_extra [data-value-presence]').first()
      const original = await notation.textContent()
      const notationBoxes = () => page.locator('#out_extra [data-compact]').first().evaluate(el => {
        const box = node => { const r = node.getBoundingClientRect(); return { tag: node.tagName, width: r.width, height: r.height } }
        return { container: box(el), cells: [...el.querySelectorAll('dt, dd, dl')].map(box), scrollWidth: document.documentElement.scrollWidth, viewport: innerWidth }
      })
      const before = await notationBoxes()
      await notation.evaluate(el => { el.textContent = 'json<object_with_an_intentionally_long_unbroken_presence_notation[]> | null | "{}"' })
      const after = await notationBoxes()
      report.measurements.push({ theme, width, domStressNotation: { before, after } })
      assert.ok(after.scrollWidth <= after.viewport)
      await page.locator('#out_extra').screenshot({ style: screenshotStyle, path: path.join(output, `${theme}-320-dom-stress-notation.png`) })
      await notation.evaluate((el, text) => { el.textContent = text }, original)
      report.checks.push(`${theme}/320: DOM-only long-notation stress, no horizontal page overflow`)
    }
    report.measurements.push({ theme, width, ...measurements })
    for (const id of ['out_refunds', 'out_extra', 'tx_txnOrderMsg']) await page.locator(`#${id}`).screenshot({ style: screenshotStyle, path: path.join(output, `${theme}-${width}-${id}.png`) })
    await load('/kits/api-docs/schema-composition')
    await page.evaluate(theme => document.documentElement.classList.toggle('dark', theme === 'dark'), theme)
    report.measurements.push({ theme, width, composition: await checkComposition(), tabs: await tabsEvidence(page) })
    await page.screenshot({ style: screenshotStyle, path: path.join(output, `${theme}-${width}-composition.png`), fullPage: true })
  }
  assert.deepEqual(failures, [], 'no browser runtime errors')
  report.status = 'passed'
} catch (error) { report.status = 'failed'; report.error = error.stack; throw error }
finally { await writeFile(path.join(output, 'report.json'), JSON.stringify(report, null, 2)); await browser.close() }
console.log(`Hierarchy browser checks passed; evidence: ${output}`)
