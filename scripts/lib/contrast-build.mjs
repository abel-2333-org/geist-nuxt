import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { readFile, readdir } from 'node:fs/promises'
import path from 'node:path'

// Includes uncommitted mutations and fixtures. A Git SHA alone cannot identify
// a local mutation build, nor detect edits made after the server was compiled.
export async function contrastSource(root) {
  const hash = createHash('sha256')
  const files = []
  async function visit(relative) {
    const entries = await readdir(path.join(root, relative), { withFileTypes: true })
    for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
      const file = path.posix.join(relative, entry.name)
      if (entry.isDirectory()) await visit(file)
      else if (entry.isFile()) files.push(file)
    }
  }
  for (const directory of ['foundation', 'kits', 'app', 'playground', 'tests/fixtures/contrast', 'tests/browser']) await visit(directory)
  // Evidence identifies both the rendered source and the code interpreting it.
  // A changed measurement algorithm must invalidate an earlier build stamp.
  files.push('nuxt.config.ts', 'package.json', 'pnpm-lock.yaml', 'vitest.browser.config.ts', 'scripts/build-contrast.mjs', 'scripts/lib/contrast-build.mjs', 'scripts/lib/text-contrast.mjs')
  for (const file of files.sort()) hash.update(file).update('\0').update(await readFile(path.join(root, file))).update('\0')
  return { sha: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(), digest: hash.digest('hex') }
}
