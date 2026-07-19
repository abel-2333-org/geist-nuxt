#!/usr/bin/env node
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  loadRegistry,
  parseArgs,
  printRegistryError,
  resolveItems,
  resolveSourceSha,
  validateRegistry,
} from './lib/registry.mjs'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

try {
  const options = parseArgs(process.argv.slice(2))
  const registryPath = path.resolve(options.registry ?? path.join(repoRoot, 'registry.json'))
  const registry = await loadRegistry(registryPath)
  await validateRegistry(registry, { repoRoot, checkFiles: true })
  const requested = options.all ? registry.items.map(item => item.name) : options.items
  const resolution = resolveItems(registry, requested)
  const sourceSha = resolveSourceSha(repoRoot, options.sha ?? options.to, {
    allowDirty: process.env.GEIST_REGISTRY_TEST_ALLOW_DIRTY === '1',
  })
  console.log(JSON.stringify({
    registry: registry.name,
    repository: registry.repository,
    sourceSha,
    requestedItems: resolution.requested,
    items: resolution.items.map(item => item.name),
    files: resolution.files.map(({ item, path: source, target }) => ({ item, source, target })),
  }, null, 2))
}
catch (error) {
  printRegistryError(error)
  process.exitCode = 1
}
