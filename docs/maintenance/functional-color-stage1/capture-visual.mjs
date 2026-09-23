import { chromium } from 'playwright-core'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'
const artifacts = path.resolve('.output/functional-visual')
await mkdir(artifacts, { recursive:true })
const browser = await chromium.launch({channel:'chromium'})
try {
  for (const mode of ['baseline','recommended','amber-solid']) for(const theme of ['light','dark']) {
    const page = await browser.newPage({viewport:{width:1440,height:1000},deviceScaleFactor:1})
    await page.goto(`http://127.0.0.1:4123/__functional-colors?candidate=${mode}`)
    await page.waitForFunction(() => Boolean(window.useNuxtApp))
    await page.evaluate(theme => { window.useNuxtApp().$colorMode.preference=theme },theme)
    await page.waitForFunction(theme => document.documentElement.classList.contains(theme),theme)
    await page.evaluate(()=>document.fonts.ready)
    for (const role of ['primary','warning','error']) {
      const row=page.locator(`[data-role="${role}"]`)
      await row.screenshot({path:path.join(artifacts,`${mode}-${theme}-${role}.png`)})
    }
    await page.close()
  }
} finally {await browser.close()}
