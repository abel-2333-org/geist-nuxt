# API 文档场景：项目配置

geist-nuxt foundation 是一个**纯 UI 基础切片**——以 `@nuxt/ui` 及其 color-mode、fonts、icon 接线为基础。搭一个真实的 **API 文档站 / 开发者门户**时，先通过根 registry 安装 `geist-foundation` 与所需 API Docs items，再按需增加领域模块。copy / update 默认 dry-run，只有确认 plan 后显式传 `--write` 才会修改项目。本文说明模块边界，不替代 `references/registry.md` 的 copy-in 流程。

> **foundation vs 领域的分界**：任何 UI 项目都需要的 → foundation registry items。只有特定场景才需要的（多语言、内容源、SEO 卡片…）→ 消费项目按需安装，不进入 foundation 或 kit 源码。

## 推荐模块清单

按「是否属于 foundation」分三档。copy-in 只负责 registry 受管源码；额外 npm module 仍由消费项目 `pnpm add -D <module>` 并接入 `nuxt.config.ts`。

| 模块 | 归属 | 用途 | 备注 |
|---|---|---|---|
| `@nuxt/ui` | ✅ foundation 前置 | 组件基座 | 消费项目必须具备 |
| `@nuxt/eslint` | ⚠️ 项目可选 | Lint / 代码风格 | 工程质量，不属于 UI copy-in |
| `@nuxt/image` | ⚠️ 项目可选 | 图片优化 | 有大量图片才必要 |
| `@nuxtjs/i18n` | 🔶 领域 | 多语言 | 见下方「i18n 接线」 |
| `@nuxt/content` | 🔶 领域 | 文档内容源（Markdown → 数据） | 见下方「@nuxt/content 取舍」 |
| `@nuxtjs/sitemap` | 🔶 领域 | 生成 sitemap.xml | 站点级 SEO |
| `nuxt-og-image` | 🔶 领域 | 动态 OG / 社交分享卡片 | 站点级 |
| `nuxt-llms` | 🔶 领域 | 生成 llms.txt，面向 LLM 抓取 | 文档站常见 |
| `@nuxtjs/mcp-toolkit` | 🔶 领域 | 暴露 MCP 工具 | 特定集成需求才加 |

> 领域模块之间彼此独立，按项目**实际需要**逐个加，不要一次性全装。

## i18n 接线

**原则（已在 `foundations/conventions.md` 固化）**：区分两类文字——
- **用户内容**（端点说明、参数描述、请求/响应体）→ 永远 props/slot 传入，组件不内置。
- **结构性标签**（`Request`/`Response`、区块标题、复制提示等组件骨架文字）→ 组件**内置合理默认值 + 暴露 label prop 可覆盖**，对齐 Nuxt UI 自身的 locale 模型（它对 `alert.close`、`table.noData` 等就是内置默认 + 可覆盖）。

i18n 是**消费项目**的职责，foundation / kit 不含。单语言项目直接用默认标签、零负担；多语言项目通过覆盖注入 `$t(...)`。

在项目里接 `@nuxtjs/i18n` 的典型做法：

1. `pnpm add -D @nuxtjs/i18n`，在 `nuxt.config.ts` 中把它放到 `@nuxt/ui` 之后：

```ts
export default defineNuxtConfig({
  modules: ['@nuxt/ui', '@nuxtjs/i18n'],
})
```

2. 配置 locales 与默认语言，locale 文件放 `i18n/locales/*.json`（如 `en.json` / `zh.json`）。
3. 在根 app shell 把当前 i18n locale 同步给 Nuxt UI，并同步文档的 `lang` / `dir`。如果项目 locale code 与 Nuxt UI export key 不一致，使用显式映射，不要靠字符串猜测：

```vue
<script setup lang="ts">
import { en, zh_cn } from '@nuxt/ui/locale'

const { locale } = useI18n()
const nuxtUiLocales = { en, zh: zh_cn } as const
const nuxtUiLocale = computed(() =>
  nuxtUiLocales[locale.value as keyof typeof nuxtUiLocales] ?? en,
)

useHead({
  htmlAttrs: {
    lang: computed(() => nuxtUiLocale.value?.code),
    dir: computed(() => nuxtUiLocale.value?.dir),
  },
})
</script>

<template>
  <UApp :locale="nuxtUiLocale">
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </UApp>
</template>
```

4. 在**页面 / 区块**里取翻译，把结果作为 props 传给 kit 组件：

```vue
<script setup lang="ts">
const { t } = useI18n()
</script>

<template>
  <ApiDocsResponseExample
    :scenarios="scenarios"
    :labels="{
      title: t('api.labels.response'),
      scenario: t('api.labels.scenario'),
      status: t('api.labels.status'),
      copy: t('api.labels.copy'),
      copied: t('api.labels.copied'),
      copyFailure: t('api.labels.copyFailure'),
    }"
  />
</template>
```

- **用户内容**（`scenarios` 里的说明、响应体）与**结构标签**（`labels.title` / `labels.copy` 等）区别在于：结构标签**有内置默认值**（`'Request'`/`'Response'`），单语言项目**不传也能用**；只有多语言项目才需要覆盖。用户内容则**必须**传。复制失败文案用完整的 `labels.copyFailure` 注入，不跨层拼接。
- kit 组件（`ApiDocsResponseExample` 等）**不感知** i18n——它只渲染传入的值。切换语言时，页面重新计算 `t(...)`，组件跟着更新。
- 代码示例这类**不随语言变化**的内容（cURL、JSON body）不要进 locale 文件，保持原样传入 `CodeBlock` 的 `variants`。
- 每种语言的文案各自遵守 Geist Voice（见 `foundations/voice-content.md`）。

## 多域路由（支付 / 付款 / 对账等多产品线文档）

**用路径分段路由，不要用 query 参数区分域。** 消费项目按 Nuxt 文件路由组织：

```
app/pages/docs/[domain]/index.vue      → /docs/payments
app/pages/docs/[domain]/[...slug].vue  → /docs/payments/checkout/create
```

- 每个域每篇文档获得独立规范 URL：可独立 SEO 收录、进 sitemap、做 OG 卡片（正好衔接上表的 `@nuxtjs/sitemap` / `nuxt-og-image`）。
- 按路由 code-split：只加载当前域的导航树与内容，不像单页方案一次性打包全部域数据。
- 域级差异（主题色、布局、导航树）走 `definePageMeta` / layout，不用条件渲染堆在一个组件里。
- 域切换器的每个选项就是一个 `NuxtLink`（`to="/docs/payouts"`），语义天然正确，无需手动同步状态。
- 页内锚点（字段深链接）继续用 hash，与路径分段正交。

> gallery 的 `/kits/api-docs/docs-shell/[domain]` demo 就是这个形态的活样板：每个域一个路径、域切换器是 NuxtLink、非法域 replace 回落默认域、侧栏 active 按 `route.hash` 显式计算。消费项目照抄该结构，再把域内单页锚点展开成 `[...slug]` 子页即可。

## @nuxt/content 取舍

根 Source-first gallery / v0 preview 刻意不内置 `@nuxt/content`：content v3 靠构建时生成、运行时导入的 SQLite dump 建表，在部分托管 preview 重启后不能稳定 re-seed，不适合作为设计系统 snapshot 的运行前置。

这条**针对的是根 preview 的可靠性**，不是禁止真实消费项目使用 content：

- **kit 组件是「内容管线无关」的**：`ApiDocsCodeBlock`、`ApiDocsResponseExample` 等只吃普通 props（数组 / 字符串），不依赖任何内容源，脱离 content 也能用。
- **真实项目要用 `@nuxt/content` 管文档内容，是可以的**：让 content 提供**数据**（从 Markdown / YAML 查询出端点、参数、示例），页面把查询结果**作为 props 传给 kit 组件渲染**。数据源与渲染解耦，各司其职。
- 换句话说：**content 负责「内容从哪来」，kit 组件负责「内容怎么显示」**。根 preview 不内置 content 只是 snapshot 可靠性考量，真实项目可自行引入。
- **全站搜索的 UI 可以直接使用 `ApiDocsSiteSearch`**：静态 `groups` 由导航 ViewModel 派生；正文检索由消费项目把 Content 查询适配为 `search(query) → SiteSearchItem[]`。这样 kit 提供一致的 `⌘K` trigger / modal / method badge 呈现，但仍不导入 Content。消费项目若更偏好 Content 自带的 `<UContentSearch>` / `<UContentSearchButton>` 也可以直接在 app 层使用；它们仍不进入 kit dependency closure。
- 无论选哪种实现，正位都是 **app 顶栏 / navbar**，与 `<ApiDocsSidebarNav>` 的 `/` 树内过滤分属不同层级。不要把全站搜索塞进侧栏 `#header`，否则会与树内过滤框形成两个雷同入口。

消费项目自行安装 `@nuxt/content`，并让 `@nuxt/ui` 先于它注册：

```ts
export default defineNuxtConfig({
  modules: ['@nuxt/ui', '@nuxt/content'],
})
```

如果内容文件不在 `app/` 下，还要从消费项目的 `app/assets/css/main.css` 显式加入 Tailwind source；路径相对该 CSS 文件解析：

```css
@import "tailwindcss";
@import "@nuxt/ui";
@source "../../../content/**/*";
```

```vue
<script setup lang="ts">
// 真实项目里，用 content 查询端点数据
const { data } = await useAsyncData('endpoint', () =>
  queryCollection('api').path('/deployments/create').first()
)
</script>

<template>
  <ApiDocsCodeBlock :variants="data?.requestSamples ?? []" />
</template>
```

## 不要臆造

- 不要把领域模块（i18n / content / sitemap …）加进 foundation 或 kit registry item——它们属消费项目，Source-first 根 preview 保持纯 UI。
- 不要为了让 kit 组件「支持多语言」而在组件里塞 `useI18n()`——组件对 i18n 无感知。用户内容从外部传入；结构标签用「内置默认值 + label prop 覆盖」，不要写死到无法覆盖，也不要强制每次都传。
- 模块版本以各自官方文档为准，不要臆造配置项。
