# geist-nuxt 架构决策记录（ADR）

> 本文件是一次架构讨论的结论锚点，防止跨会话丢失上下文。记录「已决 / 待定」两类，实施时以此为准，落定后回来更新。

## 0. 背景与目标

要解决两个问题：
1. **控体积**：避免 skill 内容随组件增长撑爆上下文。
2. **跨会话可见性**：新会话设计组件时，怎么看到/复用之前其他会话设计过的组件。

核心判断：**问题 2 不是纯 skill 优化能解决的**，必须结合 v0 的「代码自动部署」+「GitHub 真源」两个特性。skill 承载「规范与索引」，产物（部署的画廊）承载「示例与样子」。

---

## 1. skill 上下文成本模型（已决）

- **吃上下文**：SKILL.md 全文（触发时常驻）+ 被 `Read` 的 references。
- **不吃上下文**：`assets/**` 源码，只在 `Move(copy)` / `Read` 时触碰。
- **控体积三纪律**：
  1. SKILL.md 只做路由器，立行数上限（≈200 行），永不内联源码/长示例。
  2. 新增 kit/组件只加「一行路由 + 一段 kit index + registry 几行」，源码去 repo/assets。
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
- **聚合 gallery**：`apps/gallery`，一个稳定部署 URL；人和 agent-browser 都能看真实渲染；registry 驱动路由生成（一处登记多一页）。
- **晋升工作流**：临时产物 → 真源资产。**必须人工确认**（尤其写回真源/team 前）。未晋升 = 下会话看不到，是**预期行为**不是 bug。

---

## 4. skill 内嵌策略（已决）

- **全 kit 内嵌** assets（不吃上下文），repo 是真源、skill `assets/` 是镜像。
- 代价是同步负担 → 写进 sync.md，建议半自动脚本。
- gallery 永远只在 skill 里留一个 URL，不复制任何东西。

---

## 5. registry 字段集（草案，待 repo 定型后敲定）

现在**只记草案**，因为字段依赖 repo 目录层级（第 2 节待定）。repo 重构后再定死，避免返工。

草案字段：`name / kit / summary / sourcePath / galleryPath / status(stable|draft|deprecated) / specLevel(full|light) / kind(component|adapter|model)`

- 主从关系：repo 里各 kit 带分片 `registry.json`（源头，权威）→ 聚合出 skill 侧镜像 `references/components/registry.json`（缓存，供新会话快速读）。

---

## 6. 画廊路由约定（已决）

- `/gallery/<kit>/<component>`，kebab-case（如 `/gallery/api-docs/code-block`）。
- story 用**假 ViewModel**（内联假数据），不依赖真 spec，保证自包含 + 截图稳定。
- 每条 story 覆盖：默认态 / 关键交互态 / 明暗双模式 / 窄屏。

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
2. 定 registry schema 并填 api-docs 分片
3. 聚合 gallery + Vercel 部署
4. 晋升 + 同步写进 sync.md / SKILL.md 工作流
5. skill 瘦身（SKILL.md 立上限、示例迁 gallery）

**节奏**：每阶段 = 先讨论定细节 → 用户确认 → 执行 → 回看 → 下一阶段。**非一次性自动跑完**。晋升步骤永远停下来等用户确认。

**执行位置**：纯文本/设计类（registry schema、skill 文本、本 ADR）在记忆区会话边聊边改；repo 重构 + gallery + 部署到真源仓库 `abel-2333-org/geist-nuxt` 的 v0 会话做。

---

## 9. 未决项清单（挂起）

- [x] repo `packages/*` 目录与内容层级（第 2 节）→ 已定，见 `refactor-spec-step1.md`
- [x] core/kit token 共享选项一/二 → 选项一（token 放 core）
- [ ] registry 字段集最终定义（第 5 节草案 → repo 定型后敲定）
- [ ] gallery story 假 ViewModel 的组织方式
- [ ] 是否将晋升流程沉淀为独立 skill（如 geist-promote）
- [ ] 是否将部分结论提升到 team scope 共享

## 10. 进度

- 第一步（repo 重构）：**已执行并推到真源 `abel-2333-org/geist-nuxt` main**。原地重构为 pnpm workspace（`packages/core` + `packages/kits/api-docs` + `apps/gallery` + 干净 `starter`），根目录 `pnpm -r typecheck` / `pnpm -r build` 均通过，gallery 预览正常（含 ApiDocsSection）。旧 `assets/` 单体镜像已从 main 删除，workspace 直接落在 repo 根目录（= skill 真源与 workspace 合一）。规格见 `refactor-spec-step1.md`。
- 下一步：第二步——定 registry schema 并填 `packages/kits/api-docs/registry.json` 分片（见第 5 节草案）。
- 其余步骤按第 8 节路线推进。
