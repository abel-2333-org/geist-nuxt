# geist-nuxt 架构决策记录

> 本文件记录为什么采用当前架构。可执行规则以 `SKILL.md`、`references/registry.md`、
> `references/gallery.md` 和 `references/method/component-reflow.md` 为准。

## ADR-001：采用独立 Source-first 根应用

**状态：已采纳，2026-07-18。**

仓库根目录是唯一源码真源，同时是可运行 Nuxt gallery 与 v0 preview：

```text
app/                         gallery / v0 preview / demo 与页面 recipe
foundation/
  components/
  compositions/
  composables/
  utils/
  assets/css/
  config/
kits/api-docs/
  components/
  composables/
  utils/
playground/                  未采纳候选
registry.json                唯一 copy-in manifest
references/                  AI 契约
```

旧的 `packages/core` npm Nuxt layer + `packages/kits` workspace + `apps/gallery` + 独立 `starter` 方案已被取代。历史规格保留在 `docs/archive/refactor-spec-step1.md` 与 `step2.md`，不得再作为现行实施依据。

### 原因

- Codex / v0 修改 foundation 或 kit 后可在根 app HMR 直接预览，不等待 npm 发布。
- gallery、v0 与源码使用同一份 dependency graph，减少“真源能跑、分发物不能跑”的漂移。
- 外部项目仍可按切片消费，不必把完整 gallery 当依赖。
- 删除 package / layer / starter 三套生命周期后，CI 与心智模型更短。

## ADR-002：根 registry 是唯一分发契约

**状态：已采纳。**

所有可安装切片都在根 `registry.json`。foundation 和 kit 不再各自维护 manifest，也没有 `coreDeps` 或 npm layer 隐式满足依赖。

核心字段：

- `name / type / title / description`；
- `files[]`：source path + consumer target；
- `registryDependencies[]`：依赖闭包。

依赖方向：foundation → foundation；kit → foundation / 同 kit；禁止 kit → kit。共享文件只有一个 owning slice，其他 item 通过依赖取得。完整操作与安全约束见 `references/registry.md`。

公开工具：`registry:validate`、`geist:copy`、`geist:update`、`geist:check`、`test:registry`、`test:consumer`。基础 item 名为 `geist-foundation`；copy / update 默认 dry-run，只有显式 `--write` 才修改目标。`--to` 绑定当前 checkout 的精确 40 位 SHA；`geist.lock.json` 固化 compatibility、external requirements、依赖闭包与逐文件 source / target / hash。手工复制不是受支持的安装方式。

## ADR-003：根 app 是视觉镜像，不是分发资产目录

**状态：已采纳。**

- `app/pages/components.vue` 展示 foundation catalog。
- `app/pages/kits/<kit>/` 展示 kit 组件与成熟页面形态。
- `app/pages/playground.vue` 是 `nav: false` 的候选设计面。
- demo fixture、私有 adapter 与页面 recipe 留在 `app/`，不得进入 registry。
- 导航从 Nuxt route tree 派生，不由 registry 驱动。

Story 数据仍按层级分工：原子 story 用内联假 ViewModel；页面形态用根 app fixture + 私有 adapter；kit 只认 ViewModel。

## ADR-004：CodeRail 保持 gallery-private

**状态：已被 ADR-010 取代（2026-07-20）。**

原决策：`app/components/demo/api-docs/CodeRail.vue` 与页面 recipe 的 chrome（sticky 偏移、视口高度长条、断点 gate）强耦合、没有稳定的跨项目分发契约，因此不进 foundation、不进 API Docs kit、不进 registry，仅作为下游 copy & adapt 的活 recipe。

该决策成立的前提（「与页面 chrome 强耦合、无稳定契约」）已在后续重构中消解，取代理由与新边界见 ADR-010。

## ADR-005：SidebarNav 与测量式溢出保留在 API Docs kit

**状态：已采纳。**

`ApiDocsSidebarNav` 的数据模型含 method、scenario、endpoint 等领域概念，并依赖 API Docs 的 method badge / scenario tags，所以整体留在 `kits/api-docs/`。

场景标签使用连续的 measurement overflow：`ResizeObserver` 观察可用宽度，`aria-hidden` 隐藏层测量每个标签自然像素宽，再贪心决定平铺项与 `+N` / 计数 chip。测量层不对长标签施加可见层的截断上限，否则会误判“放得下”。SSR 先渲染确定性默认，mounted 后精修，避免 hydration mismatch。

纯 CSS 断点适合离散布局切换；“能放几个算几个”的内容相关问题必须测量。完整规格见 `references/kits/api-docs/sidebar-nav.md` 与 `references/foundations/responsiveness.md`。

若未来出现第二个需要“可搜索 + 可折叠 + 可调宽”侧栏外壳的非 API Docs 场景，再把纯外壳提到 foundation，method / scenario 行仍留 kit 并通过 slot 注入。

## ADR-006：FieldItem 保留现行 UX 与延后项

**状态：现行 UX 已采纳；两项重构延后。**

- 桌面 gutter 锚点按钮与触屏 inline 常显按钮保留两份 markup。二者定位、显隐和触控职责不同，当前合并会增加条件 class，收益不足。第三处锚点或按钮逻辑显著复杂时再收敛。
- `FieldNode` 继续使用宽松的扁平 ViewModel；当前按存在性降级无运行时 bug。只有真实 adapter 频繁产生无意义组合，或 object / enum / scalar 形态稳定分化后，再评估 discriminated union。
- 深链接 composable 与 FieldItem 同一 registry slice；消费页负责 mount 时初始化 hash。可选 router scroll polish 属 app 级行为，不焊进 kit。
- 复制 toast 接受完整 `successMessage` 注入，避免 foundation 拥���半句、kit 再拼半句导致混语。

## ADR-007：国际化和私有 spec 留消费项目

**状态：已采纳。**

foundation / kit 不绑定 `@nuxtjs/i18n` 或私有 DSL。用户内容由 props / slots 注入；结构 chrome 有中性默认并允许覆盖。私有 spec、adapter、lifecycle → presentation 映射与 locale 文件留根 demo 或消费项目。

如果未来真实多语言下游反复传 labels 成为负担，可评估不绑定任何 i18n 库的 provide/inject provider；没有真实消费者前不增加抽象。

## ADR-008：分发物是可运行根 snapshot

**状态：已采纳。**

CI 先验证根 registry、registry 行为、root typecheck/build 与临时 consumer；再组装排除生成物的根 snapshot，在 dist 内重新 install/typecheck/build，最后发布 `dist-skill.tar.gz`。

不再 publish npm 或等待 starter 依赖可见。`v0.json` 的 starter path 为 `.`；memory area 同步采用整体覆盖，顶层 `RELEASE` 是新鲜度 stamp。

分发前必须全量扫描 U+FFFD（UTF-8 `EF BF BD`）。任何源码、JSON 或文档出现 replacement character 都视为编码损坏并阻断 release。

## ADR-009：SiteSearch 进 kit，DocsShell 留 gallery-private

**状态：已采纳，2026-07-19。**

`ApiDocsSiteSearch` 是 API 文档领域组件：它复用 method badge，并围绕指南、端点、
HTTP method 与 scenario 组织结果，因此进入 `kits/api-docs/` 和根 registry。组件只认
已解析的 display model；静态 groups 始终可用，可选 `search(query)` 接收消费项目的
正文索引结果。它不导入 `@nuxt/content`、不认识 OpenAPI 或私有 spec。

完整 `DocsShell` 同时决定品牌、产品域、路由、页面结构、fixture 与正文 adapter，
这些职责没有稳定的跨项目契约，因此作为 `app/components/demo/api-docs/` 下的
gallery-private recipe：不进 foundation、kit 或 registry。gallery 使用中性数据展示
可行装配；消费项目拥有自己的 shell，并按需 copy & adapt recipe。

`SidebarNav` 与 `SiteSearch` 是两个正交层级：前者用 `/` 过滤当前导航树，后者用
`⌘K` 从全站结果中跳转。`SidebarNav` 只负责全高列与内部滚动，外框、圆角和高度由
页面 shell 或 standalone demo 的父布局拥有，避免嵌套时出现双边框和双高度约束。

**投入边界**：recipe 只为「错误形态会被照抄」投入实现——形态本身是 recipe 教学
价值的一部分（如路径分段路由、指南分页 vs 参考长滚动、移动端抽屉），做到最小示范
即止（一个域示范、其余 stub）；纯属消费端接线知识的（i18n 注入、搜索 excerpt
策略、内容 adapter），写进 `references/` 就停。给其余域补子页、加 TOC、做真实
搜索索引等诉求属于消费项目职责，gallery 一律不接。

## ADR-010：CodeRail 提升进 API Docs kit 并随 registry 分发

**状态：已采纳，2026-07-20。取代 ADR-004。**

`kits/api-docs/components/CodeRail.vue`（`<ApiDocsCodeRail>`）承载 Request / Response 的纵向分配与内容优先重分配，进入 API Docs kit 并作为根 registry 的 `api-docs-code-rail` 切片分发。

**ADR-004 的前提为何不再成立**：重构后 CodeRail 不再耦合页面 chrome——sticky 偏移与视口高长条由消费页的外层容器拥有（组件只 `h-full` 填充）；断点 gate 泛化为 `enabled-from` prop（依赖 foundation 的 breakpoints util）；分栏比持久化经 `storage-key` prop 隔离多实例（默认 `useId()` 实例级隔离，跨刷新持久化才要求显式 key）。它对外只暴露 `#top`/`#bottom` 插槽 + slot scope 下发 `maxHeight` 预算，这是一个可陈述、可跨项目复用的契约。

**为何归 kit 而非 foundation**：量自然高时它耦合本 kit 代码卡的内部 DOM（`.code-surface`、`pre.raw-pre`），这种耦合是 kit 内部事务；foundation 的 `SplitPane`/`useSplitPane` 保持纯空间分割与拖动状态，不含重分配。

**提升的直接动因**：下游要重建同等逻辑（测量、重分配纯函数、RO 循环规避、a11y 把手接线）的成本远高于 copy & adapt 一个 recipe 的预期成本，「让下游照抄」已不成立。这同时校准了「demo 私有 → kit 切片」的提升判断：当组件承载的不是页面装配而是可复用的领域行为时，就该提升。

随本决策同步的权威入口：`SKILL.md` 硬规则、`references/registry.md` 约束 7、`references/gallery.md`、`references/method/component-reflow.md`、`README.md`、`references/kits/api-docs/index.md`。

## 上下文成本纪律

- `SKILL.md` 只保留选择与硬流程，详细契约按需放 `references/`。
- 源码和 fixture 不内联进 references；references 用稳定路径指回真源。
- registry 给 agent 机器可读 inventory，gallery 给人和 browser 看真实渲染。
- 新组件增加现有任务域文档或 kit index，避免“一组件一份碎文档”。
