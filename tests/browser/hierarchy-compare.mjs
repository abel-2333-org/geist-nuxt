import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import path from 'node:path'
import { chromium } from 'playwright-core'
import { settle, tabsEvidence } from './hierarchy-evidence.mjs'

// Both servers must be production builds of the recorded SHAs with identical fixture sources.
const endpoints = [{ label: 'base', url: process.env.BASELINE_URL, sha: process.env.BASELINE_SHA },
  { label: 'head', url: process.env.BASE_URL, sha: process.env.SOURCE_SHA }]
for (const endpoint of endpoints) {
  assert.ok(endpoint.url, `${endpoint.label}: URL required`)
  assert.match(endpoint.sha || '', /^[a-f0-9]{40}$/, `${endpoint.label}: exact SHA required`)
}
const output = path.resolve(process.env.EVIDENCE_DIR || 'output/playwright/pr153-comparison')
await mkdir(output, { recursive: true })
const browser = await chromium.launch({ channel: 'chromium' })
const report = { endpoints, browser: browser.version(), samples: [], status: 'running' }
try {
  for (const theme of ['light', 'dark']) for (const width of [320, 1024]) {
    for (const endpoint of endpoints) {
      const page = await browser.newPage({ viewport: { width, height: 900 }, colorScheme: theme })
      await page.addInitScript(theme => localStorage.setItem('nuxt-color-mode', theme), theme)
      for (const route of ['/kits/api-docs', '/kits/api-docs/schema-composition']) {
        await page.goto(endpoint.url + route, { waitUntil: 'networkidle' })
        await page.waitForFunction(() => document.querySelector('#__nuxt')?.__vue_app__?.$nuxt?.isHydrating === false)
        await page.evaluate(theme => document.documentElement.classList.toggle('dark', theme === 'dark'), theme)
        for (let n = 0; n < 40; n++) {
          const buttons = await page.locator(route.endsWith('schema-composition') ? 'main button[aria-expanded="false"]' : '[data-value-structure-toggle][aria-expanded="false"]').all()
          let changed = false
          for (const button of buttons) if (await button.isVisible()) { await button.click(); await settle(page); changed = true; break }
          if (!changed) break
          assert.ok(n < 39, 'disclosures settle')
        }
        if (route.endsWith('schema-composition')) {
          // Select the same final field-level debit-card panel that exposed S1.
          await page.getByRole('tab', { name: 'Debit card', exact: true }).click()
          report.samples.push({ label: endpoint.label, theme, width, route, tabs: await tabsEvidence(page) })
        }
        const selectors = route.endsWith('schema-composition') ? ['main'] : ['#out_refunds', '#out_extra', '#tx_txnOrderMsg']
        for (const selector of selectors) {
          const locator = page.locator(selector).first()
          await settle(page)
          const text = (await locator.innerText()).replace(/\s+/g, ' ').trim()
          const name = selector === 'main' ? 'composition' : selector.slice(1)
          const file = `${endpoint.label}-${theme}-${width}-${name}.png`
          const geometry = await locator.evaluate(el => { const r = el.getBoundingClientRect(); return { width: r.width, height: r.height, scrollWidth: document.documentElement.scrollWidth, viewport: innerWidth } })
          await locator.screenshot({ path: path.join(output, file), style: 'header, #nuxt-devtools-container { visibility:hidden!important }' })
          report.samples.push({ label: endpoint.label, theme, width, name, file, geometry, textHash: createHash('sha256').update(text).digest('hex') })
        }
      }
      await page.close()
    }
  }
  for (const row of report.samples.filter(row => row.label === 'base' && row.name)) {
    const head = report.samples.find(other => other.label === 'head' && other.name === row.name && other.width === row.width && other.theme === row.theme)
    assert.equal(head.textHash, row.textHash, `${row.name}: paired rendered data match`)
  }
  report.status = 'passed'
} catch (error) { report.status = 'failed'; report.error = error.stack; throw error }
finally { await writeFile(path.join(output, 'comparison.json'), JSON.stringify(report, null, 2)); await browser.close() }
