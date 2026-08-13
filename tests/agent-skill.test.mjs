import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import {
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  readlink,
  rm,
  symlink,
  writeFile,
} from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import {
  AGENT_SKILL_LOCK,
  AGENT_SKILL_ROOT,
  applyAgentSkillPlan,
  CLAUDE_SKILL_LINK,
  CLAUDE_SKILL_TARGET,
  parseAgentSkillArgs,
  planAgentSkill,
  resolveAgentSkillSourceSha,
} from '../scripts/lib/agent-skill.mjs'
import { getCheckoutSha } from '../scripts/lib/registry.mjs'

const root = fileURLToPath(new URL('../', import.meta.url))
const cli = path.join(root, 'scripts/copy-agent-skill.mjs')
const sourceSha = getCheckoutSha(root)

async function makeConsumer() {
  return mkdtemp(path.join(tmpdir(), 'geist-agent-consumer-'))
}

function runCli(args, env = {}) {
  return spawnSync(process.execPath, [cli, ...args], {
    cwd: root,
    encoding: 'utf8',
    env: { ...process.env, GEIST_SKILL_TEST_ALLOW_DIRTY: '1', ...env },
  })
}

async function writeSource(repoRoot, files) {
  const registry = {
    schemaVersion: 1,
    name: 'geist-nuxt',
    repository: 'https://example.com/geist-nuxt',
    items: [],
  }
  const all = {
    'SKILL.md': '---\nname: geist-nuxt\ndescription: test\n---\n',
    'agents/openai.yaml': 'interface:\n  display_name: geist-nuxt\n',
    'references/index.md': '# Test\n',
    'registry.json': `${JSON.stringify(registry, null, 2)}\n`,
    ...files,
  }
  for (const [relative, content] of Object.entries(all)) {
    const target = path.join(repoRoot, relative)
    await mkdir(path.dirname(target), { recursive: true })
    await writeFile(target, content)
  }
}

test('parses only the narrow geist:skill CLI contract', () => {
  assert.deepEqual(parseAgentSkillArgs(['--', '--target', '../app', '--write']), {
    target: '../app',
    write: true,
  })
  assert.throws(() => parseAgentSkillArgs([]), /--target/)
  assert.throws(() => parseAgentSkillArgs(['item']), /does not accept positional/)
  assert.throws(() => parseAgentSkillArgs(['--target', 'app', '--all']), /unsupported/)
  assert.throws(() => parseAgentSkillArgs(['--target', 'app', '--write', '--dry-run']), /cannot be combined/)
  assert.throws(() => parseAgentSkillArgs(['--target', 'app', '--json', '--write']), /dry-run output mode/)
  assert.equal(parseAgentSkillArgs(['--target', 'app', '--json']).json, true)
  assert.throws(() => parseAgentSkillArgs(['--target', 'app', '--consumer', 'other']), /cannot be combined/)
  assert.throws(() => parseAgentSkillArgs(['--target', 'app', '--to', sourceSha, '--sha', sourceSha]), /cannot be combined/)
})

test('installs the consumer skill through dry-run and remains idempotent', async () => {
  const consumer = await makeConsumer()
  const dryRun = runCli(['--target', consumer])
  assert.equal(dryRun.status, 0, dryRun.stderr)
  assert.match(dryRun.stdout, /Dry run/)
  await assert.rejects(lstat(path.join(consumer, AGENT_SKILL_ROOT)), error => error?.code === 'ENOENT')

  const write = runCli(['--target', consumer, '--write'])
  assert.equal(write.status, 0, write.stderr)
  assert.match(write.stdout, /Commit both paths/)
  assert.match(await readFile(path.join(consumer, AGENT_SKILL_ROOT, 'SKILL.md'), 'utf8'), /name: geist-nuxt/)
  assert.equal(await readlink(path.join(consumer, CLAUDE_SKILL_LINK)), CLAUDE_SKILL_TARGET)

  const lock = JSON.parse(await readFile(path.join(consumer, AGENT_SKILL_ROOT, AGENT_SKILL_LOCK), 'utf8'))
  assert.equal(lock.sourceSha, sourceSha)
  assert.ok(lock.files['agents/openai.yaml'])
  assert.ok(lock.files['registry.json'])
  assert.ok(lock.files['references/registry.md'])

  const repeat = runCli(['--target', consumer])
  assert.equal(repeat.status, 0, repeat.stderr)
  assert.doesNotMatch(repeat.stdout, /^(?:create|update|delete)\s/m)
})

test('emits a versioned machine-readable skill plan without writing files', async () => {
  const consumer = await makeConsumer()
  const json = runCli(['--target', consumer, '--json'])
  assert.equal(json.status, 0, json.stderr)
  const document = JSON.parse(json.stdout)
  assert.equal(document.planSchemaVersion, 1)
  assert.equal(document.kind, 'skill')
  assert.equal(document.registry.name, 'geist-nuxt')
  assert.equal(document.sourceSha, sourceSha)
  assert.deepEqual(document.consumer, { lockPresent: false, lockSourceSha: null })
  assert.ok(document.operations.length > 0)
  for (const operation of document.operations) {
    assert.equal(operation.owner, 'skill:geist-nuxt')
    assert.deepEqual(operation.verification, ['reference'])
    assert.equal(operation.action, 'create')
    assert.equal(operation.beforeHash, null)
  }
  const adapter = document.operations.find(operation => operation.target === CLAUDE_SKILL_LINK)
  assert.equal(adapter.link, CLAUDE_SKILL_TARGET)
  assert.equal(adapter.afterHash, null)
  const skillFile = document.operations.find(operation => operation.target === `${AGENT_SKILL_ROOT}/SKILL.md`)
  assert.equal(skillFile.source, 'SKILL.md')
  assert.match(skillFile.afterHash, /^[0-9a-f]{64}$/)
  assert.deepEqual(document.packageOperations, [])
  assert.deepEqual(document.summary.verification, ['reference'])
  assert.equal(document.summary.create, document.operations.length)
  assert.match(document.planDigest, /^[0-9a-f]{64}$/)
  await assert.rejects(lstat(path.join(consumer, AGENT_SKILL_ROOT)), error => error?.code === 'ENOENT')

  const again = runCli(['--target', consumer, '--json'])
  assert.equal(JSON.parse(again.stdout).planDigest, document.planDigest)

  assert.equal(runCli(['--target', consumer, '--write']).status, 0)
  const converged = JSON.parse(runCli(['--target', consumer, '--json']).stdout)
  assert.equal(converged.summary.create + converged.summary.update + converged.summary.delete, 0)
  assert.deepEqual(converged.summary.verification, [])
  assert.deepEqual(converged.consumer, { lockPresent: true, lockSourceSha: sourceSha })

  const combined = runCli(['--target', consumer, '--json', '--write'])
  assert.notEqual(combined.status, 0)
  assert.match(combined.stderr, /dry-run output mode/)
})

test('ignores OS artifacts like .DS_Store under the installed skill', async () => {
  const consumer = await makeConsumer()
  assert.equal(runCli(['--target', consumer, '--write']).status, 0)
  await writeFile(path.join(consumer, AGENT_SKILL_ROOT, '.DS_Store'), 'junk\n')
  await writeFile(path.join(consumer, AGENT_SKILL_ROOT, 'references/.DS_Store'), 'junk\n')

  const repeat = runCli(['--target', consumer])
  assert.equal(repeat.status, 0, repeat.stderr)
  assert.doesNotMatch(repeat.stderr, /unmanaged/)
  assert.doesNotMatch(repeat.stdout, /^(?:create|update|delete)\s/m)

  const rewrite = runCli(['--target', consumer, '--write'])
  assert.equal(rewrite.status, 0, rewrite.stderr)
  assert.equal(await readFile(path.join(consumer, AGENT_SKILL_ROOT, '.DS_Store'), 'utf8'), 'junk\n')
})

test('stops the complete batch when an installed file drifted', async () => {
  const consumer = await makeConsumer()
  assert.equal(runCli(['--target', consumer, '--write']).status, 0)
  const skill = path.join(consumer, AGENT_SKILL_ROOT, 'SKILL.md')
  const registry = path.join(consumer, AGENT_SKILL_ROOT, 'registry.json')
  await writeFile(skill, 'locally changed\n')
  await rm(registry)

  const result = runCli(['--target', consumer, '--write'])
  assert.equal(result.status, 1)
  assert.match(result.stderr, /conflicting target/)
  await assert.rejects(lstat(registry), error => error?.code === 'ENOENT')
  assert.equal(await readFile(skill, 'utf8'), 'locally changed\n')
})

test('updates and deletes managed files without churning the source SHA for identical content', async () => {
  const repoRoot = await mkdtemp(path.join(tmpdir(), 'geist-agent-source-'))
  const consumer = await makeConsumer()
  const firstSha = '1'.repeat(40)
  const secondSha = '2'.repeat(40)
  await writeSource(repoRoot)

  await applyAgentSkillPlan(await planAgentSkill({ repoRoot, consumerRoot: consumer, sourceSha: firstSha }))
  const unchanged = await planAgentSkill({ repoRoot, consumerRoot: consumer, sourceSha: secondSha })
  assert.ok(unchanged.operations.every(operation => operation.action === 'unchanged'))
  await applyAgentSkillPlan(unchanged)
  let lock = JSON.parse(await readFile(path.join(consumer, AGENT_SKILL_ROOT, AGENT_SKILL_LOCK), 'utf8'))
  assert.equal(lock.sourceSha, firstSha)

  await writeFile(path.join(repoRoot, 'references/index.md'), '# Updated\n')
  await writeFile(path.join(repoRoot, 'references/new.md'), '# New\n')
  const changed = await planAgentSkill({ repoRoot, consumerRoot: consumer, sourceSha: secondSha })
  assert.ok(changed.operations.some(operation => operation.action === 'update'))
  assert.ok(changed.operations.some(operation => operation.action === 'create'))
  await applyAgentSkillPlan(changed)
  lock = JSON.parse(await readFile(path.join(consumer, AGENT_SKILL_ROOT, AGENT_SKILL_LOCK), 'utf8'))
  assert.equal(lock.sourceSha, secondSha)

  await rm(path.join(repoRoot, 'references/new.md'))
  const removed = await planAgentSkill({ repoRoot, consumerRoot: consumer, sourceSha: '3'.repeat(40) })
  assert.ok(removed.operations.some(operation => operation.action === 'delete' && operation.relative === 'references/new.md'))
  await applyAgentSkillPlan(removed)
  await assert.rejects(
    lstat(path.join(consumer, AGENT_SKILL_ROOT, 'references/new.md')),
    error => error?.code === 'ENOENT',
  )
})

test('resumes an interrupted update after a new source file reached the consumer', async () => {
  const repoRoot = await mkdtemp(path.join(tmpdir(), 'geist-agent-source-'))
  const consumer = await makeConsumer()
  await writeSource(repoRoot)
  await applyAgentSkillPlan(await planAgentSkill({
    repoRoot,
    consumerRoot: consumer,
    sourceSha: '1'.repeat(40),
  }))

  const relative = 'references/new.md'
  const content = '# New\n'
  await writeFile(path.join(repoRoot, relative), content)
  await writeFile(path.join(consumer, AGENT_SKILL_ROOT, relative), '# Local\n')
  await assert.rejects(
    planAgentSkill({ repoRoot, consumerRoot: consumer, sourceSha: '2'.repeat(40) }),
    /unmanaged file: references\/new.md/,
  )
  await writeFile(path.join(consumer, AGENT_SKILL_ROOT, relative), content)

  const resumed = await planAgentSkill({
    repoRoot,
    consumerRoot: consumer,
    sourceSha: '2'.repeat(40),
  })
  assert.equal(resumed.operations.find(operation => operation.relative === relative)?.action, 'unchanged')
  await applyAgentSkillPlan(resumed)
  const lock = JSON.parse(await readFile(path.join(consumer, AGENT_SKILL_ROOT, AGENT_SKILL_LOCK), 'utf8'))
  assert.ok(Object.hasOwn(lock.files, relative))
})

test('rejects unmanaged files, wrong adapters, and symlinked target ancestors', async () => {
  const repoRoot = await mkdtemp(path.join(tmpdir(), 'geist-agent-source-'))
  await writeSource(repoRoot)

  const unmanaged = await makeConsumer()
  await mkdir(path.join(unmanaged, AGENT_SKILL_ROOT), { recursive: true })
  await writeFile(path.join(unmanaged, AGENT_SKILL_ROOT, 'extra.md'), 'private\n')
  await assert.rejects(
    planAgentSkill({ repoRoot, consumerRoot: unmanaged, sourceSha: sourceSha }),
    /refusing to take ownership/,
  )

  const inheritedKey = await makeConsumer()
  await applyAgentSkillPlan(await planAgentSkill({ repoRoot, consumerRoot: inheritedKey, sourceSha }))
  await writeFile(path.join(inheritedKey, AGENT_SKILL_ROOT, 'toString'), 'private\n')
  await assert.rejects(
    planAgentSkill({ repoRoot, consumerRoot: inheritedKey, sourceSha }),
    /unmanaged file: toString/,
  )

  const wrongAdapter = await makeConsumer()
  await mkdir(path.join(wrongAdapter, '.claude/skills'), { recursive: true })
  await symlink('../wrong', path.join(wrongAdapter, CLAUDE_SKILL_LINK))
  await assert.rejects(
    planAgentSkill({ repoRoot, consumerRoot: wrongAdapter, sourceSha }),
    /conflicting target/,
  )

  const outside = await mkdtemp(path.join(tmpdir(), 'geist-agent-outside-'))
  const linked = await makeConsumer()
  await symlink(outside, path.join(linked, '.agents'))
  await assert.rejects(
    planAgentSkill({ repoRoot, consumerRoot: linked, sourceSha }),
    /symbolic link/,
  )
  assert.deepEqual(await readdirNames(outside), [])
})

test('refuses to reconcile a skill owned by a different repository', async () => {
  const first = await mkdtemp(path.join(tmpdir(), 'geist-agent-source-'))
  const second = await mkdtemp(path.join(tmpdir(), 'geist-agent-source-'))
  const consumer = await makeConsumer()
  await writeSource(first)
  await writeSource(second)
  const registryPath = path.join(second, 'registry.json')
  const registry = JSON.parse(await readFile(registryPath, 'utf8'))
  registry.repository = 'https://example.com/other-geist-nuxt'
  await writeFile(registryPath, `${JSON.stringify(registry, null, 2)}\n`)

  await applyAgentSkillPlan(await planAgentSkill({ repoRoot: first, consumerRoot: consumer, sourceSha }))
  await assert.rejects(
    planAgentSkill({ repoRoot: second, consumerRoot: consumer, sourceSha }),
    /different repository/,
  )
})

test('rechecks target state before the first write', async () => {
  const repoRoot = await mkdtemp(path.join(tmpdir(), 'geist-agent-source-'))
  const consumer = await makeConsumer()
  await writeSource(repoRoot)
  const plan = await planAgentSkill({ repoRoot, consumerRoot: consumer, sourceSha })
  const target = path.join(consumer, AGENT_SKILL_ROOT, 'SKILL.md')
  await mkdir(path.dirname(target), { recursive: true })
  await writeFile(target, 'raced\n')
  await assert.rejects(applyAgentSkillPlan(plan), /changed after planning/)
  assert.equal(await readFile(target, 'utf8'), 'raced\n')
  await assert.rejects(
    lstat(path.join(consumer, AGENT_SKILL_ROOT, AGENT_SKILL_LOCK)),
    error => error?.code === 'ENOENT',
  )
})

test('checks exact source identity for skill inputs without coupling foundation changes', async () => {
  const repoRoot = await mkdtemp(path.join(tmpdir(), 'geist-agent-git-'))
  await writeSource(repoRoot)
  execFileSync('git', ['init'], { cwd: repoRoot })
  execFileSync('git', ['add', '.'], { cwd: repoRoot })
  execFileSync('git', ['-c', 'user.name=Test', '-c', 'user.email=test@example.com', 'commit', '-m', 'init'], { cwd: repoRoot })
  const sha = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repoRoot, encoding: 'utf8' }).trim()
  assert.equal(resolveAgentSkillSourceSha(repoRoot, sha), sha)
  assert.throws(() => resolveAgentSkillSourceSha(repoRoot, '0'.repeat(40)), /does not match/)

  await mkdir(path.join(repoRoot, 'foundation'), { recursive: true })
  await writeFile(path.join(repoRoot, 'foundation/local.txt'), 'runtime-only\n')
  assert.equal(resolveAgentSkillSourceSha(repoRoot, sha), sha)

  await writeFile(path.join(repoRoot, 'SKILL.md'), 'dirty\n')
  assert.throws(() => resolveAgentSkillSourceSha(repoRoot, sha), /source is dirty/)
})

async function readdirNames(directory) {
  const entries = await import('node:fs/promises').then(module => module.readdir(directory))
  return entries.sort()
}
