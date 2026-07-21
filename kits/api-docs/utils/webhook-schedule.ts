// Webhook delivery schedule 的视觉序列折叠（WebhookProtocol 的可测纯函数）。
// steps 是调用方已本地化的间隔短文本（如 '5 分钟'）；可访问文本真源始终是
// 调用方的总结句，这里只决定视觉层铺几个 chip、折叠几个。

export interface CollapsedScheduleSteps {
  /** 视觉层实际铺开的 steps */
  visible: string[]
  /** 折进 +N 的数量；0 表示不折叠 */
  overflow: number
}

export interface WebhookProtocolContent {
  description?: string
  facts?: readonly unknown[]
  example?: { code?: string }
  schedule?: unknown
}

/** label 只是段标题；至少有一项正文数据时，这一段才应进入文档大纲。 */
export function hasWebhookProtocolContent<T extends WebhookProtocolContent>(
  section: T | undefined,
): section is T {
  return !!section && !!(
    section.description?.trim()
    || section.facts?.length
    || section.example?.code
    || section.schedule
  )
}

/**
 * 折叠规则：steps 总数 ≤ max 时全铺；超过时铺前 max-1 个，其余折为 overflow
 * （+N 与被折的 chip 一起占满 max 个视觉槽位，不会出现 +1 换 1 的无谓折叠……
 * 除非 total = max + 1，此时 +2 起步仍成立：overflow = total - (max-1) ≥ 2）。
 */
export function collapseScheduleSteps(steps: string[], max: number): CollapsedScheduleSteps {
  if (!Number.isInteger(max) || max < 1 || steps.length <= max) {
    return { visible: steps, overflow: 0 }
  }
  const visibleCount = max - 1
  return {
    visible: steps.slice(0, visibleCount),
    overflow: steps.length - visibleCount,
  }
}
