# 【WIP 草稿·待删】设计系统协作契约

> 本文件是讨论用草稿，边聊边改。契约定稿后，内容会并入正式文档（`SKILL.md` /
> `method/` / `maintenance/`），**本文件随即删除**。不要把它当正式规范引用。

---

## 0. 背景：为什么要这套契约

痛点：改设计系统时，改动发生在预览看不到的地方（`.v0` 真源副本），只能截图/等发版，
用不上 v0 预览的即时性；且在消费者项目里平铺建站，导致"哪些该提交、哪些是临时消费"
分不清。本契约通过**工作区切换 + 分包纪律 + 展示分层**根治这两个问题。

---

## 1. 双区心智（两个物理隔离的地方）

| 区 | 是什么 | 持久性 | 预览渲染 |
|---|---|---|---|
| 项目根 `/vercel/share/v0-project` | 当前是 starter 消费者 | 持久（git） | 是 |
| `.v0/geist-nuxt-repo` | 设计系统真源副本 | 非持久，会被清 | 否 |

**切换目标**：让 chat 工作区 = geist-nuxt 真源本身，预览指向 **gallery app**。
切换后改 `packages/**` → gallery HMR 即时可见；git 直连真源，`.v0` clone/被清问题消失。

> starter 不作废：它是"消费者验收场"（验证装了 core 的新项目开箱即用），
> 继续留在仓库、被 CI 验证、作为新项目模板。只是它不再是我"盯着改"的那块屏。

---

## 2. 即时 push 纪律（防丢失）

- 真正的安全不在"保住 `.v0`"，而在**改动即时 push 到 GitHub**。
- 本地 `git commit` 也在 `.v0` 里，一样会被清 —— **只有 push 才安全**。
- 纪律：**改完一个能独立成立的单元 → 立刻 push**，不攒着过夜。宁可多几个 WIP 提交。

---

## 3. 分包纪律（东西建的时候就落对地方）

**分界线 = registry**：一个文件进 kit/core，当且仅当**某个组件运行时需要它**；
其余（示例数据、演示页、只给 playground 用的 helper/外壳）一律进 gallery app。

| 我写的东西 | 落在哪 | 提交去向 |
|---|---|---|
| 组件源码 | `packages/{core,kits}/.../组件.vue` | 产品（+ registry 条目） |
| 组件公共 API 依赖的类型 | 随组件进 kit/core（切片一部分） | 产品 |
| 组件演示数据 / facet | gallery 的 `<GalleryEntry>` / 组合演示里 | gallery app |
| 仅示例数据用的类型 | gallery 的 `app/types/` | gallery app |
| playground chrome（Header/SplitPane 等外壳） | gallery `app/components/playground/` | gallery app |
| 演示页 / playground 页 | gallery `app/pages/` | gallery app |
| 调试垃圾、临时试验 | `.v0` 草稿区 / 临时文件 | **不提交，丢弃** |

> 核心：kit/core 目录里只放"零件 + 零件对外类型契约"；数据/演示页/外壳一律不进。
> 于是 `git status` 天然按包分组，提交时一目了然，不存在"临时数据混进组件源码"。

---

## 4. 展示模型：多路由 + kit 子树 + 按需毕业

gallery 从**单页竖向堆叠**（`pages/index.vue` 里 Showcase→Catalog→ApiDocsSection）
改为**文件路由**：一个逻辑分组 = 一个路由。粒度不再是结构分类（"该堆哪"的轴消失），
只是"某个视图里 demo 多大"的表现细节。路由树本身就是唯一的一维结构。

**路由结构（目标形态）：**

```plaintext
apps/gallery/app/pages/
  index.vue                    → Overview（Hero + Foundations + 招牌组合）
  components/index.vue         → 原子组件 catalog（现在的六组 <GalleryEntry>）
  compositions/index.vue       → core 组合陈列（SignupForm 等）
  kits/
    api-docs/
      index.vue                → 该 kit 零件总览（原子 + 组合，小 demo）
      reference.vue            → 页面级完整形态（整屏 chrome，SplitPane 分栏）
```

**三条规则（定死）：**

1. **一个 kit 一个子树（方案乙）**：kit 是"一个领域的整套零件"，不是单个组件。
   一个 kit 占一个目录子树，kit 内部再按粒度分——尊重 kit 的内聚（成套可见、成套复制）。
2. **按需毕业**：一个 kit 默认只有 `index.vue`（零件总览）。只有当它出现"页面级形态"
   （需整屏布局/chrome、多区块的成品，如 SplitPane API reference）时，才为那个形态毕业出
   一个兄弟路由（如 `reference.vue`）。没有页面级形态的小 kit 就一页搞定，不强行分。
3. **kit 的原子/组合留在自己子树**：不在全局 `components/`、`compositions/` 路由里重复露出。
   全局那两个路由只放 core 的原子/组合；跨 kit 横向对比不作为目标，避免重复展示成本。

> **原「待核对项」已解决**：kit 的 compositions（如 FieldGroup）陈列在**该 kit 自己的子树**
> （`kits/api-docs/index.vue`），不进全局 compositions 路由。"kit 也可有自己的 compositions"
> 成立，归位方式由上面规则 3 定死。

**导航自动生成（调研已完成，结论如下）**：AppHeader 导航从 `pages/` 路由树自动派生——
加一个页面文件 = 自动多一个导航项，不可能忘。

- **数据源**：gallery 本地 composable `useGalleryNav()`，用 `useRouter().getRoutes()` 拿全部路由记录，
  过滤掉动态路由（含 `:`）与显式 `nav: false` 的隐藏页（如保留但不展示的 playground），
  按 `path` 段折叠成 `components/` `compositions/` `kits/<name>/` 的嵌套结构。
- **每页声明**：可选 `definePageMeta({ nav: { label, icon, order } })`。静态 meta 构建期并入路由记录，
  运行时直接读；缺省则从 path 兜底派生 label。**排序必须用 `meta.nav.order`**——`getRoutes()` 顺序不保证。
- **渲染**：用 `UNavigationMenu`（items 为 `ArrayOrNested<NavigationMenuItem>`，
  支持 `type: 'label' | 'trigger' | 'link'`、`icon`、`badge`、`children` 嵌套），
  目录层级天然映射为 kit 子树的 `children`。
- **§4 兼容**：`kits/api-docs/reference.vue` 出现即自动成为 `api-docs` 子树下的兄弟项；
  删文件则导航项自动消失（呼应 §5 playground 删除即无残留）。**不依赖 @nuxt/content**。

**移动端方案（调研已完成，结论如下）**：直接采用 Nuxt UI v4 内建的 **`UHeader`（Pro 已合入公共包）**，
移动端抽屉是**开箱能力，不手写**。核对 `@nuxt/ui` 的 `theme/header.ts` 断点行为：

- `center` slot（放桌面导航）= `hidden lg:flex`（仅 ≥lg 显示）；
- `toggle`（汉堡按钮）= `lg:hidden`，自动切 menu/close 图标；
- 移动浮层（`content`/`overlay`）= `lg:hidden`；`root` 已是 `bg-default/75 backdrop-blur border-b sticky top-0`（Geist 观感）。
- `UHeader` 的 `mode` 支持 `'slideover' | 'drawer' | 'modal'`——§4 提到的 USlideover 抽屉即 `mode="slideover"`；
  `autoClose`（默认开）在路由变化时自动收起。
- **一份数据源两处渲染**：桌面导航放 `center` slot 的 `UNavigationMenu`；移动端把同一份 `useGalleryNav()` items
  以 `orientation="vertical"` 的 `UNavigationMenu` 放进 `#body` slot。
- 与现状差异：当前 `AppHeader` 是手写 `<header>`，迁到 `UHeader` 断点为 `lg`、高度用 `--ui-header-height`；观感一致。
- 符合 design system 硬规则「响应式用 Nuxt UI 的方式（UContainer / UPage* / UHeader + 断点）」。

> **playground 处置是"提升"动作的强制收尾**，并进 push 前清单（见 §5、§6）；
> 多路由下，删 `pages/playground.vue` = 导航项自动消失，无残留。

---

## 5. playground 生命周期（开发脚手架，阶段性）

| 阶段 | playground 角色 |
|---|---|
| 开发中 | **主力**。建 `pages/playground.vue`（独立草稿路由，**不碰正式页**），
  用 chrome + 示例数据摆出在改的组件，预览切 `/playground` 看 HMR 即时刷新 |
| 定稿后 | **退场**。有价值的演示提升进正式路由（如 `api-docs.vue`）；
  纯脚手架部分删除。若想留作调试页，则**不进导航**（隐藏） |

- 名字就叫 `playground`。核心是"草稿页 ≠ 正式页，各占各的路由"，开发不弄脏已发布的正式页。
- 提升是 copy，易忘删 → 所以"删除/降级 playground"是提升动作的**强制收尾步骤**。

---

## 6. push 前清单（每次推送必做）

1. `git status` 列出全部改动；
2. 我逐个说明"为什么进"：产品(kit/core+registry) / gallery 展示 / 文档 / **playground 处置**；
3. 任何我自己都说不清"为什么进"的 → 该丢，不提交；
4. 你审这份清单 → 授权 → push。

---

## 6.5 git 连接方式（已定：方案 B）

**决策：chat 连接仓库 + push 前确认（方案 B）。**

- chat 连接到 GitHub 仓库 `abel-2333-org/geist-nuxt`（v0 设置→Git），改动同步到分支，
  可用 v0 原生 Git 面板（看活动 / 拉取 / PR）；
- push 仍**每次经你确认**——保留 §6 的 push 前清单纪律，不放弃逐次审；
- 好处：v0 直接以仓库为工作区，从根上缓解 `.v0` 被清、反复手动 clone 的不便。

> 排除项：方案 A（手动 clone + 即时 push）是保底，但没解决 `.v0` 被清的根本不便；
> 方案 C（连接 + 自动同步、不逐次确认）与 §6"push 前给清单"冲突，不采用。
> 前提：连接动作需你在 v0 界面操作（设置→Git），我无法替你连。

---

## 7. 一次新会话的完整链路（以你截图那套 reference 组件为例）

1. 「设计一个 API 字段介绍组件」→ 组件建进 kit `packages/kits/api-docs/app/components/api-docs/`
   （Convention C，`<ApiDocs*>`）；
2. gallery 建 `pages/playground.vue`，用 chrome + `txn-payment.spec.json` 摆出来
   → 预览 `/playground` 实时看、反复调；
3. 定稿 → 演示提升进 `pages/kits/api-docs/reference.vue`（页面级形态，自动进导航）；
   playground 临时件删除；
4. 提交：kit 组件 + registry / gallery 的 api-docs 路由 + fixture / 丢弃 playground 临时件
   —— 三类清单给你审；
5. push 后 CI 发版 + 同步记忆区。gallery 导航自动从路由树生成：
   `/`(Overview) + `/components`(catalog) + `/compositions`(core 组合)
   + `/kits/api-docs`(零件总览) + `/kits/api-docs/reference`(页面级)，所有组件可见。

---

## 8. 落盘目标（已定：折进现有文件，不新增文档）

契约定稿后各节的归宿。**执行时机**：待 §4 导航调研完成后一次性搬迁，随后删除本 WIP。

| 契约节 | 落盘去向 | 说明 |
|---|---|---|
| §1 双区心智 | **`maintenance/sync.md`**（并入「改动方向」段） | 维护者纪律，消费对象=维护 skill 的人，不进每次建 UI 都读的 SKILL.md |
| §2 即时 push | **`maintenance/sync.md`** | 同上，push 纪律属维护流程 |
| §3 分包 / registry 边界 | **已固化在 `SKILL.md`**（第 20/22/23 行），契约不重复 | 只在契约留指针，避免漂移 |
| §4 多路由展示模型 | **`references/gallery.md`** | gallery 结构知识；随导航调研落地一并写 |
| §5 playground 生命周期 | **`method/component-reflow.md`** 补一段 | 它是「提升/回流」工作流的收尾环节 |
| §6 push 前清单 | **`maintenance/sync.md`** | 维护者操作纪律 |
| §6.5 git 连接方式（B） | **`maintenance/sync.md`** | 与「改动方向：只在真源改」同段，说明 chat 连接 + push 确认 |
| §7 完整链路 | **`maintenance/sync.md`** 或 `method/`，作为端到端示例 | 定稿搬迁时二选一，倾向 sync.md 收尾处 |

> **不新增文件**：maintenance 类内容全部折进现有 `maintenance/sync.md`（sync.md 会变长、
> 职责从「同步机制」扩为「同步机制 + 协作纪律」，可接受）。符合「不盲目新增文档」原则。

---

## 待办 / 未决

- [x] §4 待核对项：kit compositions 陈列位置 → 定为 kit 自己子树（`kits/api-docs/index.vue`），见 §4 规则 3
- [x] git 连接方式 → 方案 B（chat 连接仓库 + push 前确认），见 §6.5
- [x] 落盘目标 → 折进现有 `maintenance/sync.md`（不新增文档），见 §8 映射表
- [x] §4 导航自动生成 + 移动端方案（专项调研）→ 已定：`useGalleryNav()`（`getRoutes()` + `definePageMeta({ nav })`）
      派生导航；移动端用 `UHeader mode="slideover"` 内建抽屉。见 §4 结论
- [ ] 待落盘 → 按 §8 一次性搬迁（§4 结论写进 `references/gallery.md`；维护类节写进 `maintenance/sync.md`）并删除本 WIP
