#!/usr/bin/env node
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  applyAgentSkillPlan,
  buildAgentSkillPlanDocument,
  parseAgentSkillArgs,
  planAgentSkill,
  resolveAgentSkillSourceSha,
} from './lib/agent-skill.mjs'
import { assertExpectedPlanDigest, buildApplyResult, printPlanError } from './lib/registry.mjs'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const jsonMode = process.argv.slice(2).includes('--json')

let options
try {
  options = parseAgentSkillArgs(process.argv.slice(2))
  const consumerRoot = path.resolve(options.target ?? options.consumer)
  const sourceSha = resolveAgentSkillSourceSha(repoRoot, options.sha ?? options.to, {
    allowDirty: process.env.GEIST_SKILL_TEST_ALLOW_DIRTY === '1',
  })
  const plan = await planAgentSkill({ repoRoot, consumerRoot, sourceSha })
  const document = buildAgentSkillPlanDocument(plan)
  const expectedPlanDigest = options['expect-plan'] !== undefined
    ? assertExpectedPlanDigest(document, options['expect-plan'])
    : null

  if (!options.write) {
    if (options.json) {
      console.log(JSON.stringify(document, null, 2))
    }
    else {
      const changed = plan.operations.filter(operation => operation.action !== 'unchanged')
      console.log(`Dry run (${sourceSha}): ${changed.length} change(s) across ${plan.operations.length} agent skill operations`)
      for (const operation of changed) console.log(`${operation.action.padEnd(9)} ${operation.target}`)
      console.log('No files written. Re-run with --write to apply the complete agent skill batch.')
    }
  }
  else {
    await applyAgentSkillPlan(plan)
    if (options.json) {
      console.log(JSON.stringify(buildApplyResult(document, {
        expectedPlanDigest,
        lockSourceSha: plan.nextLockSourceSha,
      }), null, 2))
    }
    else {
      const counts = plan.operations.reduce((result, operation) => {
        result[operation.action] = (result[operation.action] ?? 0) + 1
        return result
      }, {})
      if (expectedPlanDigest) console.log(`Plan digest verified: ${expectedPlanDigest}`)
      console.log(`Synced geist-nuxt agent skill (${sourceSha}): ${JSON.stringify(counts)}`)
      console.log(`Skill installed: ${path.join(consumerRoot, '.agents/skills/geist-nuxt')}`)
      console.log(`Claude adapter: ${path.join(consumerRoot, '.claude/skills/geist-nuxt')}`)
      console.log('Commit both paths to the consumer project Git repository.')
    }
  }
}
catch (error) {
  printPlanError(error, jsonMode)
  process.exitCode = 1
}
