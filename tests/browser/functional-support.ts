import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createPage, setup } from '@nuxt/test-utils/e2e'
import { expect } from 'vitest'
import type { Locator, Page } from 'playwright-core'
import { contrastSource } from '../../scripts/lib/contrast-build.mjs'
import { measure } from './measure'

export const roles = ['primary', 'secondary', 'success', 'info', 'warning', 'error'] as const
export const surfaces = ['default', 'muted', 'elevated', 'accented'] as const
export const variants = ['solid', 'outline', 'soft', 'subtle'] as const
export type Theme = 'light' | 'dark'
export type Metadata = Record<string, unknown>
export type Capture = (target: Locator, metadata: Metadata, pseudo?: '::after') => Promise<any[]>
const root = fileURLToPath(new URL('../..', import.meta.url))
const output = resolve(root, '.output/contrast')
export const artifacts = resolve(process.env.GEIST_CONTRAST_ARTIFACTS || resolve(root, '.output/contrast-artifacts'), 'functional')
export const source = JSON.parse(await readFile(resolve(output, 'source.json'), 'utf8'))
const current = await contrastSource(root)
if (source.digest !== current.digest || source.sha !== current.sha) throw new Error('Stale contrast build. Run pnpm build:contrast from the current source first.')
await mkdir(artifacts, { recursive: true })

export async function setupFunctionalTests() {
  await setup({
    rootDir: root, runner: 'vitest', dev: false, build: false, server: true, browser: true,
    browserOptions: { type: 'chromium', launch: { channel: 'chromium' } },
    nuxtConfig: { nitro: { output: { dir: output } } },
    setupTimeout: 120_000, serverStartTimeout: 60_000, teardownTimeout: 30_000,
  })
}

export async function settle(target: Locator) {
  await expect.poll(() => target.evaluate(element => element.getAnimations({ subtree: true })
    .filter(animation => animation.pending || animation.playState === 'running').length)).toBe(0)
}

export async function prepare(page: Page, theme: Theme, width: number) {
  await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 })
  await page.evaluate(theme => { (window as any).useNuxtApp().$colorMode.preference = theme }, theme)
  await expect.poll(() => page.locator('html').getAttribute('class')).toContain(theme)
  await page.evaluate(() => document.fonts.ready)
  await page.mouse.move(0, 0)
}

export async function snapshot(target: Locator, pseudo: string | null = null) {
  return target.evaluate((element, pseudo) => {
    const css = getComputedStyle(element, pseudo)
    return {
      tag: element.tagName, class: element.getAttribute('class'), slot: element.getAttribute('data-slot'),
      text: element.textContent, color: css.color, background: css.backgroundColor, opacity: css.opacity,
      content: css.content, hover: element.matches(':hover'), active: element.matches(':active'),
      focusVisible: element.matches(':focus-visible'), href: element.getAttribute('href'), beforeBackground: getComputedStyle(element, '::before').backgroundColor, ariaSelected: element.getAttribute('aria-selected'), ariaCurrent: element.getAttribute('aria-current'),
      highlighted: element.hasAttribute('data-highlighted'), rect: element.getBoundingClientRect().toJSON(), pseudo,
    }
  }, pseudo)
}

export async function pickRole(page: Page, role: string) {
  if (await page.locator(`[data-role="${role}"]`).count()) return
  await page.getByTestId('role-picker').click()
  await page.getByRole('option', { name: role, exact: true }).click()
  await page.getByRole('listbox').waitFor({ state: 'hidden' })
  await page.locator(`[data-role="${role}"]`).waitFor()
  await page.mouse.move(0, 0)
}

export async function pickSurface(page: Page, surface: string) {
  if (surface !== 'default') {
    await page.getByTestId('surface-picker').click()
    await page.getByRole('option', { name: surface, exact: true }).click()
    await page.getByRole('listbox').waitFor({ state: 'hidden' })
  }
  const section = page.locator(`[data-surface="${surface}"]`)
  await section.waitFor()
  await page.mouse.move(0, 0)
  return section
}

export async function scenario(theme: Theme, width: number, id: string,
  run: (page: Page, capture: Capture, evidence: Metadata[]) => Promise<void>, route = '/__functional-contrast') {
  const page = await createPage(route)
  const records: any[] = [], evidence: Metadata[] = [], pageErrors: string[] = []
  let infrastructureError: string | undefined
  let platformFonts: unknown
  page.on('pageerror', error => pageErrors.push(String(error)))
  await page.context().tracing.start({ screenshots: true, snapshots: true })
  try {
    await prepare(page, theme, width)
    // The regular build must contain only the adopted runtime theme.
    expect(await page.locator('html').getAttribute('data-functional-preview')).toBeNull()
    const cdp = await page.context().newCDPSession(page)
    await cdp.send('DOM.enable'); await cdp.send('CSS.enable')
    const documentNode = await cdp.send('DOM.getDocument')
    const node = await cdp.send('DOM.querySelector', { nodeId: documentNode.root.nodeId, selector: 'h1, h2, [data-field-type]' })
    expect(node.nodeId, 'font evidence targets a real heading or field text').toBeGreaterThan(0)
    platformFonts = await cdp.send('CSS.getPlatformFontsForNode', { nodeId: node.nodeId })
    await cdp.detach()
    const capture: Capture = async (target, metadata, pseudo) => {
      const start = records.length, count = await target.count()
      if (!count) records.push({ theme, width, route: new URL(page.url()).pathname, ...metadata, status: 'unverified', reason: 'required selector matched zero nodes' })
      for (let index = 0; index < count; index++) {
        const item = target.nth(index)
        const context = { theme, width, route: new URL(page.url()).pathname, ...metadata, index }
        if (!await item.isVisible()) { records.push({ ...context, status: 'unverified', reason: 'required node is hidden' }); continue }
        await item.scrollIntoViewIfNeeded()
        // A browser scroll may leave text behind a real sticky header. Scroll
        // the actual document to an unobscured reading position before taking
        // evidence; never remove header paint or retry a rejected measurement.
        const underHeader = await item.evaluate(element => {
          const box = element.getBoundingClientRect()
          return [...document.querySelectorAll('header')].some(header => {
            const css = getComputedStyle(header), rect = header.getBoundingClientRect()
            return ['sticky', 'fixed'].includes(css.position) && rect.bottom > 0 && box.top < rect.bottom
              && box.bottom > rect.top && box.right > rect.left && box.left < rect.right
          })
        })
        if (underHeader) await item.evaluate(element => element.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'instant' }))
        const computed = await snapshot(item, pseudo)
        try {
          const paint = await measure(item, pseudo || null)
          records.push({ ...context, computed, ...paint, status: paint.ratio >= 4.5 ? 'pass' : 'fail' })
        } catch (error) {
          records.push({ ...context, computed, status: 'unresolved', reason: String(error) })
        }
      }
      return records.slice(start)
    }
    await run(page, capture, evidence)
  } catch (error) { infrastructureError = String(error) }
  finally {
    const stem = `${theme}-${width}-${id}`
    const fonts = await page.evaluate(() => Array.from(document.fonts).map(font => ({ family: font.family, status: font.status })))
    await page.screenshot({ path: resolve(artifacts, `${stem}.png`), fullPage: true })
    await page.context().tracing.stop({ path: resolve(artifacts, `${stem}.zip`) })
    const browser = page.context().browser()?.version()
    await page.context().close()
    await writeFile(resolve(artifacts, `${stem}.json`), JSON.stringify({
      source, browser, theme, width, route, fonts, platformFonts, pageErrors, infrastructureError,
      summary: Object.fromEntries(['pass', 'fail', 'unresolved', 'unverified'].map(status => [status, records.filter(record => record.status === status).length])),
      records, evidence,
    }, null, 2))
  }
  expect(infrastructureError, 'all required native states must finish').toBeUndefined()
  expect(pageErrors, 'no runtime page errors').toEqual([])
  expect(records.length, 'nonempty real text measurements').toBeGreaterThan(0)
  expect(records.filter(record => record.status !== 'pass'), 'all ordinary text must resolve at >= 4.5 without rounding').toEqual([])
}
