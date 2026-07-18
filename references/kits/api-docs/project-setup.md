# API 文档场景：项目配置

geist-nuxt 基座（starter）是一个**纯 UI 基座**——只含 `@nuxt/ui` 及其自动注册的模块（color-mode、fonts、icon）。搭一个真实的 **API 文档站 / 开发者门户**时，除了装入本 kit 的组件（见 `index.md`），通常还需要一批**领域模块**。本文说明该装什么、怎么接，以及和基座定位的边界。

> **基座 vs 领域的分界**：任何 UI 项目都需要的 → 属基座（已在 starter）。只有特定场景才需要的（多语言、内容源、SEO 卡片…）→ 属领域，在**消费项目**里按需装，不进通用 starter。

## 推荐模块清单

按「是否属于基座」分三档。装法都是 `pnpm add -D <module>` 后加进 `nuxt.config.ts` 的 `modules`（`@nuxt/ui` 已在基座里）。

| 模块 | 归属 | 用途 | 备注 |
|---|---|---|---|
| `@nuxt/ui` | ✅ 基座（已含） | 组件基座 | 勿重复添加 |
| `@nuxt/eslint` | ⚠️ 基座可选 | Lint / 代码风格 | 通用工程质量，可加进 starter |
| `@nuxt/image` | ⚠️ 基座可选 | 图片优化 | 较通用；有大量图片才必要 |
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

i18n 是**消费项目**的职责，基座不含。单语言项目直接用默认标签、零负担；多语言项目通过覆盖注入 `$t(...)`。

在项目里接 `@nuxtjs/i18n` 的典型做法：

1. `pnpm add -D @nuxtjs/i18n`，加进 `nuxt.config.ts` 的 `modules`。
2. 配置 locales 与默认语言，locale 文件放 `i18n/locales/*.json`（如 `en.json` / `zh.json`）。
3. 在**页面 / 区块**里取翻译，把结果作为 props 传给 kit 组件：

```vue
<script setup lang="ts">
const { t } = useI18n()
</script>

<template>
  <ResponseExample
    :scenarios="scenarios"
    :request-label="t('api.labels.request')"
    :response-label="t('api.labels.response')"
  />
</template>
```

- **用户内容**（`scenarios` 里的说明、响应体）与**结构标签**（`request-label`/`response-label`）区别在于：结构标签**有内置默认值**（`'Request'`/`'Response'`），单语言项目**不传也能用**；只有多语言项目才需要覆盖。用户内容则**必须**传。
- kit 组件（`ResponseExample` 等）**不感知** i18n——它只渲染传入的值。切换语言时，页面重新计算 `t(...)`，组件跟着更新。
- 代码示例这类**不随语言变化**的内容（cURL、JSON body）不要进 locale 文件，保持原样传入 `CodeBlock` 的 `variants`。
- 每种语言的文案各自遵守 Geist Voice（见 `foundations/voice-content.md`）。

## @nuxt/content 取舍

kit 的 `index.md` 记录过：**starter 刻意不内置 `@nuxt/content`**——它靠构建时生成、运行时导入的 SQLite dump 建表，在托管 dev server 上重启后不能稳定 re-seed，对一个「要被分发、套用到新对话」的 starter 是不可接受的可靠性风险。

这条**针对的是 starter 的可靠性**，不是禁止在真实项目里用 content。二者调和如下：

- **kit 组件是「内容管线无关」的**：`ApiDocsCodeBlock`、`ApiDocsResponseExample` 等只吃普通 props（数组 / 字符串），不依赖任何内容源，脱离 content 也能用。
- **真实项目要用 `@nuxt/content` 管文档内容，是可以的**：让 content 提供**数据**（从 Markdown / YAML 查询出端点、参数、示例），页面把查询结果**作为 props 传给 kit 组件渲染**。数据源与渲染解耦，各司其职。
- 换句话说：**content 负责「内容从哪来」，kit 组件负责「内容怎么显示」**。starter 不内置 content 只是分发可靠性考量，真实项目可自行引入。
- **全站搜索的基座是 kit 自带的 `<ApiDocsSiteSearch>`**（`⌘K` 命令面板，吃文档索引、零内容管线依赖，见 `site-search.md`）——没装 content 也有完整的全站搜索。`@nuxt/content` 就位后要**跨整站文档正文全文检索**时，可在顶栏同一位置换 Nuxt UI 的 `<UContentSearch>` / `<UContentSearchButton>`（绑 content、属消费项目职责，**不进 kit 切片**）。两者的正确落位都是 **app 顶栏 / navbar**（参考 Nuxt UI / Vercel 文档站），与 `<ApiDocsSidebarNav>` 侧栏内的「就地过滤搜索」分属**不同层级**——各司其职、靠层级区分。**不要**把全站搜索按钮塞进侧栏顶部（会和就地过滤框变成两个雷同搜索框上下紧贴），更不要把任何全站搜索焊进导航组件。

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

- 不要把领域模块（i18n / content / sitemap …）加进 **starter**——它们属消费项目，基座保持纯 UI。
- 不要为了让 kit 组件「支持多语言」而在组件里塞 `useI18n()`——组件对 i18n 无感知。用户内容从外部传入；结构标签用「内置默认值 + label prop 覆盖」，不要写死到无法覆盖，也不要强制每次都传。
- 模块版本以各自官方文档为准，不要臆造配置项。
