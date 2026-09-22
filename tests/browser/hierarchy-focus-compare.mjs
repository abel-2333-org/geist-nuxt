import assert from 'node:assert/strict'
import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
const root = path.resolve(process.env.EVIDENCE_DIR || 'output/playwright/pr153/supplement')
const read = async label => JSON.parse(await readFile(path.join(root, `${label}-focus/focus-report.json`), 'utf8'))
const base = await read('base'), head = await read('head')
const report = { base: base.sourceSha, head: head.sourceSha, browser: head.browser, cases: [], status: 'running' }
try {
  assert.equal(head.browser, base.browser, 'same browser')
  assert.deepEqual(head.viewport, base.viewport, 'same viewport')
  for (const source of [base, head]) {
    assert.ok(['passed', 'findings-require-baseline-comparison'].includes(source.status), 'all focus scenarios must execute without coverage gaps')
    assert.equal(source.cases.length, 6)
  }
  for (const current of head.cases) {
    const before = base.cases.find(row => row.label === current.label && row.mode === current.mode)
    assert.ok(before, 'matching baseline scenario')
    const settledInvisible = row => row.settled.inside && (row.settled.hidden !== null || !row.settled.visible || row.settled.unclippedPixels === 0)
    assert.ok(!settledInvisible(current) || settledInvisible(before), `${current.label}/${current.mode}: new invisible focus after closure`)
    const inherited = before.status === 'finding' && current.status === 'finding'
    report.cases.push({ label: current.label, mode: current.mode, baseline: before.status, head: current.status,
      classification: inherited ? 'inherited-finding-not-fixed' : current.status === 'finding' ? 'regression' : before.status === 'finding' ? 'improved' : 'no-finding',
      baselineSettledFocus: before.settled.active, headSettledFocus: current.settled.active,
      baselineTabDuringAnimation: before.tabDuringCloseAnimation, headTabDuringAnimation: current.tabDuringCloseAnimation })
    assert.ok(current.status !== 'finding' || inherited, `${current.label}/${current.mode}: new invisible focus regression`)
  }
  report.status = report.cases.some(row => row.classification === 'inherited-finding-not-fixed') ? 'verified-with-inherited-findings' : 'passed'
} catch (error) { report.status = 'failed'; report.error = error.stack; process.exitCode = 1 }
await writeFile(path.join(root, 'focus-comparison.json'), JSON.stringify(report, null, 2))
console.log(`Focus comparison: ${report.status}`)
