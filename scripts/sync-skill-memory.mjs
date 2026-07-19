#!/usr/bin/env node
// sync-skill-memory.mjs — turn a downloaded runnable Source-first root snapshot
// into a deterministic sync plan for the v0 memory area. OFFLINE ONLY: no network,
// no gh, no git.
//
// WHY OFFLINE
//   Two hard constraints shape this:
//   1. The v0 memory area (v0_memories/) is a virtual overlay reachable ONLY from
//      v0's AI file tools (Read/Write/Move/Delete/Glob), never from Bash. A script
//      therefore CANNOT write it — it can only prepare a plan the AI then applies.
//   2. `gh` authentication does not reliably propagate to a node-spawned child, so
//      this script never calls gh. The caller downloads the release with a direct
//      `gh` command (top-level, reliably authed), then hands the artifact here.
//
// WHAT IT DOES
//   Given dist-skill.tar.gz (or an already-unpacked dir), it unpacks if needed,
//   lists every file in the runnable root snapshot, and emits the complete desired
//   state of the memory area. The AI applies a wholesale overwrite: root app,
//   foundation, kits, playground, registry tools, configs and references together.
//
// USAGE (see references/maintenance/sync.md for the full flow, incl. the gh download)
//   node scripts/sync-skill-memory.mjs <path-to-dist-skill.tar.gz>
//   node scripts/sync-skill-memory.mjs <path-to-unpacked-dir>

import { execFileSync } from 'node:child_process'
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  existsSync,
  statSync,
  lstatSync,
  readdirSync,
  rmSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

const MEMORY_ROOT = 'v0_memories/team/skills/geist-nuxt'

const input = process.argv[2]
if (!input) {
  console.error(
    'Usage: node scripts/sync-skill-memory.mjs <dist-skill.tar.gz | unpacked-dir>\n' +
      'Download the artifact first with a direct gh command (see references/maintenance/sync.md).',
  )
  process.exit(1)
}

const inputPath = resolve(input)
if (!existsSync(inputPath)) {
  console.error(`Not found: ${inputPath}`)
  process.exit(1)
}

// Resolve to an unpacked directory.
let dist
if (statSync(inputPath).isDirectory()) {
  dist = inputPath
} else {
  const work = mkdtempSync(join(tmpdir(), 'skill-sync-'))
  dist = join(work, 'dist')
  mkdirSync(dist, { recursive: true })
  console.log(`Unpacking ${inputPath} ...`)
  execFileSync('tar', ['xzf', inputPath, '-C', dist])
}

function walk(dir, base = dir, out = []) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name)
    // lstat (not stat) so symlinks are never followed: a crafted dist could
    // otherwise point walk() outside the artifact. Skip links entirely.
    const st = lstatSync(full)
    if (st.isSymbolicLink()) continue
    if (st.isDirectory()) walk(full, base, out)
    else out.push(full.slice(base.length + 1))
  }
  return out
}

const files = walk(dist).sort()
const release = existsSync(join(dist, 'RELEASE'))
  ? readFileSync(join(dist, 'RELEASE'), 'utf8').trim()
  : '(no RELEASE stamp in this artifact)'

const manifest = { release, root: dist, memoryRoot: MEMORY_ROOT, fileCount: files.length, files }
// Pin the manifest to a dedicated temp dir. Deriving it from `dist/..` would land in
// the parent of a caller-supplied unpacked dir (possibly the repo, or anywhere), so
// isolate it instead. Reuse this dir for any prior plan dirs' cleanup below.
const planDir = mkdtempSync(join(tmpdir(), 'skill-sync-plan-'))
const manifestPath = join(planDir, 'sync-manifest.json')
writeFileSync(manifestPath, JSON.stringify(manifest, null, 2))

// Best-effort cleanup of stale plan dirs from previous runs so /tmp doesn't grow
// unbounded. Never touch the one we just wrote.
try {
  for (const name of readdirSync(tmpdir())) {
    if (name.startsWith('skill-sync-plan-') && join(tmpdir(), name) !== planDir) {
      rmSync(join(tmpdir(), name), { recursive: true, force: true })
    }
  }
} catch {
  // cleanup is non-fatal; ignore
}

console.log(`\nRelease stamp : ${release}`)
console.log(`Unpacked dir  : ${dist}`)
console.log(`Files         : ${files.length}`)
console.log(`Manifest      : ${manifestPath}`)
console.log(
  `\n=== NEXT — the AI applies this plan (Bash cannot write the memory area) ===\n` +
    `1. Read the manifest above.\n` +
    `2. For each file f in manifest.files: Move(operation="copy") ${dist}/f  ->  ${MEMORY_ROOT}/f\n` +
    `3. Glob ${MEMORY_ROOT}/** and Delete any file NOT in manifest.files.\n` +
    `   EXCEPTION: never touch ${MEMORY_ROOT}/skills/** — separate skills system, not part of this dist.\n` +
    `   NOTE: manifest.files includes a top-level RELEASE freshness stamp — copy it like any\n` +
    `   other file; it is not stray content, do not delete it.\n` +
    `This is a wholesale overwrite: the manifest is the complete desired state.`,
)
