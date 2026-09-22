import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { execFileSync } from 'node:child_process'
import path from 'node:path'
import { chromium } from 'playwright-core'

const base = process.env.BASE_URL || 'http://127.0.0.1:3017'
const discoveryOnly = process.env.DISCOVERY_ONLY === '1'
const output = path.resolve(process.env.EVIDENCE_DIR || 'output/playwright/pr153-v2/discovery')
await mkdir(output, { recursive: true })
const report = {
  sourceSha: process.env.SOURCE_SHA || execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  base, discoveryOnly, cases: [], errors: [],
  scope: 'Real Chromium fragment navigation through location.hash; trusted beforematch events are observed, never synthesized. No Vue private instances or goTo/reveal calls. Nested closure uses real trigger click handlers through HTMLButtonElement.click(), not pointer input. Region-root cases add tabindex=-1 solely to focus the existing root; this is an explicit focus-boundary probe. Browser UI Find is not covered by this script.',
}
const scenarios = [
  { label: 'children', selector: '#body_gitSource button[aria-expanded]', route: '/kits/api-docs', target: 'body_gitSource_repoId' },
  { label: 'value', selector: '#tx_txnOrderMsg [data-value-structure-toggle]', route: '/kits/api-docs', target: 'tx_txnOrderMsg_returnUrl' },
  { label: 'anyOf', selector: 'button[aria-controls*="phone"]', route: '/kits/api-docs/schema-composition', target: 'contact_phone_number' },
]
const browser = await chromium.launch({ channel: 'chromium', headless: true })
report.browser = browser.version()
const page = await browser.newPage({ viewport: { width: 1024, height: 900 }, reducedMotion: 'no-preference' })
page.on('pageerror', error => report.errors.push(error.message))

async function settled(button, open) {
  await button.evaluate(el => {
    document.querySelector('[data-discovery-probe]')?.removeAttribute('data-discovery-probe')
    el.setAttribute('data-discovery-probe', '')
  })
  await page.waitForFunction(({ open }) => {
    const trigger = document.querySelector('[data-discovery-probe]')
    const controlled = document.getElementById(trigger.getAttribute('aria-controls'))
    // Reka may not yet forward contentId to the initial closed trigger.
    const content = controlled?.closest('[data-slot="content"]') || controlled
      || trigger.parentElement.querySelector(':scope > [data-slot="content"]')
    return trigger.getAttribute('aria-expanded') === String(open)
      && content.hasAttribute('hidden') !== open
      && content.getAnimations().every(animation => animation.playState === 'finished')
  }, { open })
}

async function prepare(scenario) {
  await page.goto(`${base}${scenario.route}`, { waitUntil: 'networkidle' })
  const button = page.locator(scenario.selector).first()
  await button.waitFor({ state: 'visible' })
  // An actual open/close activation proves the public handler is hydrated.
  if (await button.getAttribute('aria-expanded') !== 'true') await button.click()
  await settled(button, true)
  return button
}

try {
  for (const scenario of scenarios) {
    const result = { label: scenario.label, mode: 'native-fragment', status: 'running' }
    report.cases.push(result)
    const button = await prepare(scenario)
    await button.click()
    await settled(button, false)
    result.closed = await button.evaluate(el => {
      const controlled = document.getElementById(el.getAttribute('aria-controls'))
      const content = controlled.closest('[data-slot="content"]') || controlled
      const style = getComputedStyle(content)
      return { hidden: content.getAttribute('hidden'), inert: content.hasAttribute('inert'), display: style.display, contentVisibility: style.contentVisibility, visibility: style.visibility }
    })
    assert.equal(result.closed.hidden, 'until-found')
    assert.equal(result.closed.inert, false)
    await page.evaluate(() => {
      window.__discoveryEvents = []
      document.addEventListener('beforematch', event => {
        window.__discoveryEvents.push({ trusted: event.isTrusted, id: event.target.id, hidden: event.target.getAttribute('hidden') })
      }, true)
    })
    await page.evaluate(target => { location.hash = `#${encodeURIComponent(target)}` }, scenario.target)
    await settled(button, true)
    result.events = await page.evaluate(() => window.__discoveryEvents)
    assert.ok(result.events.some(event => event.trusted), `${scenario.label}: native fragment must emit trusted beforematch`)
    result.target = await page.locator(`[id="${scenario.target}"]`).evaluate(el => ({
      visible: el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true }),
      hiddenAncestor: !!el.closest('[hidden], [inert]'),
    }))
    assert.equal(result.target.visible, true)
    assert.equal(result.target.hiddenAncestor, false)
    await page.screenshot({ path: path.join(output, `${scenario.label}-fragment.png`) })
    result.status = 'passed'
  }

  for (const state of ['initial-closed', 'closed-after-open']) {
    let button
    if (state === 'initial-closed') {
      await page.goto(`${base}${scenarios[0].route}`, { waitUntil: 'networkidle' })
      button = page.locator(scenarios[0].selector).first()
      await button.waitFor({ state: 'visible' })
      assert.equal(await button.getAttribute('aria-expanded'), 'false', 'Initial-state probe must not toggle the disclosure')
    } else {
      button = await prepare(scenarios[0])
      await button.click()
    }
    await settled(button, false)
    const result = { label: 'children', mode: 'window-find-observation', state, status: 'observed' }
    report.cases.push(result)
    result.observation = await page.evaluate(async () => {
      const events = []
      document.addEventListener('beforematch', event => events.push({ trusted: event.isTrusted, id: event.target.id }), true)
      getSelection().removeAllRanges()
      const matches = []
      for (let index = 0; index < 8; index++) {
        const found = window.find('repoId', false, false, true)
        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))
        const selection = getSelection()
        const parent = selection.anchorNode?.parentElement
        matches.push({ found, text: selection.toString(), field: parent?.closest('[id]')?.id, insideTarget: !!parent?.closest('#body_gitSource_repoId') })
        if (!found) break
      }
      const trigger = document.querySelector('#body_gitSource button[aria-expanded]')
      return { api: 'window.find, not browser UI Find', events, matches, expanded: trigger.getAttribute('aria-expanded'), discoveredHiddenTarget: matches.some(match => match.insideTarget) }
    })
  }

  if (!discoveryOnly) {
    for (const scenario of scenarios) {
      const result = { label: scenario.label, mode: 'region-root-focus', status: 'running' }
      report.cases.push(result)
      const button = await prepare(scenario)
      result.region = await button.evaluate(el => {
        const controlled = document.getElementById(el.getAttribute('aria-controls'))
        const content = controlled.closest('[data-slot="content"]') || controlled
        const region = controlled === content ? content.firstElementChild : controlled
        const previousTabindex = region.getAttribute('tabindex')
        region.setAttribute('tabindex', '-1')
        region.focus({ preventScroll: true })
        if (document.activeElement !== region) throw new Error('Region root focus failed')
        el.click()
        return { id: region.id, previousTabindex }
      })
      await settled(button, false)
      assert.ok(await button.evaluate(el => document.activeElement === el && el.checkVisibility() && !el.closest('[hidden], [inert]')))
      await button.evaluate((el, previousTabindex) => {
        const controlled = document.getElementById(el.getAttribute('aria-controls'))
        const content = controlled.closest('[data-slot="content"]') || controlled
        const region = controlled === content ? content.firstElementChild : controlled
        if (previousTabindex === null) region.removeAttribute('tabindex')
        else region.setAttribute('tabindex', previousTabindex)
      }, result.region.previousTabindex)
      result.status = 'passed'
    }

    const result = { label: 'value', mode: 'nested-same-turn-close', status: 'running' }
    report.cases.push(result)
    const outer = await prepare(scenarios[1])
    const inner = page.locator('#tx_txnOrderMsg_products [data-value-structure-toggle]').first()
    if (await inner.getAttribute('aria-expanded') !== 'true') await inner.click()
    await settled(inner, true)
    await page.locator('#tx_products_name button').first().focus()
    result.activation = await page.evaluate(({ outerSelector, innerSelector }) => {
      const parent = document.querySelector(outerSelector)
      const child = document.querySelector(innerSelector)
      const childRegion = document.getElementById(child.getAttribute('aria-controls'))
      if (!childRegion.contains(document.activeElement)) throw new Error('Expected focus inside nested region')
      child.click()
      parent.click()
      return { order: 'child then parent', sameTask: true }
    }, { outerSelector: scenarios[1].selector, innerSelector: '#tx_txnOrderMsg_products [data-value-structure-toggle]' })
    await settled(outer, false)
    assert.ok(await outer.evaluate(el => document.activeElement === el && el.checkVisibility() && !el.closest('[hidden], [inert]')))
    assert.equal(await inner.getAttribute('aria-expanded'), 'false')
    await outer.click()
    await settled(outer, true)
    assert.equal(await inner.getAttribute('aria-expanded'), 'false', 'Reopening parent preserves explicitly closed child state')
    result.childStateAfterReopen = await inner.getAttribute('aria-expanded')
    result.status = 'passed'
  }
  assert.deepEqual(report.errors, [])
  report.status = 'passed'
} catch (error) {
  report.status = 'failed'
  report.error = error.stack
  process.exitCode = 1
} finally {
  await writeFile(path.join(output, 'discovery-report.json'), JSON.stringify(report, null, 2))
  await browser.close()
}
console.log(JSON.stringify({ status: report.status, discoveryOnly, output, cases: report.cases.map(({ label, mode, state, status }) => ({ label, mode, state, status })), error: report.error }))
