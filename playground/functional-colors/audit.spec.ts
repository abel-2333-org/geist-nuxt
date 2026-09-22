import { readFile, mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { setup, createPage } from '@nuxt/test-utils/e2e'
import { expect, test } from 'vitest'
import type { Locator, Page } from 'playwright-core'
import { contrastSource } from '../../scripts/lib/contrast-build.mjs'
import { measure } from '../../tests/browser/measure'
import { roles } from './candidates.mjs'

const root = process.cwd()
const output = resolve(root, '.output/functional-colors')
const artifacts = resolve(root, process.env.GEIST_FUNCTIONAL_ARTIFACTS || '.output/functional-artifacts')
const source = JSON.parse(await readFile(resolve(output, 'source.json'), 'utf8'))
const current = await contrastSource(root)
if (source.sha !== current.sha || source.digest !== current.digest) throw new Error('Stale stage 1 build')
await mkdir(artifacts, { recursive: true })
await setup({ rootDir: root, runner: 'vitest', dev: false, build: false, server: true, browser: true,
  browserOptions: { type: 'chromium', launch: { channel: 'chromium' } },
  nuxtConfig: { nitro: { output: { dir: output } } },
  setupTimeout: 120000, serverStartTimeout: 60000, teardownTimeout: 30000,
})
const modes = (process.env.GEIST_FUNCTIONAL_MODES || 'baseline,recommended,amber-solid').split(',')
const surfaces = ['default', 'muted', 'elevated', 'accented']
const variants = ['solid', 'outline', 'soft', 'subtle']
const settled = async (node: Locator) => {
  await expect.poll(() => node.evaluate(el => el.getAnimations({ subtree: true }).filter(a => a.pending || a.playState === 'running').length)).toBe(0)
}
async function prepare(page: Page, theme: string) {
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.evaluate(theme => { (window as any).useNuxtApp().$colorMode.preference = theme }, theme)
  await expect.poll(() => page.locator('html').getAttribute('class')).toContain(theme)
  await page.evaluate(() => document.fonts.ready)
  await page.mouse.move(0, 0)
}
async function snapshot(node: Locator, pseudo: string | null = null) {
  return node.evaluate((el, pseudo) => {
    const css = getComputedStyle(el, pseudo)
    return { tag: el.tagName, class: el.getAttribute('class'), slot: el.getAttribute('data-slot'), text: el.textContent,
      color: css.color, background: css.backgroundColor, opacity: css.opacity, content: css.content,
      hover: el.matches(':hover'), active: el.matches(':active'), focusVisible: el.matches(':focus-visible'),
      rect: el.getBoundingClientRect().toJSON(), pseudo }
  }, pseudo)
}
for (const mode of modes) for (const theme of ['light', 'dark']) {
  test(`${mode}/${theme}: full audit (contrast failures are retained)`, async () => {
    const records: any[] = [], runtime: any[] = [], consoleErrors: string[] = []
    const page = await createPage(`/__functional-colors?candidate=${mode}`)
    page.on('pageerror', error => consoleErrors.push(String(error)))
    await page.context().tracing.start({ screenshots: true, snapshots: true })
    let infrastructureError: string | undefined
    const capture = async (target: Locator, meta: Record<string, unknown>, required = true) => {
      const count = await target.count()
      if (!count && required) records.push({ ...meta, status: 'unverified', reason: 'required selector matched zero nodes' })
      for (let index = 0; index < count; index++) {
        const node = target.nth(index)
        if (!await node.isVisible()) { records.push({ ...meta, index, status: 'unverified', reason: 'not visible in this state' }); continue }
        await node.scrollIntoViewIfNeeded()
        const computed = await snapshot(node)
        try {
          const paint = await measure(node)
          records.push({ ...meta, index, computed, ...paint, status: paint.ratio >= 4.5 ? 'pass' : 'fail' })
        } catch (error) {
          records.push({ ...meta, index, computed, status: 'unresolved', reason: String(error) })
        }
      }
    }
    try {
      await prepare(page, theme)
      expect(await page.locator('html').getAttribute('data-functional-preview')).toBe(mode)
      runtime.push(await page.evaluate(() => ({ fonts: Array.from(document.fonts).map(f => ({ family: f.family, status: f.status })),
        colors: Object.fromEntries(['primary','secondary','success','info','warning','error','text','text-inverted','bg','bg-muted','bg-elevated','bg-accented'].map(k => [k, getComputedStyle(document.documentElement).getPropertyValue(`--ui-${k}`)])) })))
      for (const surface of surfaces) {
        if (surface !== 'default') {
          await page.getByTestId('surface-picker').click()
          await page.getByRole('option', { name: surface, exact: true }).click()
          await page.getByRole('listbox').waitFor({ state: 'hidden' })
        }
        const section = page.locator(`[data-surface="${surface}"]`)
        await section.waitFor()
        await page.mouse.move(0, 0)
        for (const role of roles) {
          const row = section.locator(`[data-role="${role}"]`)
          const meta = { route: '/__functional-colors', surface, role, theme, mode }
          await capture(row.locator('[data-audit="role-text"]'), { ...meta, component: 'semantic text', slot: 'text', state: 'idle' })
          for (const variant of variants) {
            await capture(row.locator(`[data-audit="badge-${variant}"]`), { ...meta, component: 'Badge', variant, slot: 'base', state: 'idle' })
            for (const slot of ['title', 'description']) await capture(row.locator(`[data-audit="alert-${variant}"] [data-slot="${slot}"]`), { ...meta, component: 'Alert', variant, slot, state: 'idle' })
          }
          for (const variant of ['solid', 'link']) {
            const button = row.locator(`[data-audit="button-${variant}"]`)
            const label = button.locator('[data-label]')
            const buttonMeta = { ...meta, component: 'Button', variant, slot: 'base/label' }
            await page.mouse.move(0, 0)
            await button.evaluate(el => (el as HTMLElement).blur())
            await settled(button)
            await capture(label, { ...buttonMeta, state: 'idle', host: await snapshot(button) })
            await button.hover(); await settled(button)
            expect(await button.evaluate(el => el.matches(':hover'))).toBe(true)
            await capture(label, { ...buttonMeta, state: 'hover', host: await snapshot(button) })
            await page.mouse.down(); await settled(button)
            expect(await button.evaluate(el => el.matches(':active'))).toBe(true)
            await capture(label, { ...buttonMeta, state: 'active+hover', host: await snapshot(button) })
            await page.mouse.up(); await page.mouse.move(0, 0)
            // Real Tab reaches the target from its prior focus position.
            await button.focus(); await page.keyboard.press('Shift+Tab'); await page.keyboard.press('Tab')
            expect(await button.evaluate(el => el.matches(':focus-visible'))).toBe(true)
            await settled(button)
            await capture(label, { ...buttonMeta, state: 'keyboard-focus', host: await snapshot(button) })
            await page.keyboard.down('Space'); await settled(button)
            expect(await button.evaluate(el => el.matches(':active') && el.matches(':focus-visible'))).toBe(true)
            await capture(label, { ...buttonMeta, state: 'keyboard-active+focus', host: await snapshot(button) })
            await page.keyboard.up('Space')
            await button.hover(); await settled(button)
            expect(await button.evaluate(el => el.matches(':focus-visible') && el.matches(':hover'))).toBe(true)
            await capture(label, { ...buttonMeta, state: 'focus+hover', host: await snapshot(button) })
            await page.mouse.move(0, 0); await page.keyboard.press('Tab')
          }
        }
        await capture(section.locator('[data-audit="form-field"] [data-slot="error"]'), { theme, mode, surface, component: 'FormField', slot: 'error', role: 'error', state: 'visible' })
        for (const [selector, id] of [
          ['[data-field-example="required"] [data-field-requiredness]', 'F1'],
          ['[data-field-example="conditional"] [data-field-requiredness]', 'F2'],
          ['[data-field-caveat] > span', 'F5-field-caveat'],
          ['[data-value-caveat] > span', 'value-caveat'],
        ]) await capture(section.locator(selector!), { theme, mode, surface, component: 'API fixture', id, state: 'idle' })
        await capture(section.locator('[data-response-status] [data-slot="base"] > span.font-mono, [data-response-status] [data-slot="base"] > span.font-sans'), { theme, mode, surface, component: 'ResponseExample', slot: 'status/statusText', state: 'single status visible' })
        await capture(section.locator('[data-lifecycle] [data-slot="title"], [data-lifecycle] [data-slot="description"]'), { theme, mode, surface, component: 'LifecycleNotice', state: 'idle' })
        for (const kind of ['required', 'conditional']) {
          const trigger = section.locator(`[data-annotation="${kind}"] button`)
          await trigger.click()
          const popup = page.locator('[data-reka-popper-content-wrapper] [data-slot="content"]').filter({ visible: true })
          await popup.waitFor(); await settled(popup)
          await capture(popup.locator(kind === 'required' ? '.text-error' : '.text-warning'), { theme, mode, surface: 'portal own bg-default', triggerSurface: surface, component: 'FieldAnnotation', slot: kind, state: 'open' })
          await page.screenshot({ path: resolve(artifacts, `${mode}-${theme}-${surface}-portal-${kind}.png`) })
          await page.keyboard.press('Escape'); await popup.waitFor({ state: 'hidden' })
        }
        await page.mouse.move(0, 0)
        await page.screenshot({ path: resolve(artifacts, `${mode}-${theme}-${surface}-matrix.png`), fullPage: true })
        if (surface === 'default') {
          await page.setViewportSize({ width: 390, height: 844 })
          await page.screenshot({ path: resolve(artifacts, `${mode}-${theme}-${surface}-matrix-390.png`), fullPage: true })
          await page.setViewportSize({ width: 1440, height: 1000 })
        }
      }
      await page.goto(new URL(`/__functional-colors?candidate=${mode}&case=required-marker`, page.url()).href)
      await prepare(page, theme)
      for (const surface of surfaces) {
        if (surface !== 'default') {
          await page.getByTestId('surface-picker').click()
          await page.getByRole('option', { name: surface, exact: true }).click()
          await page.getByRole('listbox').waitFor({ state: 'hidden' })
        }
        const label = page.locator('[data-audit="form-field"] [data-slot="label"]')
        records.push({ theme, mode, surface, component: 'FormField', slot: 'required ::after', role: 'error', status: 'unverified',
          reason: 'Existing measure has no generated-content glyph geometry; computed pseudo retained without claiming ratio.', computed: await snapshot(label, '::after') })
        await capture(page.locator('[data-audit="form-field"] [data-slot="error"]'), { theme, mode, surface, component: 'FormField required+error', slot: 'error', state: 'required marker present' })
        await page.screenshot({ path: resolve(artifacts, `${mode}-${theme}-${surface}-required-marker.png`), fullPage: true })
      }
      for (const route of ['/kits/api-docs', '/kits/api-docs/endpoint-reference', '/kits/api-docs/webhook-reference']) {
        await page.goto(new URL(`${route}?candidate=${mode}`, page.url()).href)
        await prepare(page, theme)
        const meta = { theme, mode, route, surface: 'actual page layers', state: 'visible idle' }
        await capture(page.locator('[data-field-requiredness].text-error').filter({ visible: true }), { ...meta, id: 'F1', role: 'error' }, false)
        await capture(page.locator('[data-field-requiredness].text-warning').filter({ visible: true }), { ...meta, id: 'F2', role: 'warning' }, false)
        for (const [id, role, text] of [['F3','info','GET'], ['F4','success','POST|New|Active'], ['F5','warning','PUT|Beta|Maintenance'], ['F6','secondary','PATCH'], ['F7','error','DELETE'], ['F8','error','Sunsetting']]) {
          await capture(page.locator('[data-slot="base"]').filter({ hasText: new RegExp(`^\\s*(?:${text})\\s*$`), visible: true }), { ...meta, id, role }, route === '/kits/api-docs')
        }
        await capture(page.locator('[data-field-caveat] > span').filter({ visible: true }), { ...meta, id: 'F5-field-caveat', role: 'warning' }, false)
        await capture(page.locator('[data-value-caveat] > span').filter({ visible: true }), { ...meta, id: 'value-caveat', role: 'warning' }, false)
        await capture(page.locator('[data-slot="base"] > span.font-mono').filter({ hasText: /^\s*200\s*$/, visible: true }), { ...meta, id: 'F9', role: 'success' }, true)
        await capture(page.locator('[data-slot="base"] > span.font-sans').filter({ visible: true }), { ...meta, id: 'response-statusText' }, false)
        await capture(page.locator('[data-slot="root"][data-orientation] [data-slot="title"], [data-slot="root"][data-orientation] [data-slot="description"]').filter({ visible: true }), { ...meta, id: 'actual-page-alert' }, false)
        await page.screenshot({ path: resolve(artifacts, `${mode}-${theme}-${route.split('/').pop()}.png`), fullPage: true })
        await page.setViewportSize({ width: 390, height: 844 })
        await page.screenshot({ path: resolve(artifacts, `${mode}-${theme}-${route.split('/').pop()}-390.png`), fullPage: true })
      }
    } catch (error) { infrastructureError = String(error) }
    finally {
      const summary = Object.fromEntries(['pass','fail','unresolved','unverified'].map(status => [status, records.filter(r => r.status === status).length]))
      await writeFile(resolve(artifacts, `${mode}-${theme}.json`), JSON.stringify({ source, mode, theme, browser: page.context().browser()?.version(), runtime, consoleErrors, infrastructureError, summary, records }, null, 2))
      await page.context().tracing.stop({ path: resolve(artifacts, `${mode}-${theme}-trace.zip`) })
      await page.context().close()
      console.log(mode, theme, summary, infrastructureError || '')
    }
    expect(infrastructureError, 'audit must finish all states').toBeUndefined()
    expect(records.filter(r => r.status !== 'pass').length, 'raw failures/unresolved/unverified are audit findings, not fixed in stage 1').toBe(0)
  })
}
