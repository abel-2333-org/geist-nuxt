import {
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  readlink,
  rename,
  rm,
  rmdir,
  symlink,
  unlink,
  writeFile,
} from 'node:fs/promises'
import path from 'node:path'
import {
  assertExactSha,
  assertSafeRelative,
  compareCodeUnits,
  PLAN_SCHEMA_VERSION,
  planDocumentDigest,
  RegistryError,
  resolveSourceSha,
  sha256,
} from './registry.mjs'

export const AGENT_SKILL_NAME = 'geist-nuxt'
export const AGENT_SKILL_ROOT = `.agents/skills/${AGENT_SKILL_NAME}`
export const AGENT_SKILL_LOCK = '.geist-skill.json'
export const CLAUDE_SKILL_LINK = `.claude/skills/${AGENT_SKILL_NAME}`
export const CLAUDE_SKILL_TARGET = `../../${AGENT_SKILL_ROOT}`

const SOURCE_ENTRIES = ['SKILL.md', 'agents/openai.yaml', 'references', 'registry.json']
// Dirty check mirrors the synced entries so an unrelated uncommitted file under
// agents/ can't block a sync that only ships agents/openai.yaml.
const SOURCE_DIRTY_PATHS = SOURCE_ENTRIES
// OS/editor artifacts that must never be treated as source or as managed skill files.
const IGNORED_ENTRIES = new Set(['.DS_Store'])
const HASH_RE = /^[0-9a-f]{64}$/

async function state(filePath) {
  let info
  try {
    info = await lstat(filePath)
  }
  catch (error) {
    if (error?.code === 'ENOENT') return { exists: false }
    throw error
  }
  if (!info.isFile()) throw new RegistryError(`agent skill target must be a regular file: ${filePath}`)
  const content = await readFile(filePath)
  return { exists: true, content, hash: sha256(content) }
}

async function walkSource(repoRoot, relative) {
  const absolute = path.join(repoRoot, relative)
  let info
  try {
    info = await lstat(absolute)
  }
  catch (error) {
    if (error?.code === 'ENOENT') throw new RegistryError(`agent skill source is missing: ${relative}`)
    throw error
  }
  if (info.isSymbolicLink()) throw new RegistryError(`agent skill source must not be a symbolic link: ${relative}`)
  if (info.isFile()) return [relative]
  if (!info.isDirectory()) throw new RegistryError(`agent skill source must be a regular file or directory: ${relative}`)

  const files = []
  const entries = await readdir(absolute, { withFileTypes: true })
  for (const entry of entries.sort((left, right) => compareCodeUnits(left.name, right.name))) {
    if (IGNORED_ENTRIES.has(entry.name)) continue
    files.push(...await walkSource(repoRoot, path.posix.join(relative, entry.name)))
  }
  return files
}

async function assertConsumerRoot(consumerRoot) {
  let info
  try {
    info = await lstat(consumerRoot)
  }
  catch (error) {
    if (error?.code === 'ENOENT') throw new RegistryError(`consumer directory does not exist: ${consumerRoot}`)
    throw error
  }
  if (info.isSymbolicLink() || !info.isDirectory()) {
    throw new RegistryError(`consumer root must be a real directory: ${consumerRoot}`)
  }
}

async function assertNoSymlinkPath(root, relative, { allowLeafSymlink = false } = {}) {
  const safe = assertSafeRelative(relative, 'agent skill target')
  const segments = safe.split('/')
  let current = root
  for (const [index, segment] of segments.entries()) {
    current = path.join(current, segment)
    let info
    try {
      info = await lstat(current)
    }
    catch (error) {
      if (error?.code === 'ENOENT') break
      throw error
    }
    const leaf = index === segments.length - 1
    if (info.isSymbolicLink() && !(leaf && allowLeafSymlink)) {
      throw new RegistryError(`consumer agent skill path contains a symbolic link: ${relative}`)
    }
    if (!leaf && !info.isDirectory()) {
      throw new RegistryError(`consumer agent skill ancestor is not a directory: ${relative}`)
    }
  }
  return safe
}

function validateLock(value) {
  if (
    !value
    || typeof value !== 'object'
    || Array.isArray(value)
    || value.schemaVersion !== 1
    || value.name !== AGENT_SKILL_NAME
    || typeof value.repository !== 'string'
    || !value.repository
    || !value.files
    || typeof value.files !== 'object'
    || Array.isArray(value.files)
  ) {
    throw new RegistryError(`${AGENT_SKILL_LOCK} has an unsupported format`)
  }
  assertExactSha(value.sourceSha, `${AGENT_SKILL_LOCK} sourceSha`)
  for (const [file, hash] of Object.entries(value.files)) {
    assertSafeRelative(file, `${AGENT_SKILL_LOCK} file`)
    if (!HASH_RE.test(hash)) throw new RegistryError(`${AGENT_SKILL_LOCK} has an invalid hash for ${file}`)
  }
  return value
}

async function readInstalledLock(consumerRoot) {
  const relative = `${AGENT_SKILL_ROOT}/${AGENT_SKILL_LOCK}`
  await assertNoSymlinkPath(consumerRoot, relative)
  try {
    return validateLock(JSON.parse(await readFile(path.join(consumerRoot, relative), 'utf8')))
  }
  catch (error) {
    if (error?.code === 'ENOENT') return undefined
    if (error instanceof SyntaxError) throw new RegistryError(`${AGENT_SKILL_LOCK} is not valid JSON`)
    throw error
  }
}

async function walkInstalled(consumerRoot, relative = AGENT_SKILL_ROOT) {
  const absolute = path.join(consumerRoot, relative)
  let entries
  try {
    entries = await readdir(absolute, { withFileTypes: true })
  }
  catch (error) {
    if (error?.code === 'ENOENT') return []
    throw error
  }
  const files = []
  for (const entry of entries.sort((left, right) => compareCodeUnits(left.name, right.name))) {
    if (IGNORED_ENTRIES.has(entry.name)) continue
    const child = path.posix.join(relative, entry.name)
    if (entry.isSymbolicLink()) throw new RegistryError(`installed agent skill must not contain symbolic links: ${child}`)
    if (entry.isDirectory()) files.push(...await walkInstalled(consumerRoot, child))
    else if (entry.isFile()) files.push(child.slice(`${AGENT_SKILL_ROOT}/`.length))
    else throw new RegistryError(`installed agent skill contains an unsupported entry: ${child}`)
  }
  return files
}

async function adapterState(consumerRoot) {
  await assertNoSymlinkPath(consumerRoot, CLAUDE_SKILL_LINK, { allowLeafSymlink: true })
  const absolute = path.join(consumerRoot, CLAUDE_SKILL_LINK)
  try {
    const info = await lstat(absolute)
    if (!info.isSymbolicLink()) return { exists: true, conflict: true }
    const target = await readlink(absolute)
    return { exists: true, target, conflict: target !== CLAUDE_SKILL_TARGET }
  }
  catch (error) {
    if (error?.code === 'ENOENT') return { exists: false }
    throw error
  }
}

export function resolveAgentSkillSourceSha(repoRoot, requestedSha, { allowDirty = false } = {}) {
  return resolveSourceSha(repoRoot, requestedSha, {
    allowDirty,
    dirtyPaths: SOURCE_DIRTY_PATHS,
  })
}

export async function planAgentSkill({ repoRoot, consumerRoot, sourceSha }) {
  await assertConsumerRoot(consumerRoot)
  assertExactSha(sourceSha)

  const skillRoot = path.join(consumerRoot, AGENT_SKILL_ROOT)
  let skillRootExists = false
  try {
    const info = await lstat(skillRoot)
    skillRootExists = true
    if (info.isSymbolicLink() || !info.isDirectory()) {
      throw new RegistryError(`consumer agent skill root must be a real directory: ${AGENT_SKILL_ROOT}`)
    }
  }
  catch (error) {
    if (error?.code !== 'ENOENT') throw error
  }

  const installedLock = await readInstalledLock(consumerRoot)

  const sourceFiles = []
  for (const entry of SOURCE_ENTRIES) sourceFiles.push(...await walkSource(repoRoot, entry))
  sourceFiles.sort(compareCodeUnits)

  const registry = JSON.parse(await readFile(path.join(repoRoot, 'registry.json'), 'utf8'))
  if (typeof registry.repository !== 'string' || !registry.repository) {
    throw new RegistryError('registry.json repository is required for the agent skill manifest')
  }
  if (typeof registry.name !== 'string' || !registry.name) {
    throw new RegistryError('registry.json name is required for the agent skill plan')
  }
  if (installedLock && installedLock.repository !== registry.repository) {
    throw new RegistryError(
      `installed agent skill belongs to a different repository: ${installedLock.repository}`,
    )
  }

  const desired = new Map()
  for (const relative of sourceFiles) {
    const content = await readFile(path.join(repoRoot, relative))
    desired.set(relative, { content, hash: sha256(content) })
  }

  const installedFiles = skillRootExists ? await walkInstalled(consumerRoot) : []
  const recoveries = new Set()
  for (const relative of installedFiles) {
    if (relative === AGENT_SKILL_LOCK) continue
    if (installedLock && !Object.hasOwn(installedLock.files, relative)) {
      if (!desired.has(relative)) {
        throw new RegistryError(`installed agent skill contains an unmanaged file: ${relative}`)
      }
      recoveries.add(relative)
    }
    if (!installedLock && !desired.has(relative)) {
      throw new RegistryError(`refusing to take ownership of unmanaged agent skill file: ${relative}`)
    }
  }

  const conflicts = []
  const operations = []
  for (const [relative, source] of desired) {
    const target = `${AGENT_SKILL_ROOT}/${relative}`
    await assertNoSymlinkPath(consumerRoot, target)
    const targetState = await state(path.join(consumerRoot, target))
    if (recoveries.has(relative) && targetState.hash !== source.hash) {
      throw new RegistryError(`installed agent skill contains an unmanaged file: ${relative}`)
    }
    const lockedHash = installedLock && Object.hasOwn(installedLock.files, relative)
      ? installedLock.files[relative]
      : undefined
    // walkInstalled already rejected untracked non-source or drifted files, so an
    // existing target here is lock-managed, an interrupted create, or a lock-free adopt.
    let action = 'create'
    if (targetState.exists && targetState.hash === source.hash) action = 'unchanged'
    else if (targetState.exists && targetState.hash === lockedHash) action = 'update'
    else if (targetState.exists) action = 'conflict'
    if (action === 'conflict') conflicts.push(relative)
    operations.push({
      action,
      relative,
      target,
      content: source.content,
      before: { exists: targetState.exists, hash: targetState.hash },
    })
  }

  for (const [relative, lockedHash] of Object.entries(installedLock?.files ?? {})) {
    if (desired.has(relative)) continue
    const target = `${AGENT_SKILL_ROOT}/${relative}`
    await assertNoSymlinkPath(consumerRoot, target)
    const targetState = await state(path.join(consumerRoot, target))
    let action = 'stale-missing'
    if (targetState.exists && targetState.hash === lockedHash) action = 'delete'
    else if (targetState.exists) action = 'conflict'
    if (action === 'conflict') conflicts.push(relative)
    operations.push({
      action,
      relative,
      target,
      before: { exists: targetState.exists, hash: targetState.hash },
    })
  }

  const payloadChanged = operations.some(operation => ['create', 'update', 'delete', 'stale-missing'].includes(operation.action))
  const nextLock = {
    schemaVersion: 1,
    name: AGENT_SKILL_NAME,
    repository: registry.repository,
    sourceSha: installedLock && !payloadChanged ? installedLock.sourceSha : sourceSha,
    files: Object.fromEntries([...desired].map(([relative, file]) => [relative, file.hash])),
  }
  const lockContent = Buffer.from(`${JSON.stringify(nextLock, null, 2)}\n`)
  const lockTarget = `${AGENT_SKILL_ROOT}/${AGENT_SKILL_LOCK}`
  const currentLockState = await state(path.join(consumerRoot, lockTarget))
  operations.push({
    action: !currentLockState.exists
      ? 'create'
      : currentLockState.hash === sha256(lockContent) ? 'unchanged' : 'update',
    relative: AGENT_SKILL_LOCK,
    target: lockTarget,
    content: lockContent,
    manifest: true,
    before: { exists: currentLockState.exists, hash: currentLockState.hash },
  })

  const adapter = await adapterState(consumerRoot)
  if (adapter.conflict) conflicts.push(CLAUDE_SKILL_LINK)
  operations.push({
    action: adapter.conflict ? 'conflict' : adapter.exists ? 'unchanged' : 'create',
    target: CLAUDE_SKILL_LINK,
    link: CLAUDE_SKILL_TARGET,
    adapter: true,
    before: { exists: adapter.exists, target: adapter.target },
  })

  if (conflicts.length) {
    throw new RegistryError(`agent skill sync stopped: ${conflicts.length} conflicting target(s); no files were written`, conflicts)
  }
  return {
    consumerRoot,
    repoRoot,
    sourceSha,
    operations,
    installedLock,
    registry: { name: registry.name, repository: registry.repository },
  }
}

// Skill counterpart of buildRuntimePlanDocument: same schema family, one stable
// owner, and every operation verifies as `reference` (skill payloads never
// change consumer runtime behavior).
export function buildAgentSkillPlanDocument(plan) {
  const operations = plan.operations.map((operation) => {
    if (operation.adapter) {
      return {
        action: operation.action,
        owner: `skill:${AGENT_SKILL_NAME}`,
        source: null,
        target: operation.target,
        link: CLAUDE_SKILL_TARGET,
        beforeHash: null,
        afterHash: null,
        verification: ['reference'],
      }
    }
    const action = operation.action === 'stale-missing' ? 'delete' : operation.action
    return {
      action,
      owner: `skill:${AGENT_SKILL_NAME}`,
      source: operation.manifest ? null : operation.relative,
      target: operation.target,
      beforeHash: operation.before.exists ? operation.before.hash : null,
      afterHash: action === 'delete' ? null : sha256(operation.content),
      verification: ['reference'],
    }
  }).sort((left, right) => compareCodeUnits(left.target, right.target))

  const summary = { create: 0, update: 0, delete: 0, unchanged: 0, verification: [] }
  for (const operation of operations) {
    summary[operation.action] += 1
    if (operation.action !== 'unchanged') summary.verification = ['reference']
  }
  const document = {
    planSchemaVersion: PLAN_SCHEMA_VERSION,
    kind: 'skill',
    registry: { name: plan.registry.name, repository: plan.registry.repository },
    sourceSha: plan.sourceSha,
    consumer: {
      lockPresent: Boolean(plan.installedLock),
      lockSourceSha: plan.installedLock?.sourceSha ?? null,
    },
    operations,
    packageOperations: [],
    consumerSetupOperations: [],
    configMigrations: [],
    requirements: { packages: {}, consumerSetup: [] },
    summary,
  }
  document.planDigest = planDocumentDigest(document)
  return document
}

async function pruneEmptyDirectories(root) {
  let entries
  try {
    entries = await readdir(root, { withFileTypes: true })
  }
  catch (error) {
    if (error?.code === 'ENOENT') return true
    throw error
  }
  for (const entry of entries) {
    if (entry.isDirectory()) await pruneEmptyDirectories(path.join(root, entry.name))
  }
  const remaining = await readdir(root)
  if (remaining.length === 0) {
    await rmdir(root)
    return true
  }
  return false
}

export async function applyAgentSkillPlan(plan) {
  await assertConsumerRoot(plan.consumerRoot)
  for (const operation of plan.operations) {
    await assertNoSymlinkPath(plan.consumerRoot, operation.target, {
      allowLeafSymlink: operation.adapter,
    })
    if (operation.adapter) {
      const current = await adapterState(plan.consumerRoot)
      if (
        current.conflict
        || current.exists !== operation.before.exists
        || current.target !== operation.before.target
      ) {
        throw new RegistryError(`agent skill target changed after planning: ${operation.target}`)
      }
      continue
    }
    const current = await state(path.join(plan.consumerRoot, operation.target))
    if (current.exists !== operation.before.exists || current.hash !== operation.before.hash) {
      throw new RegistryError(`agent skill target changed after planning: ${operation.target}`)
    }
  }

  const skillRoot = path.join(plan.consumerRoot, AGENT_SKILL_ROOT)
  const skillsRoot = path.dirname(skillRoot)
  await assertNoSymlinkPath(plan.consumerRoot, path.posix.dirname(AGENT_SKILL_ROOT))
  await mkdir(skillsRoot, { recursive: true })
  const staging = await mkdtemp(path.join(skillsRoot, `.${AGENT_SKILL_NAME}-stage-`))
  try {
    for (const operation of plan.operations.filter(operation => (
      !operation.adapter
      && !['unchanged', 'stale-missing', 'delete'].includes(operation.action)
    ))) {
      await writeFile(path.join(staging, sha256(operation.target)), operation.content)
    }

    // Not atomic across files: payload files are renamed/unlinked one by one and the
    // manifest (lock) is written last. A crash or mid-loop state-change throw can leave
    // a partial payload, but because the lock still reflects the pre-run state, a re-run
    // re-plans against disk (matching source -> unchanged, including an interrupted create;
    // matching lock -> update) and converges. Never write the manifest before the payload
    // or this recovery breaks.
    for (const operation of plan.operations.filter(operation => !operation.manifest && !operation.adapter)) {
      const targetPath = path.join(plan.consumerRoot, operation.target)
      await assertNoSymlinkPath(plan.consumerRoot, operation.target)
      const current = await state(targetPath)
      if (current.exists !== operation.before.exists || current.hash !== operation.before.hash) {
        throw new RegistryError(`agent skill target changed before mutation: ${operation.target}`)
      }
      if (operation.action === 'delete') {
        await unlink(targetPath)
        continue
      }
      if (['unchanged', 'stale-missing'].includes(operation.action)) continue
      await mkdir(path.dirname(targetPath), { recursive: true })
      await assertNoSymlinkPath(plan.consumerRoot, operation.target)
      const staged = path.join(staging, sha256(operation.target))
      await rename(staged, targetPath)
    }

    const manifest = plan.operations.find(operation => operation.manifest)
    const manifestPath = path.join(plan.consumerRoot, manifest.target)
    if (manifest.action !== 'unchanged') {
      await assertNoSymlinkPath(plan.consumerRoot, manifest.target)
      const current = await state(manifestPath)
      if (current.exists !== manifest.before.exists || current.hash !== manifest.before.hash) {
        throw new RegistryError(`agent skill target changed before mutation: ${manifest.target}`)
      }
      const staged = path.join(staging, sha256(manifest.target))
      await rename(staged, manifestPath)
    }

    const adapter = plan.operations.find(operation => operation.adapter)
    if (adapter.action === 'create') {
      const adapterPath = path.join(plan.consumerRoot, adapter.target)
      const current = await adapterState(plan.consumerRoot)
      if (current.exists || current.conflict) {
        throw new RegistryError(`agent skill target changed before mutation: ${adapter.target}`)
      }
      await mkdir(path.dirname(adapterPath), { recursive: true })
      await assertNoSymlinkPath(plan.consumerRoot, adapter.target, { allowLeafSymlink: true })
      await symlink(adapter.link, adapterPath)
    }
  }
  finally {
    await rm(staging, { force: true, recursive: true })
  }

  try {
    for (const entry of await readdir(skillRoot, { withFileTypes: true })) {
      if (entry.isDirectory()) await pruneEmptyDirectories(path.join(skillRoot, entry.name))
    }
  }
  catch (error) {
    if (error?.code !== 'ENOENT') throw error
  }
}

export function parseAgentSkillArgs(argv) {
  const options = {}
  const allowedValues = new Set(['--consumer', '--sha', '--target', '--to'])
  const allowedFlags = new Set(['--dry-run', '--json', '--write'])
  for (let index = 0; index < argv.length; index++) {
    const argument = argv[index]
    if (argument === '--') continue
    if (allowedFlags.has(argument)) {
      const key = argument.slice(2).replaceAll('-', '_')
      if (options[key] !== undefined) throw new RegistryError(`duplicate geist:skill option: ${argument}`)
      options[key] = true
      continue
    }
    if (allowedValues.has(argument)) {
      const key = argument.slice(2)
      if (options[key] !== undefined) throw new RegistryError(`duplicate geist:skill option: ${argument}`)
      const value = argv[++index]
      if (!value || value.startsWith('--')) throw new RegistryError(`${argument} requires a value`)
      options[key] = value
      continue
    }
    throw new RegistryError(argument.startsWith('--')
      ? `unsupported geist:skill option: ${argument}`
      : 'geist:skill does not accept positional items')
  }
  if (options.write && options.dry_run) throw new RegistryError('--write and --dry-run cannot be combined')
  if (options.write && options.json) {
    throw new RegistryError('--json is a dry-run output mode; guarded apply output ships with the plan digest contract')
  }
  if (!options.target && !options.consumer) throw new RegistryError('--target <consumer-directory> is required')
  if (options.target && options.consumer) throw new RegistryError('--target and --consumer cannot be combined')
  if (options.to && options.sha) throw new RegistryError('--to and --sha cannot be combined')
  return options
}
