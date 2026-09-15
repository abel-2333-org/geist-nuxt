import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { lstat, mkdtemp, readFile, readlink, realpath, writeFile } from 'node:fs/promises'
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
})

test('resolves first-party skill assets from both agent entrypoints', async () => {
  const codexSkill = path.join(root, '.agents/skills/geist-nuxt')
  const claudeSkill = path.join(root, '.claude/skills/geist-nuxt')
  assert.equal((await lstat(codexSkill)).isSymbolicLink(), true)
  assert.equal(await realpath(codexSkill), await realpath(root))
  assert.equal((await lstat(claudeSkill)).isSymbolicLink(), true)
  assert.equal(await realpath(claudeSkill), await realpath(codexSkill))

  for (const entrypoint of [codexSkill, claudeSkill]) {
    // Codex follows skill directory links but skips a symlinked SKILL.md file.
    assert.equal((await lstat(path.join(entrypoint, 'SKILL.md'))).isFile(), true)
    for (const asset of ['SKILL.md', 'references', 'registry.json', 'agents/openai.yaml']) {
      assert.equal(
        await realpath(path.join(entrypoint, asset)),
        await realpath(path.join(root, asset)),
        `${entrypoint}/${asset} must resolve to the root source`,
      )
    }
  }
})

test('tracks only the first-party skill under .agents', () => {
  const firstParty = ['.agents/skills/geist-nuxt']
  const thirdParty = ['.agents/skills/nuxt/SKILL.md', '.agents/local-config.json']
  const result = spawnSync('git', ['check-ignore', '--no-index', '--stdin'], {
    cwd: root,
    input: [...firstParty, ...thirdParty].join('\n'),
    encoding: 'utf8',
  })
  assert.equal(result.status, 0, result.stderr)
  assert.deepEqual(result.stdout.trim().split('\n'), thirdParty)
})

test('loads shared repository instructions from the Claude entrypoint', async () => {
  const instructions = await readFile(path.join(root, 'CLAUDE.md'), 'utf8')
  assert.match(instructions, /^@AGENTS\.md\s*$/m)
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
  assert.match(workflow, /working-directory: dist-verify\n\s+run: pnpm test:agent:portable/)
  assert.match(workflow, /group: skill-\$\{\{ github\.event\.pull_request\.number \|\| github\.ref \}\}/)
  assert.match(workflow, /LIVE_MAIN_SHA=.*commits\/main/)
  assert.match(workflow, /\[ "\$LIVE_MAIN_SHA" != "\$GITHUB_SHA" \]/)
  assert.match(workflow, /gh release create "\$TAG" dist-skill\.tar\.gz \\\n\s+--target "\$GITHUB_SHA"/)
  const shardJobs = {}
  for (const [group, matrix] of Object.entries({
    runtime: '1, 2, 3',
    isolated: '1, 2',
  })) {
    const job = workflow.match(new RegExp(
      `\\n  verify-consumer-${group}-shards:\\n([\\s\\S]*?)(?=\\n  [a-z][a-z0-9-]+:\\n)`,
    ))
    assert.ok(job, `${group} shard job must exist`)
    shardJobs[group] = job[0]
    assert.match(job[0], /fail-fast: false/)
    assert.match(job[0], new RegExp(`shard: \\[${matrix}\\]`))
    assert.match(
      job[0],
      new RegExp(`--group ${group} --shard "\\$\\{\\{ matrix\\.shard \\}\\}/\\$\\{\\{ strategy\\.job-total \\}\\}"`),
    )
  }
  assert.match(shardJobs.isolated, /--skip-install/)
  assert.match(shardJobs.runtime, /if: github\.event_name == 'pull_request' && matrix\.shard == 1/)
  assert.match(shardJobs.runtime, /test:consumer:upgrade -- --upgrade-from "\$BASE_SHA" --to "\$MERGE_SHA" --skip-install/)

  for (const group of ['runtime', 'isolated']) {
    const gate = workflow.match(new RegExp(
      `\\n  verify-consumer-${group}:\\n([\\s\\S]*?)(?=\\n  [a-z][a-z0-9-]+:\\n)`,
    ))
    assert.ok(gate, `${group} required-check gate must exist`)
    assert.match(gate[0], new RegExp(`name: Verify consumer \\(${group}\\)`))
    assert.match(gate[0], /if: \$\{\{ always\(\) \}\}/)
    assert.match(gate[0], new RegExp(`needs: \\[verify-consumer-${group}-shards\\]`))
    assert.match(
      gate[0],
      new RegExp(`RESULT: \\$\\{\\{ needs\\.verify-consumer-${group}-shards\\.result \\}\\}`),
    )
    assert.match(gate[0], /if \[ "\$RESULT" != "success" \]; then/)
    assert.match(gate[0], /exit 1/)
  }
  assert.match(
    workflow,
    /needs: \[verify-root, verify-consumer-runtime, verify-consumer-isolated\]/,
  )

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
