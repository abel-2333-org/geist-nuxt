<script setup lang="ts">
// Domain component (API docs): webhook protocol facts —— 连贯呈现一个 webhook
// 的 Verification / Acknowledgement / Delivery 三段协议事实。它是 OperationHeader
// (kind="webhook") 的正文伙伴：header 管 identity（事件名），本件管「怎么验证、
// 怎么确认、怎么投递重试」。数据无关、locale-ready：所有 label、term、value、
// 总结句由调用方以已本地化文本注入；组件只负责 information architecture、
// 视觉层级、省略规则与 a11y，不解析 Contract、不实现协议逻辑。
//
// Anatomy:
//   root（无外框列，space-y 分段；外框/留白归页面布局）
//   └─ section ×0..3（未提供的 section 整段省略——绝不渲染空卡片或 "none"）
//      ├─ header       ── 复用 <ApiDocsFieldGroup>（mono 大写 label + headingLevel）
//      ├─ description  ── 可选导语
//      ├─ facts <dl>   ── term/value 行（value 可为 InlineCode token），可选 note
//      ├─ ACK 专属     ── 可选 CodeBlock example（仅 literal 语义且确有文本 body）
//      └─ Delivery 专属── 可选 schedule 行：调用方总结句是可访问真源，
//                         chips 为视觉序列（长序列折叠 +N，可展开）
//
// States（纯展示件）:
//   - section 省略：三段各自独立出现或省略；
//   - ACK body 语义由数据形状表达：literal → example（CodeBlock）；echo /
//     intentional empty → facts 行文字表达（value 可 code 呈现回显参数名）；
//   - schedule：无 steps → 只有总结句；短序列全铺；长序列折叠 +N（aria-expanded）；
//   - 未知事实：不传即不渲染。
//
// A11y:
//   - headingLevel 接入文档大纲（FieldGroup 先例）；DOM 顺序 = 阅读顺序；
//   - facts 用 <dl>/<dt>/<dd> 语义；
//   - schedule chips / 箭头逐个 aria-hidden（视觉冗余，真源是总结句）；
//     展开按钮可聚焦，故 aria-hidden 不落在容器上；
//   - 展开按钮 aria-expanded + 调用方注入的可访问名；不用纯颜色传意。

export interface WebhookProtocolFact {
  /** 事实名（已本地化），如 '签名头' */
  term: string
  /** 主值（已本地化文案或字面 token） */
  value: string
  /** value 以 InlineCode（mono token）呈现，用于 header 名、参数名等字面值 */
  code?: boolean
  /** 可选补充说明（已本地化） */
  note?: string
}

export interface WebhookProtocolSectionData {
  /** section 标题（已本地化），mono 大写呈现 */
  label: string
  /** 可选导语（已本地化） */
  description?: string
  /** term/value 事实行；未知事实直接不传对应行 */
  facts?: WebhookProtocolFact[]
}

export interface WebhookProtocolAckExample {
  /** ACK 文本 body 字面值 —— 仅 literal 语义且确有文本 body 时提供 */
  code: string
  language?: string
  /** CodeBlock 工具栏标题（已本地化） */
  title?: string
}

export interface WebhookProtocolSchedule {
  /** 行名（已本地化），如 '重试节奏' */
  term: string
  /** 读者友好的总结句（已本地化）——schedule 的可访问文本真源 */
  summary: string
  /** 逐次间隔的已本地化短文本（如 '5 分钟'），仅作视觉序列；省略则只显示总结句 */
  steps?: string[]
  /** 折叠态展开按钮的可访问名（已本地化） */
  expandLabel?: (hidden: number) => string
  /** 展开态收起按钮文案（已本地化） */
  collapseLabel?: string
}

const props = withDefaults(defineProps<{
  verification?: WebhookProtocolSectionData
  acknowledgement?: WebhookProtocolSectionData & { example?: WebhookProtocolAckExample }
  delivery?: WebhookProtocolSectionData & { schedule?: WebhookProtocolSchedule }
  /** 接入文档大纲；默认 2（standalone），嵌在 h2 操作标题下时传 3 */
  headingLevel?: 2 | 3 | 4
  /** schedule chips 折叠阈值：超过则铺前 maxScheduleSteps-1 个 + 展开按钮 */
  maxScheduleSteps?: number
}>(), {
  headingLevel: 2,
  maxScheduleSteps: 6,
})

const sections = computed(() => [
  { key: 'verification', data: props.verification },
  { key: 'acknowledgement', data: props.acknowledgement },
  { key: 'delivery', data: props.delivery },
].filter((s): s is { key: string; data: WebhookProtocolSectionData } => !!s.data))

/* schedule chips 折叠（视觉层；派生逻辑在 utils/webhook-schedule.ts，可测） */
const scheduleExpanded = ref(false)
const schedule = computed(() => props.delivery?.schedule)
const collapsed = computed(() =>
  collapseScheduleSteps(schedule.value?.steps ?? [], props.maxScheduleSteps),
)
const visibleSteps = computed(() =>
  scheduleExpanded.value ? (schedule.value?.steps ?? []) : collapsed.value.visible,
)
</script>

<template>
  <div class="space-y-8">
    <ApiDocsFieldGroup
      v-for="section in sections"
      :key="section.key"
      :label="section.data.label"
      :heading-level="headingLevel"
    >
      <div class="space-y-4 pt-2">
        <p v-if="section.data.description" class="text-sm leading-relaxed text-muted">
          {{ section.data.description }}
        </p>

        <dl
          v-if="section.data.facts?.length || (section.key === 'delivery' && schedule)"
          class="divide-y divide-default"
        >
          <div
            v-for="fact in section.data.facts"
            :key="fact.term"
            class="flex flex-col gap-1 py-2.5 sm:flex-row sm:gap-4"
          >
            <dt class="shrink-0 text-sm text-muted sm:w-36">{{ fact.term }}</dt>
            <dd class="min-w-0 space-y-1">
              <InlineCode v-if="fact.code">{{ fact.value }}</InlineCode>
              <span v-else class="text-sm text-highlighted">{{ fact.value }}</span>
              <p v-if="fact.note" class="text-sm leading-relaxed text-muted">{{ fact.note }}</p>
            </dd>
          </div>

          <!-- Delivery 专属：schedule 行（总结句是可访问真源，chips 纯视觉） -->
          <div
            v-if="section.key === 'delivery' && schedule"
            class="flex flex-col gap-1 py-2.5 sm:flex-row sm:gap-4"
          >
            <dt class="shrink-0 text-sm text-muted sm:w-36">{{ schedule.term }}</dt>
            <dd class="min-w-0 space-y-2">
              <p class="text-sm text-highlighted">{{ schedule.summary }}</p>
              <!-- 展开按钮可聚焦，故 aria-hidden 只落在纯视觉的 chip/箭头上 -->
              <div v-if="visibleSteps.length" class="flex flex-wrap items-center gap-1.5">
                <template v-for="(step, i) in visibleSteps" :key="i">
                  <UIcon
                    v-if="i > 0"
                    name="i-lucide-arrow-right"
                    class="size-3 shrink-0 text-dimmed"
                    aria-hidden="true"
                  />
                  <UBadge
                    color="neutral"
                    variant="soft"
                    class="font-mono tabular-nums"
                    aria-hidden="true"
                  >
                    {{ step }}
                  </UBadge>
                </template>
                <template v-if="collapsed.overflow > 0">
                  <UIcon
                    v-if="!scheduleExpanded"
                    name="i-lucide-arrow-right"
                    class="size-3 shrink-0 text-dimmed"
                    aria-hidden="true"
                  />
                  <UButton
                    color="neutral"
                    variant="soft"
                    size="xs"
                    class="font-mono tabular-nums"
                    :aria-expanded="scheduleExpanded"
                    :aria-label="scheduleExpanded
                      ? (schedule.collapseLabel ?? 'Collapse')
                      : (schedule.expandLabel?.(collapsed.overflow) ?? `+${collapsed.overflow}`)"
                    @click="() => { scheduleExpanded = !scheduleExpanded }"
                  >
                    {{ scheduleExpanded ? (schedule.collapseLabel ?? '−') : `+${collapsed.overflow}` }}
                  </UButton>
                </template>
              </div>
            </dd>
          </div>
        </dl>

        <!-- ACK 专属：literal body 示例（复用 CodeBlock，不强行建模为 ResponseExample） -->
        <ApiDocsCodeBlock
          v-if="section.key === 'acknowledgement' && acknowledgement?.example"
          :title="acknowledgement.example.title"
          :variants="[{
            language: acknowledgement.example.language ?? 'json',
            code: acknowledgement.example.code,
          }]"
          max-height="16rem"
        />
      </div>
    </ApiDocsFieldGroup>
  </div>
</template>
