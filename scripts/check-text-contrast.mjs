#!/usr/bin/env node
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { assertTextContrast } from './lib/text-contrast.mjs'

const scriptPath = fileURLToPath(import.meta.url)
const foundationCss = fileURLToPath(new URL('../foundation/assets/css/main.css', import.meta.url))

export async function checkTextContrastFile(cssPath = foundationCss) {
  return assertTextContrast(await readFile(cssPath, 'utf8'), { from: cssPath })
}

if (process.argv[1] && path.resolve(process.argv[1]) === scriptPath) {
  try {
    if (process.argv.length > 3) throw new Error('Usage: node scripts/check-text-contrast.mjs [foundation-css-path]')
    const result = await checkTextContrastFile(process.argv[2])
    console.log(`Normal text contrast passed: ${result.pairs.length}/${result.pairs.length}; minimum ${result.minimumRatio}:1`)
  }
  catch (error) {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  }
}
