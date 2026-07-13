# geist-nuxt 架构决策记录（ADR）

> 本文件是架构决策的**理由与历史锚点**（记录"为什么这么定"），防止跨会话丢失上下文。
> **它不是实施依据**——可操作的现状真源在 `SKILL.md` + `references/`（维护纪律见 `maintenance/sync.md`、
> 组件晋升见 `method/component-reflow.md`、gallery 结构与 story 数据见 `gallery.md`）。二者冲突时以后者为准，
> 并回来把本文件对应结论标注为已被取代，避免双活源漂移。

## 0. 背景与目标

要解决两个问题：
1. **控体积**：避免 skill 内容随组件增长撑爆上下文。
2. **跨会话可见性**：新会话设计组件时，怎么看到/复用之前其他会话设计过的组件。

核心判断：**问题 2 不是纯 skill 优化能解决的**，必须结合 v0 的「代码自动部署」+「GitHub 真源」两个特性。skill 承载「规范与索引」，产物（部署的画廊）承载「示例与样子」。

---

## 1. skill 上下文成本模型（已决）

- **吃上下文**：SKILL.md 全文（触发时常驻）+ 被 `Read` 的 references。
- **不吃上下文**：repo 源码（`packages/*`、`starter/`、kit 切片），只在 `Move(copy)` / `Read` 时触碰。
- **控体积三纪律**：
  1. SKILL.md 只做路由器，立行数上限（≈200 行），永不内联源码/长示例。
  2. 新增 kit/组件只加「一行路由 + 一段 kit index + registry 几行」，源码去 repo。
  3. 示例从 references 正文赶出，变成 gallery 里的活代码。

---

## 2. repo 结构 = 方案 B（单 repo 多包）（已落定并执行）

单一 GitHub 真源 `abel-2333-org/geist-nuxt`，内部 workspace 分包：

```
geist-nuxt/
├── packages/
│   ├── core/            公共组件 + token/main.css（@geist-nuxt/core）
│   └── kits/<场景>/     场景增量组件（依赖 core），各带 registry 分片
├── apps/gallery/        聚合画廊（部署，产出一个 URL）
└── starter/             干净脚手架（只依赖 core）
```

- 不走多 repo（方案 C）：多真源治理税太高；B→C 可平滑演进，C→B 是倒退。
- **已决（第一步）**：原地重构 `abel-2333-org/geist-nuxt`（不新开 repo）；pnpm workspace；包名带 scope `@geist-nuxt/*`；kit 收进 `packages/kits/<场景>/`（不根目录平铺，不预设领域层级，kit 间用依赖表达关系）；展示页（index/AppHeader/sections）迁入 `apps/gallery`，starter 变干净空脚手架。
- **已决**：token 共享走**选项一**（main.css 放 `packages/core`，kit 依赖 core 获得）。
- 完整操作蓝图见 `refactor-spec-step1.md`。

### core 放什么 vs references 基础规范怎么放（已决）

两者是一体两面，**不合并、不互相取代**：
- `packages/core`（repo）= **源码资产**：公共组件（CopyButton/SplitPane 等跨场景复用的）、`main.css`（token/紫色 ramp/Geist 覆盖）、公共 composables（useCopy）。
- `references/foundations/**`（skill）= **规范文本**：tokens.md / typography.md / spacing-layout.md 等，**原地不动**。
- 接缝：foundations 文本可**指向** core 的 token 实现，但不把 CSS 源码内联进 md（否则吃上下文又漂移）。
- 变化点：token 实现物理归属从 `starter` 迁到 `packages/core/main.css`。

---

## 3. 跨会话可见性三件套（已决）

三者是同一条数据流上的节点，缺一断链：

```
会话里设计组件
   │
   ├─(晋升工作流,需人工确认)→ 写进真源：kit 组件 + gallery story + registry 一行
   │                                 │
   │                                 ├─→ Living Gallery 自动部署 → 人 & agent-browser 看"样子"
   │                                 └─→ registry ──────────────→ 新会话 agent 读"目录"
   │
   └─(sync 纪律)→ 记忆区与 GitHub 逐字节对齐
```

- **registry**：机器可读目录，新会话读它知道「有什么、别重造」。
- **聚合 gallery**：`apps/gallery`，一个稳定部署 URL；人和 agent-browser 都能看真实渲染。（gallery 路由改用 **Nuxt 文件路由**、导航从路由树自动派生，registry 不再驱动路由——见 `references/gallery.md`。）
- **晋升工作流**：临时产物 → 真源资产。**必须人工确认**（尤其写回真源/team 前）。未晋升 = 下会话看不到，是**预期行为**不是 bug。

---

## 4. skill 分发策略（已决,step2 修订）

- core 走 **npm 公共包**（`@geist-nuxt/core`），skill 不内嵌 core 源码副本；kit 源码随 dist-skill 分发，按 registry 切片 copy-in（不吃上下文）。
- 同步负担已由 CI 消解：dist-skill 是构建产物，记忆区只做整体覆盖（见 `maintenance/sync.md`）。
- gallery 永远只在 skill 里留一个 URL，不复制任何东西。

---

## 5. registry 字段集（已敲定,step2 落地）

以「**切片**」为分发单位,schema 见 `packages/kits/api-docs/registry.json`(权威范例)。核心字段:

- `name / type / title / description`:条目标识
- `files[]`:切片文件清单——**copy-in 时必须整切片拷贝**(组件 + 依赖的 composables/utils 一起),这是「kit 组件依赖 composable 会断」问题的制度化解法
- `registryDependencies`:kit 内条目间依赖(先拷被依赖切片)
- `meta.coreDeps`:声明依赖 core 的组件/composables,消费项目 extends core 天然满足

**依赖方向铁律**:kit→自身(声明进切片)、kit→core;**禁止 kit→kit**,跨 kit 共性一律上提 core。
kit 内新增组件必须同步更新 registry 条目。kit 未来若发包,切片问题自动消失,registry 转为文档用途。

---

## 6. 画廊路由约定（已被取代 → 见 `references/gallery.md`）

> 原方案（per-component 路径 `/gallery/<kit>/<component>` + registry 驱动路由）**已废弃**。
> 现行方案 = Nuxt 文件路由 + 一 kit 一子树 + 按需毕业，导航从路由树自动派生，
> story 数据按路由层级分层（原子=内联假 ViewModel / 页面级=fixture+adapter）。
> 权威描述见 `references/gallery.md`「页面组织」与「Story 数据分层」两节。
> 仍成立的原则：story 覆盖默认态 / 关键交互态 / 明暗双模式 / 窄屏。

---

## 7. spec / adapter / ViewModel 分层（api-docs 范例）（已决，实施中）

铁律：**kit 组件只认 ViewModel，不认识任何私有字段**——像「文案无关」一样做到「数据格式无关」。

| 东西 | 归属 |
|---|---|
| `spec.ts`（私有 DSL 输入契约：EndpointSpec/RawField...） | **留消费项目** |
| `adaptSpec` + `mapField` / `map*Examples` 实现 | **留消费项目** |
| 生命周期→视觉映射表 | **留消费项目** |
| `FieldLifecycle` / `EndpointLifecycle` / `LifecycleStatus` 字面量 type | **留消费项目** |
| `domain.ts` 纯数据（FieldNode/RequestScenario/ResponseScenario/AuthRequirement...） | **进 kit** |
| StatusBadge 的 props 类型（tone/label/icon） | **进 kit** |
| 组件 chrome 文案（Api*Labels） | **进 kit，但归组件**，不混在 domain |

### StatusBadge 取值无关（已决）
- 做成纯视觉原子：只吃 `tone`（neutral|info|warning|danger|success，对齐 Geist token）+ `label`（已本地化）+ 可选 `icon`。**组件内不 switch 生命周期字面量**。
- 生命周期值（new/beta/active/maintenance/deprecated/sunset）→ tone/label/icon 的映射表**留项目**（跟 adapter 和 i18n 走）。理由：这些值是合理建模选择，不是行业铁律，别焊进 kit。
- `FieldNode.lifecycle` 在 kit 用泛化形状（`status: string` 或已解析的 presentation），字面量联合类型留项目。

> 状态：用户已着手改这部分代码。

---

## 8. 落地路线与节奏（已决）

**顺序（按依赖倒序）**：
1. repo 重构成方案 B（层级待讨论）
2. 定 registry schema 并填 api-docs 切片
3. 聚合 gallery + Vercel 部署
4. 晋升 + 同步写进 sync.md / SKILL.md 工作流
5. skill 瘦身（SKILL.md 立上限、示例迁 gallery）

**节奏**：每阶段 = 先讨论定细节 → 用户确认 → 执行 → 回看 → 下一阶段。**非一次性自动跑完**。晋升步骤永远停下来等用户确认。

**执行位置**：纯文本/设计类（registry schema、skill 文本、本 ADR）在记忆区会话边聊边改；repo 重构 + gallery + 部署到真源仓库 `abel-2333-org/geist-nuxt` 的 v0 会话做。

---

## 9. 未决项清单（挂起）

- [x] repo `packages/*` 目录与内容层级（第 2 节）→ 已定，见 `docs/archive/refactor-spec-step1.md`
- [x] core/kit token 共享选项一/二 → 选项一（token 放 core）
- [x] registry 字段集最终定义 → 已敲定（第 5 节,step2 落地）
- [x] gallery story 假 ViewModel 的组织方式 → 已定：按路由层级分层（原子级内联假 ViewModel / 页面级 fixture + gallery 本地 adapter），见 `references/gallery.md`「Story 数据分层」
- [x] kit 是否引入 i18n（`@nuxtjs/i18n` 等）→ **不引入，kit 保持 i18n-agnostic**。i18n 是 app 级关注点，不是组件库级：分发单元是 SLICE（copy-in），组件运行在消费者的 Nuxt 实例里，kit 无法也不应替消费者装/锁定 i18n module；在组件内 `useI18n()` 会给每个 copy-in 组件植入硬依赖，逼纯英文站也装 i18n。正确边界＝所有面向用户的文案都走 `labels` 注入口（英文默认 + 消费者可用自己的 i18n 方案覆盖，`labels` 是响应式 computed，切 locale 自动重渲染）。据此本轮补掉了 `useCopy` 这个唯一没有注入口的例外（见下条「复制 toast 完整消息」）。**遗留待未来评估**：若出现真实多语言下游且逐处传 `labels` 成负担，评估 kit 自有的 `provide/inject` locale provider（仍不绑任何 i18n 库）；触发信号＝首个引入 i18n 的下游项目落地。
- [x] `useCopy` 复制 toast 文案本地化 → **已解决（方案：接受完整消息，而非拼半句 label）**。原 `copy(text, label)` 用 `` `${label} copied to clipboard` `` 拼句：core 拥有半句英文脚手架、调用方拼另半句，导致文案无法整体本地化（中文站 aria 中文 / toast 英文混语）。现 `copy(text, label?, { successMessage? })`：调用方可传**完整**句独占所有权，`useFieldAnchor.copyLink(path, successMessage?)` 透传，`ApiDocsFieldItem` 经其 `labels.linkCopied(fieldName)` 槽拥有整句（与 aria 等 chrome 文案走同一本地化面）。默认仍是英文 Geist voice，`CopyButton`（另一且唯一调用点）不传参、行为零变化。
- [ ] 是否将晋升流程沉淀为独立 skill（如 geist-promote）
- [ ] 是否将部分结论提升到 team scope 共享
- [ ] `ApiDocsFieldItem` 的两个锚点复制按钮（桌面 gutter 悬停版 + 触屏 inline 常显版）markup 近乎重复 → 评估收敛为单个按钮。延后理由：两者定位/显隐逻辑确有差异（`absolute -start-6 … lg:block` vs `ms-auto … lg:hidden`），强行合并需引入条件 class 分支，收益（去重约 10 行模板）低于可读性成本；属纯 nit。触发信号：第三处锚点场景出现，或按钮内部逻辑（aria/图标/复制行为）继续变复杂到重复成本超过合并成本。
- [ ] `ApiDocsFieldItem` 的 `FieldNode` 是 16 字段大扁平 prop 包（`v-bind="child"` 铺开），类型层面不阻止无意义组合（如同时传 `enumValues` 与 `children`，或 `enumValues` + `enumVariants`）→ 评估用判别联合（discriminated union）收紧数据契约。延后理由：改动面大——要重构 `FieldNode` 类型、可能改变 `v-bind` 用法与 adapter 输出形状，属独立重构而非搭便车项；当前宽松契约不产生运行时 bug（组件按存在性优雅降级）。触发信号：真实 adapter 频繁误传导致渲染困惑，或字段形态分化到需要类型层面强约束（如 object/enum/scalar 三态互斥）。
- [ ] `InlineMarkdown` 的 `~~del~~` 目前渲染成裸 `<del>`（唯一绕过 `Prose*` 组件的分支）→ 延后设计 `ProseDel`。理由：Nuxt UI 未内建 `ProseDel`（不像 Code/A/Strong/Em 可复用），补它是一个完整组件设计任务（anatomy → state → a11y + gallery story + registry），不应搭便车进原子 reflow；且删除线为纯文本装饰、无 token/交互态/焦点风险，裸 `<del>` 功能与语义已足够。触发补齐的信号：出现真实消费者（如某 kit 的变更记录/diff 展示需要 Geist 规格的删除线）。
- [x] `Section.vue`（原 registry:block）把 demo 数据硬编码在 kit 包内，违反「数据不进 kit」→ 已解决：该组合外壳仅是两个数据无关积木（CodeBlock + ResponseExample）的 `space-y-8` 叠放，无自身职责，不值得独立成 block。已删除 `Section.vue` 与 registry `api-docs-section` 条目，组合示例 + demo 数据（内联假 ViewModel）并入 gallery 页面 `apps/gallery/app/pages/kits/api-docs/index.vue`；kit 只保留 3 个数据无关积木（code-block / request-example / response-example）

## 10. 当前结构真相(step2 后,唯一权威描述)

```
abel-2333-org/geist-nuxt (唯一真源)
├── packages/core/               # @geist-nuxt/core —— 唯一发 npm 的公共包(Nuxt layer)
│   └── app/components/         # 根:GeistShowcase(公共入口)+ showcase/{Hero,Foundations,Compositions}(自描述展示页,pathPrefix:true 下即 <ShowcaseHero> 等)+ composition/{SignupForm,Feedback,Navigation}(招牌组合)
├── packages/kits/api-docs/      # 场景组件,不发包;registry.json 切片清单(见第 5 节)
├── apps/gallery/                # 常驻画廊,workspace:* 引 core+kits;部署 https://geist-nuxt-gallery.vercel.app
├── starter/                     # 自足项目(非 workspace 成员!),依赖发布版 @geist-nuxt/core
│                                # 首页 = <GeistShowcase />;即 v0 新会话预览
├── SKILL.md / AGENTS.md / README.md / v0.json / references/   # skill 文档层
├── docs/archive/                # 历史 refactor spec 归档
└── .github/workflows/skill.yml  # CI:发包 + lock 生成 + boot 验证 + dist-skill release
```

三个展示面分工:starter 预览(GeistShowcase,仅 core,跟发版走)| gallery(core 全量 + kit demo,workspace 即时)| v0 会话(用户项目 + copy-in 的 kit 切片)。

## 11. 进度

- 第一步(repo 重构 → workspace):**已完成**,规格归档于 `docs/archive/refactor-spec-step1.md`。
- 第二步(发包化与分发链路):**已完成**(2026-07-11),规格归档于 `docs/archive/refactor-spec-step2.md`。要点:core 公开发 npm(org `geist-nuxt`)、starter 移出 workspace 改依赖发布版、GeistShowcase 收编进 core、registry 切片敲定、CI 构建 dist-skill release、记忆区改整体覆盖同步(`references/maintenance/sync.md`)。
- gallery 部署:**已完成**——唯一权威部署 https://geist-nuxt-gallery.vercel.app(push main 自动更新;一个部署服务所有 v0 账号,不另建平行部署)。
- core 组件回流规范:**已完成**——AI 可执行 checklist,见 `references/method/component-reflow.md`(人只拍采纳/推送两个决策)。starter 依赖 core 采用钉死精确版本策略。
- 后续:晋升工作流是否独立成 skill、gallery story 组织方式(第 9 节未决项,按需推进)。
