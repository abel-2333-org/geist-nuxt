#!/usr/bin/env node
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadRegistry, parseArgs, printRegistryError, validateRegistry } from './lib/registry.mjs'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

try {
  const options = parseArgs(process.argv.slice(2))
  const registryPath = path.resolve(options.registry ?? path.join(repoRoot, 'registry.json'))
  const registry = await loadRegistry(registryPath)
  const result = await validateRegistry(registry, { repoRoot, checkFiles: true })
  console.log(`Registry valid: ${registry.items.length} items, ${result.sourceOwners.size} files`)
}
catch (error) {
  printRegistryError(error)
  process.exitCode = 1
}
