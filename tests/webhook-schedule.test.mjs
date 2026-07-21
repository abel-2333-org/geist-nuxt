// WebhookProtocol 派生逻辑的行为测试（node --test，Node 22.18+ 原生
// 类型剥离可直接 import .ts 源）。组件视觉/状态由 gallery 页面承载视觉验证。
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  collapseScheduleSteps,
  hasWebhookProtocolContent,
} from '../kits/api-docs/utils/webhook-schedule.ts'

const steps = n => Array.from({ length: n }, (_, i) => `${i + 1} 分钟`)

test('总数不超过阈值时全铺、不折叠', () => {
  assert.deepEqual(collapseScheduleSteps(steps(6), 6), { visible: steps(6), overflow: 0 })
  assert.deepEqual(collapseScheduleSteps(steps(3), 6), { visible: steps(3), overflow: 0 })
})

test('空序列返回空且不折叠', () => {
  assert.deepEqual(collapseScheduleSteps([], 6), { visible: [], overflow: 0 })
})

test('超过阈值时铺前 max-1 个，其余折进 overflow', () => {
  const result = collapseScheduleSteps(steps(10), 6)
  assert.deepEqual(result.visible, steps(10).slice(0, 5))
  assert.equal(result.overflow, 5)
})

test('阈值为 1 时不铺 chip，全部 steps 由展开按钮揭示', () => {
  assert.deepEqual(collapseScheduleSteps(steps(3), 1), { visible: [], overflow: 3 })
})

test('折叠时 overflow 至少为 2（不存在 +1 换 1 的无谓折叠）', () => {
  const result = collapseScheduleSteps(steps(7), 6)
  assert.equal(result.visible.length, 5)
  assert.equal(result.overflow, 2)
})

test('visible 数量 + overflow 恒等于总数', () => {
  for (const total of [1, 5, 6, 7, 12, 30]) {
    const { visible, overflow } = collapseScheduleSteps(steps(total), 6)
    assert.equal(visible.length + overflow, total)
  }
})

test('非法阈值时不折叠，原样返回', () => {
  assert.deepEqual(collapseScheduleSteps(steps(4), 0), { visible: steps(4), overflow: 0 })
  assert.deepEqual(collapseScheduleSteps(steps(4), 2.5), { visible: steps(4), overflow: 0 })
  assert.deepEqual(collapseScheduleSteps(steps(4), Number.NaN), { visible: steps(4), overflow: 0 })
})

test('只传标题或空 facts 的 section 不进入文档大纲', () => {
  assert.equal(hasWebhookProtocolContent(undefined), false)
  assert.equal(hasWebhookProtocolContent({}), false)
  assert.equal(hasWebhookProtocolContent({ facts: [] }), false)
})

test('description、facts、ACK example 或 delivery schedule 均算真实内容', () => {
  assert.equal(hasWebhookProtocolContent({ description: 'Verify the signature.' }), true)
  assert.equal(hasWebhookProtocolContent({ facts: [{}] }), true)
  assert.equal(hasWebhookProtocolContent({ example: { code: '{}' } }), true)
  assert.equal(hasWebhookProtocolContent({ schedule: { summary: 'Retry once.' } }), true)
})
