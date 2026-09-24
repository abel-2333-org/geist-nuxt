import { expect, test } from 'vitest'
import type { Locator } from 'playwright-core'
import { measure } from './measure'
import { scenario, setupFunctionalTests } from './functional-support'

await setupFunctionalTests()

const pages = [
  { name: 'endpoint-reference', route: '/kits/api-docs/endpoint-reference', ordinary: 'res_createdAt' },
  { name: 'webhook-reference', route: '/kits/api-docs/webhook-reference', ordinary: 'payload_createdAt' },
  { name: 'index', route: '/kits/api-docs', ordinary: 'out_settledAt' },
] as const
// The adjacent translated-off span is the independent formatToken, not the
// wire-type span, requiredness badge, or lifecycle badge later in the row.
const formatSelector = '[data-field-type] + span[translate="no"]'

for (const theme of ['light', 'dark'] as const) {
  for (const width of [1440, 390]) {
    for (const entry of pages) {
      test(`${theme} ${width}: ${entry.name} independent format and shape text`, () =>
        scenario(theme, width, `field-format-${entry.name}`, async (page, capture, evidence) => {
          const ordinary = page.locator(`#${entry.ordinary} [data-field-identity]`).first()
            .locator(':scope > ' + formatSelector)
          await expect.poll(() => ordinary.textContent()).toBe('unix_ms')
          const cases: { field: string, branch: string, target: Locator }[] = [{ field: entry.ordinary, branch: 'ordinary-format', target: ordinary }]
          if (entry.name === 'index') {
            const shape = page.locator('#tx_billingInformation [data-field-identity]').first()
              .locator(':scope > ' + formatSelector)
            await expect.poll(() => shape.textContent()).toBe('json<object>')
            cases.push({ field: 'tx_billingInformation', branch: 'shape-leads', target: shape })
          }
          evidence.push({ kind: 'applicability', shapeLeads: entry.name === 'index'
            ? 'covered by tx_billingInformation' : 'not applicable: this page has no decoded-value field' })

          // Also retain every currently visible format label on each real page.
          // Each record carries the field identity instead of treating an
          // unrelated passing type label as evidence for the whole row.
          const formats = page.locator(formatSelector).filter({ visible: true })
          expect(await formats.count(), 'real format labels must exist').toBeGreaterThan(0)
          for (let index = 0; index < await formats.count(); index++) {
            const target = formats.nth(index)
            const field = await target.evaluate(node => node.closest('[id]')?.id)
            expect(field, 'format label belongs to a real field').toBeTruthy()
            await capture(target, { component: 'FieldItem', slot: 'formatToken', field, state: 'idle' })
          }

          for (const item of cases) {
            const wireType = item.target.locator('xpath=preceding-sibling::span[@data-field-type]')
            expect(await wireType.count(), 'one independent wire-type label').toBe(1)
            await capture(wireType, {
              component: 'FieldItem', slot: 'typeExpression', field: item.field, branch: item.branch, state: 'idle',
            })
            // Prove that the independent label is actually measured: making
            // only its foreground equal to its measured backdrop must fail,
            // then restoring the original inline style must pass again.
            const before = (await capture(item.target, {
              component: 'FieldItem', slot: 'formatToken', field: item.field, branch: item.branch, state: 'before-control',
            }))[0]
            expect(before.status).toBe('pass')
            const originalStyle = await item.target.getAttribute('style')
            try {
              await item.target.evaluate((node, background) => {
                (node as HTMLElement).style.setProperty('color', `rgb(${background.slice(0, 3).join(' ')})`, 'important')
              }, before.effectiveBackground)
              const negative = await measure(item.target)
              evidence.push({ kind: 'expected-low-contrast-control', field: item.field, branch: item.branch, ...negative })
              expect(negative.ratio, 'the format label itself must detect the low-contrast control').toBeLessThan(4.5)
            } finally {
              await item.target.evaluate((node, style) => {
                if (style === null) node.removeAttribute('style')
                else node.setAttribute('style', style)
              }, originalStyle)
            }
            await capture(item.target, {
              component: 'FieldItem', slot: 'formatToken', field: item.field, branch: item.branch, state: 'restored',
            })
          }
        }, entry.route))
    }
  }
}
