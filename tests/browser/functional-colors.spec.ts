import { expect, test } from 'vitest'
import { parseColor } from '../../scripts/lib/text-contrast.mjs'
import { pickRole, pickSurface, roles, scenario, settle, setupFunctionalTests, snapshot, surfaces, variants } from './functional-support'

await setupFunctionalTests()

for (const theme of ['light', 'dark'] as const) for (const width of [1440, 390]) {
  test(`${theme}/${width}: instance Button hover and active overrides keep their precedence`, () => scenario(theme, width, 'instance-overrides', async (page, capture) => {
    for (const kind of ['ui', 'class']) {
      const button = page.locator(`[data-audit="button-${kind}-override"]`)
      await button.hover(); await settle(button)
      const hover = await snapshot(button)
      const error = await button.evaluate(element => getComputedStyle(element).getPropertyValue('--ui-error'))
      expect(hover.hover).toBe(true)
      expect(parseColor(hover.background)).toEqual(parseColor(error))
      await capture(button.locator('[data-label]'), { component: 'Button instance override', slot: kind, state: 'hover', host: hover })
      await page.mouse.down(); await settle(button)
      const active = await snapshot(button)
      const success = await button.evaluate(element => getComputedStyle(element).getPropertyValue('--ui-success'))
      expect(active.active).toBe(true)
      expect(parseColor(active.background)).toEqual(parseColor(success))
      await capture(button.locator('[data-label]'), { component: 'Button instance override', slot: kind, state: 'active', host: active })
      await page.mouse.up(); await page.mouse.move(0, 0)
    }
  }, '/__functional-contrast?case=instance-overrides'))
  for (const surface of surfaces) {
    test(`${theme}/${width}/${surface}: six functional roles and native component states`, () => scenario(theme, width, `matrix-${surface}`, async (page, capture) => {
      const section = await pickSurface(page, surface)
      for (const role of roles) {
        await pickRole(page, role)
        const row = section.locator(`[data-role="${role}"]`)
        const meta = { surface, role }
        await capture(row.locator('[data-audit="role-text"]'), { ...meta, component: 'semantic text', slot: 'text', state: 'idle' })
        for (const variant of variants) {
          await capture(row.locator(`[data-audit="badge-${variant}"]`), { ...meta, component: 'Badge', variant, slot: 'base', state: 'idle' })
          for (const slot of ['title', 'description']) await capture(row.locator(`[data-audit="alert-${variant}"] [data-slot="${slot}"]`), { ...meta, component: 'Alert', variant, slot, state: 'idle' })
        }
        for (const variant of ['solid', 'link']) {
          const button = row.locator(`[data-audit="button-${variant}"]`)
          await button.evaluate(element => element.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'instant' }))
          const label = button.locator('[data-label]')
          const buttonMeta = { ...meta, component: 'Button', variant, slot: 'base/label' }
          await page.mouse.move(0, 0)
          await button.evaluate(element => (element as HTMLElement).blur())
          await settle(button)
          await capture(label, { ...buttonMeta, state: 'idle', host: await snapshot(button) })
          await button.hover(); await settle(button)
          expect(await button.evaluate(element => element.matches(':hover'))).toBe(true)
          await capture(label, { ...buttonMeta, state: 'hover', host: await snapshot(button) })
          await page.mouse.down(); await settle(button)
          expect(await button.evaluate(element => element.matches(':active'))).toBe(true)
          await capture(label, { ...buttonMeta, state: 'active+hover', host: await snapshot(button) })
          await page.mouse.up(); await page.mouse.move(0, 0)
          // Real keyboard traversal from the native focus position verifies focus-visible.
          expect(await button.evaluate(element => document.activeElement === element)).toBe(true)
          await page.keyboard.press('Shift+Tab'); await page.keyboard.press('Tab')
          expect(await button.evaluate(element => element.matches(':focus-visible'))).toBe(true)
          await settle(button)
          await capture(label, { ...buttonMeta, state: 'keyboard-focus', host: await snapshot(button) })
          await page.keyboard.down('Space'); await settle(button)
          expect(await button.evaluate(element => element.matches(':active') && element.matches(':focus-visible'))).toBe(true)
          await capture(label, { ...buttonMeta, state: 'keyboard-active+focus', host: await snapshot(button) })
          await page.keyboard.up('Space')
          await button.hover(); await settle(button)
          expect(await button.evaluate(element => element.matches(':focus-visible') && element.matches(':hover'))).toBe(true)
          await capture(label, { ...buttonMeta, state: 'focus+hover', host: await snapshot(button) })
          await page.mouse.move(0, 0); await page.keyboard.press('Tab')
        }
      }
      await capture(section.locator('[data-audit="form-field"] [data-slot="error"]'), { surface, component: 'FormField', slot: 'error', role: 'error', state: 'visible' })
    }), 180_000)
    test(`${theme}/${width}/${surface}: API consumers and real FieldAnnotation portals`, () => scenario(theme, width, `api-${surface}`, async (page, capture) => {
      const section = await pickSurface(page, surface)
      for (const [selector, id] of [
        ['[data-field-example="required"] [data-field-requiredness]', 'F1'],
        ['[data-field-example="conditional"] [data-field-requiredness]', 'F2'],
        ['[data-field-caveat] > span', 'F5-field-caveat'],
        ['[data-value-caveat] > span', 'value-caveat'],
      ]) await capture(section.locator(selector!), { surface, component: 'API fixture', id, state: 'idle' })
      await capture(section.locator('[data-response-status] [data-slot="base"] > span.font-mono, [data-response-status] [data-slot="base"] > span.font-sans'), { surface, component: 'ResponseExample', slot: 'status/statusText', state: 'single status visible' })
      await capture(section.locator('[data-lifecycle] [data-slot="title"], [data-lifecycle] [data-slot="description"], [data-lifecycle="new"] [data-slot="base"]'), { surface, component: 'LifecycleNotice/Badge', state: 'idle' })
      for (const kind of ['required', 'conditional']) {
        const trigger = section.locator(`[data-annotation="${kind}"] button`)
        await trigger.click()
        const popup = page.locator('[data-reka-popper-content-wrapper] [data-slot="content"]').filter({ visible: true })
        await popup.waitFor(); await settle(popup)
        await capture(popup.locator(kind === 'required' ? '.text-error' : '.text-warning'), { surface: 'portal own bg-default', triggerSurface: surface, component: 'FieldAnnotation', slot: kind, state: 'open' })
        await page.keyboard.press('Escape'); await popup.waitFor({ state: 'hidden' })
      }
    }, '/__functional-contrast?case=api'))
  }
  test(`${theme}/${width}: actual FormField required generated text and error`, () => scenario(theme, width, 'required', async (page, capture) => {
    for (const surface of surfaces) {
      const section = await pickSurface(page, surface)
      await capture(section.locator('[data-slot="label"]'), { surface, component: 'FormField', slot: 'required ::after', role: 'error', state: 'generated star visible' }, '::after')
      await capture(section.locator('[data-slot="error"]'), { surface, component: 'FormField required+error', slot: 'error', role: 'error', state: 'required star present' })
    }
  }, '/__functional-contrast?case=required-marker'))
}
