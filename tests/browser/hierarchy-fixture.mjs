import assert from 'node:assert/strict'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { chromium } from 'playwright-core'
import { settle } from './hierarchy-evidence.mjs'

const base = process.env.BASE_URL || 'http://127.0.0.1:3016'
const output = path.resolve(process.env.EVIDENCE_DIR || 'output/playwright/hierarchy-fixture')
await mkdir(output, { recursive: true })
const source = JSON.parse(await readFile(new URL('../../.output/hierarchy/source.json', import.meta.url), 'utf8'))
const report = { source, base, browser: '', measurements: [], failures: [], runtimeErrors: [] }
const browser = await chromium.launch({ headless: true, channel: 'chromium' })
report.browser = browser.version()
const page = await browser.newPage()
page.on('pageerror', error => report.runtimeErrors.push(error.message))
page.on('console', message => {
  if (['warning', 'error'].includes(message.type()) && /hydrat/i.test(message.text())) report.runtimeErrors.push(message.text())
})

function check(condition, message) {
  if (!condition) report.failures.push(message)
}

async function expandAll() {
  for (let step = 0; step < 100; step++) {
    const closed = await page.locator('[data-hierarchy-fixture] button[aria-expanded="false"]').elementHandles()
    let changed = false
    for (const button of closed) {
      if (!await button.isVisible()) continue
      await button.click()
      await page.waitForFunction(el => el.getAttribute('aria-expanded') === 'true', button)
      changed = true
      break
    }
    await Promise.all(closed.map(button => button.dispose()))
    if (!changed) {
      await page.evaluate(async () => { await Promise.all(document.getAnimations().map(animation => animation.finished.catch(() => {}))) })
      return
    }
  }
  throw new Error('Fixture disclosure expansion did not settle')
}

try {
  for (const theme of ['light', 'dark']) for (const viewport of [1440, 375, 320]) {
    await page.setViewportSize({ width: viewport, height: 1000 })
    await page.goto(`${base}/__hierarchy`, { waitUntil: 'networkidle' })
    await page.waitForFunction(() => document.querySelector('#__nuxt')?.__vue_app__?.$nuxt?.isHydrating === false)
    await page.locator(`[data-theme="${theme}"]`).click()
    await page.waitForFunction(theme => document.documentElement.classList.contains('dark') === (theme === 'dark'), theme)
    await expandAll()
    await settle(page)
    const measurement = await page.evaluate(() => {
      function contentWidth(element) {
        const style = getComputedStyle(element)
        return parseFloat(style.width) - (style.boxSizing === 'border-box' ?
          parseFloat(style.paddingLeft) + parseFloat(style.paddingRight) + parseFloat(style.borderLeftWidth) + parseFloat(style.borderRightWidth) : 0)
      }
      function region(element, context, target) {
        let container = element.parentElement
        while (container && !getComputedStyle(container).containerName.split(/\s+/).includes('field')) container = container.parentElement
        const style = getComputedStyle(element)
        return { context, target, containerWidth: container ? contentWidth(container) : null,
          padding: style.paddingInlineStart, border: style.borderInlineStartWidth, visible: element.checkVisibility() }
      }
      const regions = []
      for (const article of document.querySelectorAll('[data-field-width]')) {
        const row = document.getElementById(`field-${article.dataset.fieldWidth}`)
        // Field composition's wrapper is stable before and after the refactor.
        const composition = row.querySelector('section.space-y-3')
        regions.push(region(composition.parentElement, 'field-composition', Number(article.dataset.fieldWidth)))
      }
      for (const article of document.querySelectorAll('[data-page-width]')) {
        // The historical baseline predates data-schema-composition. Both versions
        // use the same SchemaComposition root section; avoid HEAD-only hooks.
        const root = article.querySelector('section.space-y-3')
        const nested = root.querySelector('section.space-y-3')
        regions.push(region(nested, `page-${article.closest('[data-page-kind]').dataset.pageKind}`, Number(article.dataset.pageWidth)))
      }
      const notation = document.querySelector('#notation-value [data-value-presence]')
      const notationContainer = document.querySelector('[data-notation-fixture]')
      const rect = notation.getBoundingClientRect()
      const range = document.createRange()
      range.selectNodeContents(notation)
      const textRects = [...range.getClientRects()].map(rect => ({ left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom }))
      return { threshold: parseFloat(getComputedStyle(document.documentElement).fontSize) * 24,
        viewport: innerWidth, scrollWidth: document.documentElement.scrollWidth, regions,
        notation: { text: notation.textContent, width: rect.width, height: rect.height,
          clientWidth: notation.clientWidth, scrollWidth: notation.scrollWidth,
          sectionWidth: notationContainer.clientWidth, sectionScrollWidth: notationContainer.scrollWidth, textRects,
          compact: notation.closest('[data-compact]')?.getAttribute('data-compact') ?? null } }
    })
    report.measurements.push({ theme, ...measurement })
    check(measurement.scrollWidth <= viewport, `${theme}/${viewport}: page overflow`)
    // Check the notation itself. FieldItem's mobile copy hit target has an
    // intentional -me-1 outside the section; it is unrelated to text wrapping.
    check(measurement.notation.scrollWidth <= measurement.notation.clientWidth, `${theme}/${viewport}: notation overflow`)
    check(measurement.notation.text.includes('Record<string, Array<PaymentTransactionMetadataWithAdditionalProperties>>'), 'Real prop notation preserved')
    check(measurement.notation.compact === 'presence', `${theme}/${viewport}: presence compact form`)
    check(measurement.regions.length === 12, `${theme}/${viewport}: all fixture contexts covered`)
    for (const region of measurement.regions) {
      check(region.visible, `${theme}/${viewport}/${region.context}: region visible`)
      check(region.containerWidth !== null, `${theme}/${viewport}/${region.context}: named field container missing`)
      if (viewport === 1440) check(Math.abs(region.containerWidth - region.target) < 0.01, `${theme}/${region.context}: content box ${region.containerWidth} != ${region.target}`)
      const expected = region.containerWidth >= measurement.threshold ? '16px' : '12px'
      check(region.padding === expected && region.border === '1px', `${theme}/${viewport}/${region.context}/${region.target}: padding ${region.padding}, expected ${expected}; border ${region.border}`)
    }
    await page.screenshot({ path: path.join(output, `${theme}-${viewport}.png`), fullPage: true })
  }
}
catch (error) {
  report.executionError = error.stack || String(error)
  report.failures.push(report.executionError)
}
finally {
  await browser.close()
  await writeFile(path.join(output, 'report.json'), JSON.stringify(report, null, 2))
}
// Baseline captures retain identical assertions and report failures without
// stopping a before/after evidence run. The default verification is strict.
assert.deepEqual(report.runtimeErrors, [], 'no runtime or hydration errors in either version')
assert.equal(report.executionError, undefined, 'baseline observation mode must not hide execution errors')
assert.equal(report.measurements.length, 6, 'all theme/viewport cases executed')
if (process.env.REPORT_ONLY !== '1') assert.deepEqual(report.failures, [])
console.log(JSON.stringify({ evidence: output, cases: report.measurements.length, failures: report.failures.length }))
