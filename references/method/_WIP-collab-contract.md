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

## 4. 展示三档模型（catalog / compositions / pages）

粒度分三档，每档都有既定归宿：

| 粒度 | 例子 | 展示位 |
|---|---|---|
| **原子组件** | UButton、MethodBadge、InlineCode | **catalog**：`pages/index.vue` 逐个 `<GalleryEntry>`，带 facet |
| **组合 composition** | FieldGroup（=FieldItem+Badge+Code）、SignupForm | **compositions 层**（见下方待核对项） |
| **页面级成品** | 完整 API reference 文档页 | **独立路由** `pages/xxx.vue` + 导航入口 |

**三条补丁（review 后加入，防碎片化 / 孤儿路由 / 重复漂移）：**

1. **中间态归 compositions**：比原子大、比页面小的组合件，放 compositions 层，
   不塞 catalog、不为它单开路由。新路由**只**留给"页面级、多区块、有布局的成品形态"。
2. **导航自动生成**：AppHeader 导航从 `pages/` 路由自动生成（不手工维护），
   "加页面"与"加入口"合并为一件事。→ 需专项调研（Nuxt 文件路由 meta + Nuxt UI 导航组件；
   入口变多要分组；移动端收进抽屉/USlideover）。**押后到契约定稿再做。**
3. **playground 处置是"提升"动作的强制收尾**，并进 push 前清单（见 §5、§6）。

> **待核对项（写正式文档前需查 gallery 现有结构再定）**：
> compositions 目前是 core 概念（`composition/` + showcase 的 `Compositions.vue`）。
> 但 FieldGroup 属于 kit(api-docs)。需明确 **kit 也可有自己的 compositions**，
> 以及 gallery 里"core compositions"与"kit compositions"各陈列在哪个位置/路由。

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

## 7. 一次新会话的完整链路（以你截图那套 reference 组件为例）

1. 「设计一个 API 字段介绍组件」→ 组件建进 kit `packages/kits/api-docs/app/components/api-docs/`
   （Convention C，`<ApiDocs*>`）；
2. gallery 建 `pages/playground.vue`，用 chrome + `txn-payment.spec.json` 摆出来
   → 预览 `/playground` 实时看、反复调；
3. 定稿 → 演示提升进 `pages/api-docs.vue`（正式形态，自动进导航）；playground 临时件删除；
4. 提交：kit 组件 + registry / gallery 的 api-docs page + fixture / 丢弃 playground 临时件
   —— 三类清单给你审；
5. push 后 CI 发版 + 同步记忆区。gallery 展示 `/`(catalog) + `/api-docs`(reference) + compositions，
   导航切换，所有组件可见。

---

## 待办 / 未决

- [ ] §4 待核对项：kit compositions 在 gallery 的陈列位置（需查 gallery 现有结构）
- [ ] §4 补丁2：导航自动生成 + 移动端方案（专项调研，契约定稿后）
- [ ] 落盘目标：本契约各节并入哪个正式文件（SKILL.md / method/ / maintenance/）
- [ ] 工作区切换的具体执行步骤（git 连接方式：问题3，尚未定）
