#!/usr/bin/env node
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  applyCopyPlan,
  assertExpectedPlanDigest,
  buildApplyResult,
  buildRuntimePlanDocument,
  loadRegistry,
  parseArgs,
  planCopy,
  printPlanError,
  readLock,
  RegistryError,
  resolveCopyRequest,
  resolveSourceSha,
  validateRegistry,
} from './lib/registry.mjs'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const jsonMode = process.argv.slice(2).includes('--json')

let options
try {
  options = parseArgs(process.argv.slice(2))
  if (options.expect_plan !== undefined && !options.write) {
    throw new RegistryError('--expect-plan requires --write')
  }
  const consumerRoot = path.resolve(options.target ?? options.consumer ?? '')
  if (!options.target && !options.consumer) throw new RegistryError('--target <consumer-directory> is required')
  const registryPath = path.resolve(options.registry ?? path.join(repoRoot, 'registry.json'))
  const registry = await loadRegistry(registryPath)
  await validateRegistry(registry, { repoRoot, checkFiles: true })

  const requested = options.all ? registry.items.map(item => item.name) : options.items
  const lock = await readLock(consumerRoot)
  if (options.update && !lock) throw new RegistryError('--update requires an existing geist.lock.json')
  const resolution = resolveCopyRequest(registry, requested, { lock, update: options.update })
  const sourceSha = resolveSourceSha(repoRoot, options.sha ?? options.to, {
    allowDirty: process.env.GEIST_REGISTRY_TEST_ALLOW_DIRTY === '1',
  })
  // Any existing lock turns copy into a full reconcile. This keeps a later
  // "copy one more item" operation from leaving old dependency files or lock
  // records behind when the current registry changed in the meantime.
  const plan = await planCopy({
    registry,
    resolution,
    repoRoot,
    consumerRoot,
    sourceSha,
    update: Boolean(lock),
  })
  const document = buildRuntimePlanDocument(plan)
  const expectedPlanDigest = options.expect_plan !== undefined
    ? assertExpectedPlanDigest(document, options.expect_plan)
    : null

  if (!options.write) {
    if (options.json) {
      console.log(JSON.stringify(document, null, 2))
    }
    else {
      console.log(`Dry run (${sourceSha}): ${resolution.items.length} items, ${resolution.files.length} files`)
      for (const operation of plan.operations) console.log(`${operation.action.padEnd(9)} ${operation.target}`)
      console.log('No files written. Re-run with --write to apply the complete batch.')
    }
  }
  else {
    const nextLock = await applyCopyPlan(plan)
    if (options.json) {
      console.log(JSON.stringify(buildApplyResult(document, {
        expectedPlanDigest,
        lockSourceSha: nextLock.registry.lastSourceSha,
      }), null, 2))
    }
    else {
      const counts = plan.operations.reduce((result, operation) => {
        result[operation.action] = (result[operation.action] ?? 0) + 1
        return result
      }, {})
      if (expectedPlanDigest) console.log(`Plan digest verified: ${expectedPlanDigest}`)
      console.log(`Copied registry batch (${sourceSha}): ${JSON.stringify(counts)}`)
      console.log(`Lock written: ${path.join(consumerRoot, 'geist.lock.json')}`)
    }
  }
  if (!options.json) {
    console.log('Resolved external packages:')
    for (const [name, range] of Object.entries(resolution.externalRequirements.packages)) console.log(`- ${name}@${range}`)
    console.log('Consumer setup (protected entrypoints are never overwritten automatically):')
    for (const instruction of resolution.externalRequirements.consumerSetup) console.log(`- ${instruction}`)
  }
}
catch (error) {
  printPlanError(error, jsonMode)
  process.exitCode = 1
}
