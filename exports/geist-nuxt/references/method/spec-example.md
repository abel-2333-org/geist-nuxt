# 示例：用规格模板落地一个新领域组件

演示把 `method/component-spec-template.md` 应用到一个真实的组合组件。以 `CodeBlock`（API 文档场景，近单色多语言代码块基座）为例——**先填规格，再实现**。规格是评审依据；实现要能对照规格逐条验收。

> 本范例对应 kit 里已落地的组件，完整实现见 `assets/kits/api-docs/components/CodeBlock.vue`（配套 `composables/useCodeWrap.ts`）。下面的实现段是提炼骨架，用来演示"规格 → 代码"的对应关系。复制交互本身**不在 CodeBlock 内实现**，而是委托给通用基座的 `<CopyButton>`（`app/components/CopyButton.vue` + `composables/useCopy.ts`）——这正体现了"先查现成、能复用就不重造"的硬前置。

## 1. 规格（先写，作为评审依据）

**Anatomy**
| 部位 | 使用 | 映射 |
|---|---|---|
| container | ✓ | `<section>` + `border-default` + `bg-elevated` |
| header/toolbar | ✓ | 单行工具栏，左标题右控件，永不换行/堆叠 |
| label | ✓ | 语言切换 → `USelect`；标题/文件名 → 截断文本 |
| value | ✓ | 代码体 → `<pre><code>` (`font-mono`)，近单色无高亮器 |
| action | ✓ | 换行切换 → `UButton`（icon）；复制 → 复用 `<CopyButton>`；`#controls` slot 供包装组件注入场景/状态 |
| affordance | ✓ | 复制成功的瞬时反馈（图标 + 色，无布局位移）——由 `CopyButton` 内部提供 |
| focus target | ✓ | select 与所有 icon 按钮 |
| error/helper | — | 不使用（空态另有分支） |

**State model**
- **active language**：当前选中语言；数据变化时若仍存在则保留，否则回落到第一个。
- **copied**：瞬时态（~1.6s 自动复位），只换图标/色，**不改布局**——此状态**归属 `CopyButton`**，CodeBlock 不自持。
- **wrap on/off**：共享 + 持久化（经 `useCodeWrap`：`useState` + cookie，SSR 安全）。
- **empty / unavailable**：`variants` 为空或当前无 code → 渲染空态；但 `#controls`（场景/状态）仍可见，供读者切回有内容的选择。
- 无 disabled / loading / invalid。

**Accessibility**
- icon 按钮带**动态** `aria-label`（换行 Wrap on / off）；换行按钮带 `aria-pressed`。复制按钮的动态 `aria-label`（Copy / Copied）由 `CopyButton` 负责。
- 复制结果在 `role=status aria-live=polite` 的 `sr-only` 区**礼貌播报**——播报由 `CopyButton` 内部提供，CodeBlock 不再重复。
- select 有 `aria-label`；`:focus-visible` 焦点环保留。
- 语言/状态用**文字 + 图标**，不单靠颜色；色彩全走 Geist 语义 token，随 color-mode 明暗切换。
- 代码体内部滚动（`overflow:auto` + `overscroll-behavior:contain`），长代码不把页面撑出横向溢出。

## 2. 实现（骨架，对照规格）

```vue
<script setup lang="ts">
export interface CodeVariant {
  language: string   // 选择用 id，如 'curl' | 'json' | 'python'
  label?: string     // 语言显示名，缺省时按 id 人性化
  code: string       // 原始源码——复制与渲染的就是它
}

// 组件自持("chrome")文案，供文档站一处本地化（如传入 @nuxtjs/i18n 的 $t()）；
// 内容文案（语言名、标题）来自数据 props，原样渲染。
export interface ApiCodeLabels {
  language?: string; copy?: string; copied?: string
  wrapOn?: string; wrapOff?: string; emptyTitle?: string; emptyHint?: string
}

const props = withDefaults(defineProps<{
  variants?: CodeVariant[]        // 空数组 → 渲染不可用态
  title?: string
  icon?: string
  defaultWrap?: boolean           // 首访换行态；之后共享 + 持久化
  maxHeight?: string
  labels?: ApiCodeLabels          // 可覆盖的 UI 文案（本地化）
}>(), {
  variants: () => [], icon: 'i-lucide-terminal',
  defaultWrap: false, maxHeight: '24rem', labels: () => ({}),
})

// chrome 文案：调用方覆盖叠加在中性英文默认值之上
const t = computed(() => ({
  language: 'Language', copy: 'Copy code', copied: 'Copied to clipboard',
  wrapOn: 'Turn on line wrap', wrapOff: 'Turn off line wrap',
  emptyTitle: 'No example available', emptyHint: 'Try another selection.',
  ...props.labels,
}))
// copy/copied 文案仍在 t 里，但复制逻辑与状态交给 <CopyButton>（见模板）。

const activeLanguage = ref<string>()
const current = computed(() =>
  props.variants.find(v => v.language === activeLanguage.value) ?? props.variants[0])
const hasContent = computed(() => !!current.value?.code)

// 数据变化时保留选中语言，失效则回落到第一个
watch(() => props.variants, (set) => {
  if (!set.some(v => v.language === activeLanguage.value)) activeLanguage.value = set[0]?.language
}, { immediate: true })

const wrap = useCodeWrap(props.defaultWrap)   // 共享 + 持久化
</script>

<template>
  <section class="w-full overflow-hidden rounded-lg border border-default bg-elevated shadow-xs">
    <!-- 工具栏：永远单行；标题先截断，select 收缩自适应，icon 按钮不缩 -->
    <div class="flex flex-nowrap items-center justify-between gap-x-3 border-b border-default bg-muted/60 px-3 py-2">
      <div class="flex min-w-0 items-center gap-2">
        <UIcon :name="icon" class="size-4 shrink-0 text-muted" aria-hidden="true" />
        <span v-if="title" class="truncate text-sm font-medium text-highlighted">{{ title }}</span>
        <slot name="leading" />
      </div>
      <div class="flex min-w-0 items-center justify-end gap-1.5">
        <slot name="controls" />  <!-- 包装组件注入场景/状态切换 -->
        <USelect v-if="hasContent && props.variants.length > 1"
          v-model="activeLanguage" :items="/* language items */[]"
          size="xs" color="neutral" variant="subtle" :aria-label="t.language" />
        <UButton v-if="hasContent" :icon="wrap ? 'i-lucide-wrap-text' : 'i-lucide-text'"
          :color="wrap ? 'primary' : 'neutral'" variant="ghost" size="xs"
          :aria-label="wrap ? t.wrapOff : t.wrapOn" :aria-pressed="wrap" @click="wrap = !wrap" />
        <!-- 复用通用基座的复制按钮：剪贴板逻辑、copied 态、播报、兜底全在里面 -->
        <CopyButton v-if="hasContent" :value="current?.code ?? ''"
          toast-label="Code" :label="t.copy" :copied-label="t.copied" size="xs" />
      </div>
    </div>

    <!-- 代码体：近单色、无高亮器、内部滚动 -->
    <div v-if="hasContent" class="code-surface bg-default" :class="{ 'is-wrap': wrap }" :style="{ maxHeight }">
      <pre class="raw-pre"><code class="font-mono text-sm leading-relaxed text-highlighted">{{ current?.code }}</code></pre>
    </div>
    <!-- 空态：控件仍可切换 -->
    <div v-else class="flex flex-col items-center justify-center gap-2 bg-default px-6 py-12 text-center">
      <UIcon name="i-lucide-code-xml" class="size-8 text-dimmed" aria-hidden="true" />
      <p class="text-sm font-medium text-highlighted">{{ t.emptyTitle }}</p>
      <p class="max-w-xs text-sm text-muted">{{ t.emptyHint }}</p>
    </div>
    <!-- 复制结果的礼貌播报由 <CopyButton> 内部负责，此处不再重复 -->
  </section>
</template>
```

## 要点（规格如何逐条落到代码）

- **anatomy → 模板结构**：container/toolbar/body/空态 一一对应模板里的分区。
- **state model → 响应式状态**：`activeLanguage`（保留/回落逻辑）、`wrap`（`useCodeWrap` 共享持久化）、`hasContent`（空态分支）；`copied` 态**下放到 `CopyButton`**，不在本组件。
- **a11y → 属性**：动态 `aria-label`、`aria-pressed`、select 的 `aria-label`；语言/状态文字 + 图标双通道。复制的动态 `aria-label` + `role=status aria-live=polite` 播报由 `CopyButton` 提供。
- **token 而非硬编码色值**：`border-default` `bg-elevated` `bg-muted` `text-highlighted` `text-muted` `text-dimmed` + 语义 color，随 color-mode 切换。
- **组合而非重造**：只用 Nuxt UI 原语（USelect/UButton/UIcon）+ 基座组件 `CopyButton` + Geist token，无 Shiki / 内容管线。复制这类高频交互抽成 `CopyButton` 复用，而不是每个组件各写一遍——正是规格第 1 步"先查现成"的产物。
- **文案二分**：chrome 文案（Copy/Language…）内置默认 + `labels` 可覆盖；内容文案（语言名、code）从 `variants` 传入原样渲染。见 `foundations/conventions.md`。
- **先规格后实现**——这份规格就是评审时逐条对照的依据。`RequestExample` / `ResponseExample` 正是把 body 委托给本组件，只在 `#controls` 注入场景/状态切换。
