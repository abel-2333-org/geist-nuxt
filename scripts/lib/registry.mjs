import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { lstat, mkdir, readFile, readdir, rename, unlink, writeFile } from 'node:fs/promises'
import path from 'node:path'

export const LOCK_FILE = 'geist.lock.json'
export const LOCK_VERSION = 1

const EXACT_SHA_RE = /^[0-9a-f]{40}$/i
const ITEM_NAME_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const FORBIDDEN_TARGET_SEGMENTS = new Set(['.git', '.nuxt', '.output', 'node_modules'])
const PROTECTED_TARGETS = new Set([
  'nuxt.config.ts',
  'app.config.ts',
  'app/app.config.ts',
  'app/app.vue',
  'app/assets/css/main.css',
])

export class RegistryError extends Error {
  constructor(message, details = []) {
    super(message)
    this.name = 'RegistryError'
    this.details = details
  }
}

export function sha256(content) {
  return createHash('sha256').update(content).digest('hex')
}

export function assertExactSha(value, label = 'source SHA') {
  if (!EXACT_SHA_RE.test(value ?? '')) {
    throw new RegistryError(`${label} must be an exact 40-character Git SHA, received: ${value ?? '<missing>'}`)
  }
  return value.toLowerCase()
}

export function getCheckoutSha(repoRoot) {
  const value = execFileSync('git', ['rev-parse', 'HEAD'], {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim()
  return assertExactSha(value, 'checkout SHA')
}

export function resolveSourceSha(repoRoot, requestedSha, { allowDirty = false } = {}) {
  const checkoutSha = getCheckoutSha(repoRoot)
  if (requestedSha) {
    const exact = assertExactSha(requestedSha)
    if (exact !== checkoutSha) {
      throw new RegistryError(`Requested SHA ${exact} does not match checked-out source ${checkoutSha}`)
    }
  }
  if (!allowDirty) {
    const dirty = execFileSync('git', [
      'status',
      '--porcelain=v1',
      '--untracked-files=all',
      '--',
      'foundation',
      'kits',
      'registry.json',
    ], {
      cwd: repoRoot,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim()
    if (dirty) {
      throw new RegistryError('registry source is dirty; commit foundation/, kits/, and registry.json before creating an exact-SHA lock')
    }
  }
  return checkoutSha
}

export function assertSafeRelative(input, label) {
  if (typeof input !== 'string' || input.length === 0) {
    throw new RegistryError(`${label} must be a non-empty relative path`)
  }
  if (input.includes('\\')) {
    throw new RegistryError(`${label} must use POSIX separators: ${input}`)
  }
  if (path.posix.isAbsolute(input) || path.win32.isAbsolute(input)) {
    throw new RegistryError(`${label} must be relative: ${input}`)
  }
  const normalized = path.posix.normalize(input)
  if (normalized !== input || normalized === '.' || normalized.startsWith('../')) {
    throw new RegistryError(`${label} is not normalized or escapes its root: ${input}`)
  }
  const segments = normalized.split('/')
  if (segments.some(segment => segment === '..' || segment === '.')) {
    throw new RegistryError(`${label} contains an unsafe segment: ${input}`)
  }
  return normalized
}

export function assertSafeTarget(target) {
  const normalized = assertSafeRelative(target, 'file target')
  const segments = normalized.split('/')
  if (segments.some(segment => FORBIDDEN_TARGET_SEGMENTS.has(segment))) {
    throw new RegistryError(`file target enters a generated or dependency directory: ${target}`)
  }
  if (PROTECTED_TARGETS.has(normalized) || path.posix.basename(normalized) === 'main.css') {
    throw new RegistryError(`file target is consumer-owned and protected: ${target}`)
  }
  return normalized
}

function sourceScope(source) {
  if (source.startsWith('foundation/')) return 'foundation'
  const match = source.match(/^kits\/([^/]+)\//)
  return match ? `kit:${match[1]}` : undefined
}

async function walkFiles(root, relativeRoot) {
  const absoluteRoot = path.join(root, relativeRoot)
  let entries
  try {
    entries = await readdir(absoluteRoot, { withFileTypes: true })
  }
  catch (error) {
    if (error?.code === 'ENOENT') throw new RegistryError(`source root does not exist: ${relativeRoot}`)
    throw error
  }
  const files = []
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    if (entry.name === '.DS_Store') continue
    const relative = path.posix.join(relativeRoot, entry.name)
    if (entry.isDirectory()) files.push(...await walkFiles(root, relative))
    else if (entry.isFile()) files.push(relative)
    else throw new RegistryError(`source roots may contain only regular files: ${relative}`)
  }
  return files
}

function dependencyClosure(itemName, itemsByName) {
  const seen = new Set()
  const visit = (name) => {
    if (seen.has(name)) return
    seen.add(name)
    for (const dependency of itemsByName.get(name)?.registryDependencies ?? []) visit(dependency)
  }
  visit(itemName)
  seen.delete(itemName)
  return seen
}

function relativeImports(sourceText) {
  const imports = []
  const pattern = /(?:from\s*|import\s*)['"](\.{1,2}\/[^'"]+)['"]/g
  for (const match of sourceText.matchAll(pattern)) imports.push(match[1])
  return imports
}

function resolveImportedSource(fromSource, specifier, declaredSources) {
  const base = path.posix.normalize(path.posix.join(path.posix.dirname(fromSource), specifier))
  const candidates = [base, `${base}.ts`, `${base}.vue`, `${base}.js`, `${base}.mjs`, `${base}/index.ts`, `${base}/index.js`]
  return candidates.find(candidate => declaredSources.has(candidate))
}

export async function loadRegistry(registryPath) {
  let text
  try {
    text = await readFile(registryPath, 'utf8')
  }
  catch (error) {
    if (error?.code === 'ENOENT') throw new RegistryError(`registry not found: ${registryPath}`)
    throw error
  }
  try {
    return JSON.parse(text)
  }
  catch (error) {
    throw new RegistryError(`registry is not valid JSON: ${error.message}`)
  }
}

export async function validateRegistry(registry, { repoRoot, checkFiles = true } = {}) {
  const errors = []
  const fail = (message) => errors.push(message)

  if (!registry || typeof registry !== 'object' || Array.isArray(registry)) fail('registry must be an object')
  if (registry?.schemaVersion !== 1) fail('schemaVersion must be 1')
  if (typeof registry?.name !== 'string' || !registry.name) fail('name must be a non-empty string')
  if (typeof registry?.repository !== 'string' || !registry.repository) fail('repository must be a non-empty string')
  for (const key of ['nuxt', 'nuxtUi', 'tailwindcss']) {
    if (typeof registry?.compatibility?.[key] !== 'string' || !registry.compatibility[key]) fail(`compatibility.${key} must be a non-empty range`)
  }
  if (!registry?.externalRequirements || typeof registry.externalRequirements !== 'object') fail('externalRequirements must be an object')
  if (!registry?.externalRequirements?.packages || typeof registry.externalRequirements.packages !== 'object') fail('externalRequirements.packages must be an object')
  for (const requiredPackage of ['@nuxt/ui', '@vueuse/core']) {
    if (typeof registry?.externalRequirements?.packages?.[requiredPackage] !== 'string') fail(`externalRequirements.packages must declare ${requiredPackage}`)
  }
  if (!Array.isArray(registry?.externalRequirements?.consumerSetup) || registry.externalRequirements.consumerSetup.length === 0) fail('externalRequirements.consumerSetup must be a non-empty array')
  if (!Array.isArray(registry?.sourceRoots) || registry.sourceRoots.length === 0) fail('sourceRoots must be a non-empty array')
  if (!Array.isArray(registry?.items) || registry.items.length === 0) fail('items must be a non-empty array')

  const sourceRoots = []
  for (const root of registry?.sourceRoots ?? []) {
    try {
      const safe = assertSafeRelative(root, 'source root')
      if (!(safe === 'foundation' || safe.startsWith('foundation/') || /^kits\/[^/]+(?:\/|$)/.test(safe))) {
        fail(`source root must live under foundation/ or kits/<kit>/: ${root}`)
      }
      sourceRoots.push(safe)
    }
    catch (error) {
      fail(error.message)
    }
  }
  if (new Set(sourceRoots).size !== sourceRoots.length) fail('sourceRoots contains duplicates')
  for (const [index, left] of sourceRoots.entries()) {
    for (const right of sourceRoots.slice(index + 1)) {
      if (right.startsWith(`${left}/`) || left.startsWith(`${right}/`)) fail(`sourceRoots overlap: ${left} and ${right}`)
    }
  }

  const itemsByName = new Map()
  const sourceOwners = new Map()
  const targetOwners = new Map()
  for (const [index, item] of (registry?.items ?? []).entries()) {
    const prefix = `items[${index}]`
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      fail(`${prefix} must be an object`)
      continue
    }
    if (!ITEM_NAME_RE.test(item.name ?? '')) fail(`${prefix}.name must be unique kebab-case`)
    else if (itemsByName.has(item.name)) fail(`duplicate item name: ${item.name}`)
    else itemsByName.set(item.name, item)
    if (typeof item.type !== 'string' || !item.type) fail(`${prefix}.type must be a non-empty string`)
    if (typeof item.title !== 'string' || !item.title) fail(`${prefix}.title must be a non-empty string`)
    if (typeof item.description !== 'string' || !item.description) fail(`${prefix}.description must be a non-empty string`)
    if (item.registryDependencies !== undefined && !Array.isArray(item.registryDependencies)) fail(`${prefix}.registryDependencies must be an array`)
    if (new Set(item.registryDependencies ?? []).size !== (item.registryDependencies ?? []).length) fail(`${prefix}.registryDependencies contains duplicates`)
    if (!Array.isArray(item.files) || item.files.length === 0) {
      fail(`${prefix}.files must be a non-empty array`)
      continue
    }
    const scopes = new Set()
    for (const [fileIndex, file] of item.files.entries()) {
      try {
        const source = assertSafeRelative(file?.path, `${prefix}.files[${fileIndex}].path`)
        const target = assertSafeTarget(file?.target)
        if (!sourceRoots.some(root => source === root || source.startsWith(`${root}/`))) fail(`source is outside declared sourceRoots: ${source}`)
        const scope = sourceScope(source)
        if (!scope) fail(`source must live under foundation/ or kits/<kit>/: ${source}`)
        else scopes.add(scope)
        if (sourceOwners.has(source)) fail(`source file has multiple owners: ${source} (${sourceOwners.get(source)}, ${item.name})`)
        else sourceOwners.set(source, item.name)
        if (targetOwners.has(target)) fail(`target path has multiple owners: ${target} (${targetOwners.get(target)}, ${item.name})`)
        else targetOwners.set(target, item.name)
      }
      catch (error) {
        fail(error.message)
      }
    }
    if (scopes.size > 1) fail(`item ${item.name} mixes foundation and kit source scopes`)
  }

  for (const item of itemsByName.values()) {
    for (const dependency of item.registryDependencies ?? []) {
      if (!itemsByName.has(dependency)) fail(`item ${item.name} depends on unknown item ${dependency}`)
    }
    const itemScopes = new Set(item.files.map(file => sourceScope(file.path)).filter(Boolean))
    const itemScope = [...itemScopes][0]
    for (const dependencyName of item.registryDependencies ?? []) {
      const dependency = itemsByName.get(dependencyName)
      if (!dependency) continue
      const dependencyScope = sourceScope(dependency.files[0]?.path)
      if (itemScope === 'foundation' && dependencyScope !== 'foundation') fail(`foundation item ${item.name} cannot depend on ${dependencyName}`)
      if (itemScope?.startsWith('kit:') && dependencyScope?.startsWith('kit:') && itemScope !== dependencyScope) fail(`cross-kit dependency is forbidden: ${item.name} -> ${dependencyName}`)
    }
  }

  const visitState = new Map()
  const stack = []
  const visit = (name) => {
    const state = visitState.get(name)
    if (state === 'done') return
    if (state === 'visiting') {
      const start = stack.indexOf(name)
      fail(`dependency cycle: ${[...stack.slice(start), name].join(' -> ')}`)
      return
    }
    visitState.set(name, 'visiting')
    stack.push(name)
    for (const dependency of itemsByName.get(name)?.registryDependencies ?? []) {
      if (itemsByName.has(dependency)) visit(dependency)
    }
    stack.pop()
    visitState.set(name, 'done')
  }
  for (const name of itemsByName.keys()) visit(name)
  if (itemsByName.has('geist-foundation')) {
    for (const item of itemsByName.values()) {
      if (!['registry:component', 'registry:block'].includes(item.type)) continue
      const closure = dependencyClosure(item.name, itemsByName)
      if (!closure.has('geist-foundation')) fail(`rendering item ${item.name} must depend on geist-foundation`)
    }
  }

  if (checkFiles && repoRoot) {
    for (const source of sourceOwners.keys()) {
      try {
        const info = await lstat(path.join(repoRoot, source))
        if (!info.isFile() || info.isSymbolicLink()) fail(`declared source must be a regular non-symlink file: ${source}`)
      }
      catch (error) {
        if (error?.code === 'ENOENT') fail(`declared source does not exist: ${source}`)
        else throw error
      }
    }
    const discovered = new Set()
    for (const root of sourceRoots) {
      try {
        for (const source of await walkFiles(repoRoot, root)) discovered.add(source)
      }
      catch (error) {
        if (error instanceof RegistryError) fail(error.message)
        else throw error
      }
    }
    for (const source of discovered) if (!sourceOwners.has(source)) fail(`source file is not declared by any item: ${source}`)
    for (const source of sourceOwners.keys()) if (!discovered.has(source)) fail(`declared source is outside or missing from sourceRoots: ${source}`)

    for (const [source, owner] of sourceOwners) {
      let text
      try {
        text = await readFile(path.join(repoRoot, source), 'utf8')
      }
      catch {
        continue
      }
      const allowedOwners = dependencyClosure(owner, itemsByName)
      allowedOwners.add(owner)
      for (const specifier of relativeImports(text)) {
        const importedSource = resolveImportedSource(source, specifier, sourceOwners)
        if (!importedSource) continue
        const importedOwner = sourceOwners.get(importedSource)
        if (!allowedOwners.has(importedOwner)) fail(`item ${owner} imports ${importedSource} owned by ${importedOwner} without declaring a dependency`)
      }
    }
  }

  if (errors.length) throw new RegistryError(`registry validation failed with ${errors.length} error(s)\n- ${errors.join('\n- ')}`, errors)
  return { itemsByName, sourceOwners, targetOwners, sourceRoots }
}

export function resolveItems(registry, requestedItems) {
  const itemsByName = new Map(registry.items.map(item => [item.name, item]))
  const requested = [...new Set(requestedItems)]
  if (requested.length === 0) throw new RegistryError('at least one registry item is required')
  for (const name of requested) if (!itemsByName.has(name)) throw new RegistryError(`unknown registry item: ${name}`)
  const ordered = []
  const seen = new Set()
  const visit = (name) => {
    if (seen.has(name)) return
    seen.add(name)
    for (const dependency of itemsByName.get(name).registryDependencies ?? []) visit(dependency)
    ordered.push(itemsByName.get(name))
  }
  for (const name of requested) visit(name)
  const files = ordered.flatMap(item => item.files.map(file => ({ ...file, item: item.name })))
  return { requested, items: ordered, files }
}

export async function readLock(consumerRoot) {
  const lockPath = path.join(consumerRoot, LOCK_FILE)
  try {
    const lock = JSON.parse(await readFile(lockPath, 'utf8'))
    if (lock.lockVersion !== LOCK_VERSION || typeof lock.items !== 'object' || typeof lock.files !== 'object') {
      throw new RegistryError(`${LOCK_FILE} has an unsupported format`)
    }
    return lock
  }
  catch (error) {
    if (error?.code === 'ENOENT') return undefined
    if (error instanceof SyntaxError) throw new RegistryError(`${LOCK_FILE} is not valid JSON`)
    throw error
  }
}

async function fileHash(filePath) {
  try {
    const content = await readFile(filePath)
    return { exists: true, hash: sha256(content), content }
  }
  catch (error) {
    if (error?.code === 'ENOENT') return { exists: false }
    throw error
  }
}

export async function planCopy({ registry, resolution, repoRoot, consumerRoot, sourceSha, update = false }) {
  const lock = await readLock(consumerRoot)
  if (update && !lock) throw new RegistryError(`--update requires an existing ${LOCK_FILE}`)
  const conflicts = []
  const operations = []
  for (const file of resolution.files) {
    const sourcePath = path.join(repoRoot, file.path)
    const targetPath = path.join(consumerRoot, file.target)
    const sourceState = await fileHash(sourcePath)
    if (!sourceState.exists) throw new RegistryError(`source file is missing: ${file.path}`)
    const targetState = await fileHash(targetPath)
    const locked = lock?.files?.[file.target]
    let action = 'create'
    if (targetState.exists && targetState.hash === sourceState.hash) action = 'unchanged'
    else if (targetState.exists && locked && targetState.hash === locked.targetHash) action = 'update'
    else if (targetState.exists) {
      action = 'conflict'
      conflicts.push({ target: file.target, expected: locked?.targetHash, actual: targetState.hash })
    }
    operations.push({
      ...file,
      sourcePath,
      targetPath,
      sourceHash: sourceState.hash,
      targetHash: targetState.hash,
      content: sourceState.content,
      action,
    })
  }
  const desiredTargets = new Set(resolution.files.map(file => file.target))
  if (update && lock) {
    for (const [target, record] of Object.entries(lock.files)) {
      if (desiredTargets.has(target)) continue
      const targetPath = path.join(consumerRoot, assertSafeTarget(target))
      const targetState = await fileHash(targetPath)
      if (targetState.exists && targetState.hash !== record.targetHash) {
        conflicts.push({ target, expected: record.targetHash, actual: targetState.hash })
      }
      operations.push({
        item: record.item,
        path: record.source,
        target,
        targetPath,
        sourceSha: record.sourceSha,
        sourceHash: record.sourceHash,
        targetHash: targetState.hash,
        action: targetState.exists ? 'delete' : 'stale-missing',
        stale: true,
      })
    }
  }
  if (conflicts.length) throw new RegistryError(`copy stopped: ${conflicts.length} conflicting target(s); no files were written`, conflicts.map(conflict => conflict.target))
  return { registry, resolution, sourceSha, consumerRoot, lock, operations, update }
}

function nextLock(plan) {
  const lock = plan.lock
    ? structuredClone(plan.lock)
    : { lockVersion: LOCK_VERSION, registry: {}, requestedItems: [], items: {}, files: {} }
  lock.registry = {
    name: plan.registry.name,
    repository: plan.registry.repository,
    lastSourceSha: plan.sourceSha,
    compatibility: structuredClone(plan.registry.compatibility),
    externalRequirements: structuredClone(plan.registry.externalRequirements),
  }
  lock.requestedItems = plan.update
    ? [...plan.resolution.requested].sort()
    : [...new Set([...(lock.requestedItems ?? []), ...plan.resolution.requested])].sort()
  if (plan.update) {
    const desiredItems = new Set(plan.resolution.items.map(item => item.name))
    for (const itemName of Object.keys(lock.items)) if (!desiredItems.has(itemName)) delete lock.items[itemName]
    for (const operation of plan.operations) if (operation.stale) delete lock.files[operation.target]
  }
  for (const item of plan.resolution.items) {
    lock.items[item.name] = {
      sourceSha: plan.sourceSha,
      registryDependencies: [...(item.registryDependencies ?? [])],
      files: item.files.map(file => file.target),
    }
  }
  for (const operation of plan.operations) {
    if (operation.stale) continue
    lock.files[operation.target] = {
      item: operation.item,
      source: operation.path,
      target: operation.target,
      sourceSha: plan.sourceSha,
      sourceHash: operation.sourceHash,
      targetHash: operation.sourceHash,
    }
  }
  return lock
}

export async function applyCopyPlan(plan) {
  for (const operation of plan.operations) {
    if (operation.action === 'delete') {
      await unlink(operation.targetPath)
      continue
    }
    if (operation.action === 'stale-missing') continue
    if (operation.action === 'unchanged') continue
    await mkdir(path.dirname(operation.targetPath), { recursive: true })
    const tempPath = `${operation.targetPath}.geist-tmp-${process.pid}`
    await writeFile(tempPath, operation.content)
    await rename(tempPath, operation.targetPath)
  }
  const lock = nextLock(plan)
  const lockPath = path.join(plan.consumerRoot, LOCK_FILE)
  const temporaryLock = `${lockPath}.geist-tmp-${process.pid}`
  await writeFile(temporaryLock, `${JSON.stringify(lock, null, 2)}\n`)
  await rename(temporaryLock, lockPath)
  return lock
}

export async function checkConsumer({ registry, repoRoot, consumerRoot }) {
  const lock = await readLock(consumerRoot)
  if (!lock) throw new RegistryError(`${LOCK_FILE} is missing in ${consumerRoot}`)
  const errors = []
  let checkoutSha
  try {
    checkoutSha = getCheckoutSha(repoRoot)
  }
  catch {
    checkoutSha = undefined
  }
  for (const [target, record] of Object.entries(lock.files)) {
    let safeTarget
    try {
      safeTarget = assertSafeTarget(target)
      assertExactSha(record.sourceSha, `${target} sourceSha`)
    }
    catch (error) {
      errors.push(error.message)
      continue
    }
    const targetState = await fileHash(path.join(consumerRoot, safeTarget))
    if (!targetState.exists) errors.push(`managed target is missing: ${target}`)
    else if (targetState.hash !== record.targetHash) errors.push(`managed target drifted: ${target}`)
    if (record.target !== target) errors.push(`lock target key does not match record.target: ${target}`)
    const item = registry.items.find(candidate => candidate.name === record.item)
    if (!item?.files.some(file => file.path === record.source && file.target === target)) errors.push(`managed file no longer exists in registry: ${target}`)
    if (checkoutSha && record.sourceSha === checkoutSha) {
      const sourceState = await fileHash(path.join(repoRoot, record.source))
      if (!sourceState.exists) errors.push(`locked source is missing: ${record.source}`)
      else if (sourceState.hash !== record.sourceHash) errors.push(`locked sourceHash does not match checked-out source: ${record.source}`)
    }
  }
  for (const [itemName, itemRecord] of Object.entries(lock.items)) {
    try {
      assertExactSha(itemRecord.sourceSha, `${itemName} sourceSha`)
    }
    catch (error) {
      errors.push(error.message)
    }
    if (!registry.items.some(item => item.name === itemName)) errors.push(`locked item no longer exists in registry: ${itemName}`)
    for (const target of itemRecord.files ?? []) if (!lock.files[target]) errors.push(`locked item ${itemName} references an untracked file: ${target}`)
  }
  if (errors.length) throw new RegistryError(`consumer check failed with ${errors.length} error(s)\n- ${errors.join('\n- ')}`, errors)
  return lock
}

export function parseArgs(argv) {
  const options = { items: [] }
  for (let index = 0; index < argv.length; index++) {
    const argument = argv[index]
    if (argument === '--') continue
    if (!argument.startsWith('--')) {
      options.items.push(argument)
      continue
    }
    if (['--write', '--dry-run', '--update', '--all', '--keep-temp', '--skip-install'].includes(argument)) {
      options[argument.slice(2).replaceAll('-', '_')] = true
      continue
    }
    const key = argument.slice(2).replaceAll('-', '_')
    const value = argv[++index]
    if (!value || value.startsWith('--')) throw new RegistryError(`${argument} requires a value`)
    options[key] = value
  }
  if (options.write && options.dry_run) throw new RegistryError('--write and --dry-run cannot be combined')
  return options
}

export function printRegistryError(error) {
  console.error(error.message)
  for (const detail of error.details ?? []) console.error(`- ${typeof detail === 'string' ? detail : JSON.stringify(detail)}`)
}
