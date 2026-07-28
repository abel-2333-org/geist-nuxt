import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { lstat, mkdtemp, readFile, readlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../', import.meta.url))
const hook = path.join(root, '.claude/hooks/check-ufffd.sh')

function runHook(payload, env = process.env) {
  return spawnSync('/bin/bash', [hook], {
    input: payload,
    encoding: 'utf8',
    env,
  })
}

test('tracks Claude Code links for every locked agent skill', async () => {
  const lock = JSON.parse(await readFile(path.join(root, 'skills-lock.json'), 'utf8'))

  for (const name of Object.keys(lock.skills)) {
    const link = path.join(root, '.claude/skills', name)
    assert.equal((await lstat(link)).isSymbolicLink(), true, `${name} must be a symlink`)
    assert.equal(await readlink(link), `../../.agents/skills/${name}`)
  }

  assert.equal(
    await readlink(path.join(root, '.claude/skills/geist-nuxt/SKILL.md')),
    '../../../SKILL.md',
  )
})

test('reports U+FFFD and stays silent for clean or pathless events', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'geist-agent-hook-'))
  const dirty = path.join(dir, 'dirty.txt')
  const clean = path.join(dir, 'clean.txt')
  const replacement = String.fromCodePoint(0xfffd)
  await writeFile(dirty, `ok\n坏${replacement}字\n`)
  await writeFile(clean, 'ok\n')

  const hit = runHook(JSON.stringify({ tool_response: { filePath: dirty } }))
  assert.equal(hit.status, 0)
  assert.equal(JSON.parse(hit.stdout).hookSpecificOutput.hookEventName, 'PostToolUse')
  assert.match(hit.stdout, /line 2/)

  const miss = runHook(JSON.stringify({ tool_input: { file_path: clean } }))
  assert.equal(miss.status, 0)
  assert.equal(miss.stdout, '')

  const pathless = runHook(JSON.stringify({ tool_input: {} }))
  assert.equal(pathless.status, 0)
  assert.equal(pathless.stdout, '')
})

test('fails visibly when the hook cannot validate its input', async () => {
  const malformed = runHook('{not-json}')
  assert.equal(malformed.status, 2)
  assert.match(malformed.stderr, /invalid PostToolUse JSON payload/)

  const emptyPath = await mkdtemp(path.join(tmpdir(), 'geist-agent-path-'))
  const missingJq = runHook('{}', { ...process.env, PATH: emptyPath })
  assert.equal(missingJq.status, 2)
  assert.match(missingJq.stderr, /jq is required/)
})

test('locks the root-only agent snapshot boundary', async () => {
  const workflow = await readFile(path.join(root, '.github/workflows/skill.yml'), 'utf8')

  assert.match(workflow, /--exclude '\/\.agents\/'/)
  assert.match(workflow, /--exclude '\/\.claude\/'/)
  assert.match(workflow, /group: skill-\$\{\{ github\.event\.pull_request\.number \|\| github\.ref \}\}/)
  assert.match(workflow, /LIVE_MAIN_SHA=.*commits\/main/)
  assert.match(workflow, /\[ "\$LIVE_MAIN_SHA" != "\$GITHUB_SHA" \]/)
  assert.match(workflow, /test:consumer:upgrade -- --upgrade-from "\$BASE_SHA" --to "\$MERGE_SHA" --skip-install/)

  const archiveGuard = workflow.match(/tar tzf dist-skill\.tar\.gz \| grep -E '([^']+)'/)
  assert.ok(archiveGuard)

  const blocked = new RegExp(archiveGuard[1])
  assert.match('./.agents/skills/private/SKILL.md', blocked)
  assert.match('./.claude/settings.json', blocked)
  assert.doesNotMatch('./docs/example/.claude/fixture.json', blocked)
})

test('locks the Source-first repository boundary', async () => {
  const config = JSON.parse(await readFile(path.join(root, 'v0.json'), 'utf8'))
  assert.equal(config.starter.source, 'skill-directory')
  assert.equal(config.starter.path, '.')

  const retiredPaths = [
    'apps',
    'assets',
    'docs/archive',
    'exports',
    'packages',
    'pnpm-workspace.yaml',
    'starter',
  ]
  for (const retiredPath of retiredPaths) {
    await assert.rejects(
      lstat(path.join(root, retiredPath)),
      error => error?.code === 'ENOENT',
      `${retiredPath} must not return as a live repository boundary`,
    )
  }
})
