import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import path from 'node:path'
import { chromium } from 'playwright-core'
import { settle, tabsEvidence } from './hierarchy-evidence.mjs'

// Fixed gallery cases from index.vue and the adopted type/value presentation
// contract. Each exact baseline fragment must occur once, and the whole HEAD
// text must equal the resulting text: no other prose, values or counts are
// ignored. Composition has no approved text change and keeps strict equality.
const approvedPresentationChanges = {
  out_refunds: [{
    fact: 'The array stays optional; object/null belongs to each item, with both item conditions and the two-field count retained.',
    from: 'refunds? array 仅在发生过退款时返回，从未退款的交易没有这个键。 退款记录。字段可省略是字段自己的事实，不会下传给数组元素。 收起子参数 (2) 每个元素 object | null 退款被风控撤销后，对应位置保留为 null，数组长度不变。 退款仍在处理中时同样为 null，完成后原位替换为退款对象。',
    to: 'refunds? array<object | null> 仅在发生过退款时返回，从未退款的交易没有这个键。 每个元素: 退款被风控撤销后，对应位置保留为 null，数组长度不变。 每个元素: 退款仍在处理中时同样为 null，完成后原位替换为退款对象。 退款记录。字段可省略是字段自己的事实，不会下传给数组元素。 收起子参数 (2)',
  }],
  out_extra: [{
    fact: 'Wire string/null and json_string format remain separate from decoded JSON object/encoded empty-object presence; child count remains one.',
    from: 'extra string | null json<object> 扩展信息。字段值可为 null；解码后内容可能是编码过的空对象——两个"空"分属两层，各标各的。 收起子参数 (1) 值要求 object | "{}"',
    to: 'extra string | null json_string 扩展信息。字段值可为 null；解码后内容可能是编码过的空对象——两个"空"分属两层，各标各的。 解码内容 · json: object | "{}" 收起子参数 (1)',
  }],
  tx_txnOrderMsg: [{
    fact: 'txnOrderMsg keeps required wire string and its declared json_string format.',
    from: 'txnOrderMsg string json<object> 必填',
    to: 'txnOrderMsg string json_string 必填',
  }, {
    fact: 'The txnOrderMsg decoded JSON object is explicit in the description.',
    from: '交易业务信息，包含 returnUrl、商品信息以及商户采集的浏览器与设备信息。',
    to: '交易业务信息，包含 returnUrl、商品信息以及商户采集的浏览器与设备信息。 解码内容 · json: object',
  }, {
    fact: 'products keeps required wire string and its declared json_string format.',
    from: 'products string json<object[]> 必填',
    to: 'products string json_string 必填',
  }, {
    fact: 'products retains decoded JSON object[] and explicitly names its object item; the amount constraint is unchanged.',
    from: '顾客购买的商品信息列表；商品金额、折扣和运费合计需要等于 orderAmount。',
    to: '顾客购买的商品信息列表；商品金额、折扣和运费合计需要等于 orderAmount。 解码后数组 · json: object[]; 每个元素: object',
  }],
}

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
const report = { endpoints, browser: browser.version(), samples: [], comparisons: [], status: 'running' }
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
          report.samples.push({ label: endpoint.label, theme, width, name, file, geometry, text, textHash: createHash('sha256').update(text).digest('hex') })
        }
      }
      await page.close()
    }
  }
  for (const row of report.samples.filter(row => row.label === 'base' && row.name)) {
    const head = report.samples.find(other => other.label === 'head' && other.name === row.name && other.width === row.width && other.theme === row.theme)
    const changes = approvedPresentationChanges[row.name] ?? []
    let expectedHeadText = row.text
    for (const change of changes) {
      assert.equal(expectedHeadText.split(change.from).length - 1, 1, `${row.name}: unique approved baseline fragment: ${change.fact}`)
      expectedHeadText = expectedHeadText.replace(change.from, change.to)
    }
    report.comparisons.push({ name: row.name, theme: row.theme, width: row.width,
      baseTextHash: row.textHash, headTextHash: head.textHash, changes, expectedHeadText,
      matches: head.text === expectedHeadText })
    assert.equal(head.text, expectedHeadText, `${row.name}: only approved presentation changes; all remaining rendered text matches`)
  }
  report.status = 'passed'
} catch (error) { report.status = 'failed'; report.error = error.stack; throw error }
finally { await writeFile(path.join(output, 'comparison.json'), JSON.stringify(report, null, 2)); await browser.close() }
