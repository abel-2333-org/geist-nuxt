<script setup lang="ts">
import type { ApiCodeLabels } from './CodeBlock.vue'
import FactList from '../internal/FactList.vue'
import FactRow from '../internal/FactRow.vue'

// Domain component (API docs): webhook protocol facts —— 连贯呈现一个 webhook
// 的 Verification / Acknowledgement / Delivery 三段协议事实。它是 OperationHeader
// (kind="webhook") 的正文伙伴：header 管 identity（事件名），本件管「怎么验证、
// 怎么确认、怎么投递重试」。数据无关、locale-ready：label、term、value、
// 总结句由调用方以已本地化文本注入（展开/收起按钮提供可覆盖的英文默认文案，
// 结构 chrome 惯例）；组件只负责 information architecture、
// 视觉层级、省略规则与 a11y，不解析 Contract、不实现协议逻辑。
//
// Anatomy:
//   root（无外框列，space-y 分段；外框/留白归页面布局）
//   └─ section ×0..3（未提供的 section 整段省略——绝不渲染空卡片或 "none"）
//      ├─ header       ── 复用 <FieldGroup>（mono 大写 label + headingLevel）
//      ├─ description  ── 可选导语
//      ├─ facts <dl>   ── term/value 行（format 决定 value 呈现：text / code /
//      │                   inline-markdown），可选 note
//      ├─ ACK 专属     ── 可选 CodeBlock example（仅 literal 语义且确有文本 body）
//      └─ Delivery 专属── 可选 schedule 行：调用方总结句是可访问真源，
//                         chips 为视觉序列（长序列折叠，按钮带动作文案可展开）
//
// States（纯展示件）:
//   - section 省略：三段各自独立出现或省略；
//   - ACK body 语义由数据形状表达：literal → example（CodeBlock）；echo /
//     intentional empty → facts 行文字表达（value 可 code 呈现回显参数名）；
//   - schedule：无 steps → 只有总结句；短序列全铺；长序列折叠（aria-expanded）；
//   - 未知事实：不传即不渲染。
//
// A11y:
//   - headingLevel 接入文档大纲（FieldGroup 先例）；DOM 顺序 = 阅读顺序；
//   - facts 用 <dl>/<dt>/<dd> 语义；
//   - schedule chips / 箭头逐个 aria-hidden（视觉冗余，真源是总结句）；
//     展开按钮可聚焦，故 aria-hidden 不落在容器上；
//   - 展开按钮 aria-expanded，可见文案即可访问名（WCAG 2.5.3 Label in Name），
//     chevron 仅装饰；展开时 <dd> 内追加 sr-only 全序列文本，
//     保证状态切换对 SR 有可感知变化；不用纯颜色传意。

/** fact value 的呈现格式；渲染行为只由该字段驱动，绝不由 value 内容触发 */
export type WebhookProtocolFactFormat = 'text' | 'code' | 'inline-markdown'

export interface WebhookProtocolFact {
  /** 事实名（已本地化），如 '签名头' */
  term: string
  /** 主值（已本地化文案或字面 token）；serializable string，不接受 raw HTML */
  value: string
  /**
   * 呈现格式，默认 'text'（纯文本）。'code' 以 InlineCode（mono token）整值呈现，
   * 用于 header 名、参数名等字面值；'inline-markdown' 为明确 opt-in，经
   * InlineMarkdown 安全子集渲染（code / strong / em / del / internal & external
   * link），unsafe scheme 与 raw HTML 不会被执行。
   */
  format?: WebhookProtocolFactFormat
  /** 可选补充说明（已本地化），始终纯文本 */
  note?: string
}

export interface WebhookProtocolSectionData {
  /** section 标题（已本地化），mono 大写呈现 */
  label: string
  /** 可选导语（已本地化），始终纯文本 */
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
  /** CodeBlock 按钮、反馈与空态文案（已本地化） */
  labels?: ApiCodeLabels
}

export interface WebhookProtocolSchedule {
  /** 行名（已本地化），如 '重试节奏' */
  term: string
  /** 读者友好的总结句（已本地化）——schedule 的可访问文本真源 */
  summary: string
  /** 逐次间隔的已本地化短文本（如 '5 分钟'），仅作视觉序列；省略则只显示总结句 */
  steps?: string[]
  /** 折叠态展开按钮可见文案兼可访问名（已本地化）；省略时回退英文默认 'Show N more' */
  expandLabel?: (hidden: number) => string
  /** 展开态收起按钮可见文案兼可访问名（已本地化）；省略时回退英文默认 'Show less' */
  collapseLabel?: string
}

const props = withDefaults(defineProps<{
  verification?: WebhookProtocolSectionData
  acknowledgement?: WebhookProtocolSectionData & { example?: WebhookProtocolAckExample }
  delivery?: WebhookProtocolSectionData & { schedule?: WebhookProtocolSchedule }
  /** 接入文档大纲；默认 2（standalone），嵌在 h2 操作标题下时传 3 */
  headingLevel?: 2 | 3 | 4
  /** schedule chips 正整数折叠阈值：超过则铺前 maxScheduleSteps-1 个 + 展开按钮 */
  maxScheduleSteps?: number
}>(), {
  headingLevel: 2,
  maxScheduleSteps: 6,
})

const sections = computed(() => {
  const candidates: { key: string; data?: WebhookProtocolSectionData }[] = [
    { key: 'verification', data: props.verification },
    { key: 'acknowledgement', data: props.acknowledgement },
    { key: 'delivery', data: props.delivery },
  ]
  return candidates.filter(
    (section): section is { key: string; data: WebhookProtocolSectionData } =>
      hasWebhookProtocolContent(section.data),
  )
})

/** 未指定 format 时使用纯文本。 */
function factFormat(fact: WebhookProtocolFact): WebhookProtocolFactFormat {
  return fact.format ?? 'text'
}

/* schedule chips 折叠（视觉层；派生逻辑在 utils/webhook-protocol.ts，可测） */
const scheduleExpanded = ref(false)
const schedule = computed(() => props.delivery?.schedule)
const collapsed = computed(() =>
  collapseScheduleSteps(schedule.value?.steps ?? [], props.maxScheduleSteps),
)
const visibleSteps = computed(() =>
  scheduleExpanded.value ? (schedule.value?.steps ?? []) : collapsed.value.visible,
)
function toggleSchedule() {
  scheduleExpanded.value = !scheduleExpanded.value
}
</script>

<template>
  <div class="space-y-8">
    <FieldGroup
      v-for="section in sections"
      :key="section.key"
      :label="section.data.label"
      :heading-level="headingLevel"
    >
      <div class="space-y-4 pt-2">
        <p v-if="section.data.description" class="text-sm leading-relaxed text-muted">
          {{ section.data.description }}
        </p>

        <FactList
          v-if="section.data.facts?.length || (section.key === 'delivery' && schedule)"
        >
          <FactRow
            v-for="fact in section.data.facts"
            :key="fact.term"
            :fact="{ term: fact.term, value: fact.value, note: fact.note, code: factFormat(fact) === 'code' }"
          >
            <!-- rich fact：opt-in 时经 InlineMarkdown 安全子集渲染；note 保持纯文本 -->
            <template v-if="factFormat(fact) === 'inline-markdown'" #value>
              <span class="wrap-anywhere text-sm text-highlighted">
                <InlineMarkdown :text="fact.value" />
              </span>
              <p v-if="fact.note" class="wrap-anywhere text-sm leading-relaxed text-muted">
                {{ fact.note }}
              </p>
            </template>
          </FactRow>

          <!-- Delivery 专属：schedule 行（总结句是可访问真源，chips 纯视觉） -->
          <FactRow
            v-if="section.key === 'delivery' && schedule"
            :fact="{ term: schedule.term, value: schedule.summary }"
          >
            <template #value>
              <div class="min-w-0 space-y-2">
                <p class="text-sm text-highlighted">{{ schedule.summary }}</p>
                <!-- 展开按钮可聚焦，故 aria-hidden 只落在纯视觉的 chip/箭头上 -->
                <div
                  v-if="visibleSteps.length || collapsed.overflow > 0"
                  class="flex flex-wrap items-center gap-1.5"
                >
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
                      v-if="!scheduleExpanded && visibleSteps.length > 0"
                      name="i-lucide-arrow-right"
                      class="size-3 shrink-0 text-dimmed"
                      aria-hidden="true"
                    />
                    <!-- 可见文案即可访问名（Label in Name）；chevron 纯装饰。
                         outline 而非 soft：与 aria-hidden 的 soft chips 在静止态就
                         区分控件与数据，且 hover（bg-default → bg-elevated）可感知 -->
                    <UButton
                      color="neutral"
                      variant="outline"
                      size="xs"
                      :trailing-icon="scheduleExpanded ? 'i-lucide-chevron-up' : 'i-lucide-chevron-down'"
                      :aria-expanded="scheduleExpanded"
                      @click="toggleSchedule"
                    >
                      {{ scheduleExpanded
                        ? (schedule.collapseLabel ?? 'Show less')
                        : (schedule.expandLabel?.(collapsed.overflow) ?? `Show ${collapsed.overflow} more`) }}
                    </UButton>
                  </template>
                </div>
                <!-- 展开时给 SR 一段可感知的全序列文本（chips 本身 aria-hidden） -->
                <span v-if="scheduleExpanded && schedule.steps?.length" class="sr-only">
                  {{ schedule.steps.join(' → ') }}
                </span>
              </div>
            </template>
          </FactRow>
        </FactList>

        <!-- ACK 专属：literal body 示例（复用 CodeBlock，不强行建模为 ResponseExample） -->
        <CodeBlock
          v-if="section.key === 'acknowledgement' && acknowledgement?.example"
          :title="acknowledgement.example.title"
          :labels="acknowledgement.example.labels"
          :variants="[{
            language: acknowledgement.example.language ?? 'json',
            code: acknowledgement.example.code,
          }]"
          max-height="16rem"
        />
      </div>
    </FieldGroup>
  </div>
</template>
