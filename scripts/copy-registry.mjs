#!/usr/bin/env node
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  applyCopyPlan,
  loadRegistry,
  parseArgs,
  planCopy,
  printRegistryError,
  readLock,
  resolveItems,
  resolveSourceSha,
  validateRegistry,
} from './lib/registry.mjs'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

try {
  const options = parseArgs(process.argv.slice(2))
  const consumerRoot = path.resolve(options.target ?? options.consumer ?? '')
  if (!options.target && !options.consumer) throw new Error('--target <consumer-directory> is required')
  const registryPath = path.resolve(options.registry ?? path.join(repoRoot, 'registry.json'))
  const registry = await loadRegistry(registryPath)
  await validateRegistry(registry, { repoRoot, checkFiles: true })

  let requested = options.all ? registry.items.map(item => item.name) : options.items
  if (options.update) {
    const lock = await readLock(consumerRoot)
    if (!lock) throw new Error('--update requires an existing geist.lock.json')
    requested = [...new Set([...(lock.requestedItems ?? []), ...requested])]
  }
  const resolution = resolveItems(registry, requested)
  const sourceSha = resolveSourceSha(repoRoot, options.sha ?? options.to, {
    allowDirty: process.env.GEIST_REGISTRY_TEST_ALLOW_DIRTY === '1',
  })
  const plan = await planCopy({ registry, resolution, repoRoot, consumerRoot, sourceSha, update: options.update })
  const counts = plan.operations.reduce((result, operation) => {
    result[operation.action] = (result[operation.action] ?? 0) + 1
    return result
  }, {})

  if (!options.write) {
    console.log(`Dry run (${sourceSha}): ${resolution.items.length} items, ${resolution.files.length} files`)
    for (const operation of plan.operations) console.log(`${operation.action.padEnd(9)} ${operation.target}`)
    console.log('No files written. Re-run with --write to apply the complete batch.')
  }
  else {
    await applyCopyPlan(plan)
    console.log(`Copied registry batch (${sourceSha}): ${JSON.stringify(counts)}`)
    console.log(`Lock written: ${path.join(consumerRoot, 'geist.lock.json')}`)
  }
  console.log('External packages:')
  for (const [name, range] of Object.entries(registry.externalRequirements.packages)) console.log(`- ${name}@${range}`)
  console.log('Consumer setup (consumer-owned files are never overwritten):')
  for (const instruction of registry.externalRequirements.consumerSetup) console.log(`- ${instruction}`)
}
catch (error) {
  printRegistryError(error)
  process.exitCode = 1
}
