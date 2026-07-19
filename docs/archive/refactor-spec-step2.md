# Refactor Spec — Step 2:发包化与分发链路重构

> [!WARNING]
> **已废弃（superseded）**：本文记录旧 npm / Nuxt layer / starter 分发方案，仅供历史追溯。现行 Source-first 架构以根 `SKILL.md`、`references/architecture-decisions.md` 与 `references/registry.md` 为准，请勿按本文执行。

> 用途:geist-nuxt 的第二步重构蓝图,在真源 `abel-2333-org/geist-nuxt` 上执行。
> 前置:step1(workspace 化)已完成并推送 main。本 spec 经 2026-07 与维护者的完整讨论定稿。
> 状态:**待执行**。执行完成后在文末「进度」打勾,并按第 8 节重写文档、按第 9 节切换同步流程。

## 0. 一句话目标

**消灭手抄本。** v0 消费的 starter 从「core 的手工复制体」变成「core 的一行 npm 依赖」,skill 分发物由 CI 构建产出,记忆区退化为纯下游整体覆盖,不再逐文件对账。

## 1. 背景:step1 留下的分叉

step1 只重构了真源代码 + SKILL.md,留下三处未收尾:

1. 记忆区实际文件仍是旧 `assets/` 单体布局(`assets/starter`、`assets/kits`)
2. README / AGENTS 正文仍描述 `assets/` 布局
3. 真源的 `v0.json` 指向 `assets/starter`,但真源已删除 `assets/` —— 从真源重新导入 skill 会导致新会话预览断裂(真 bug)

根因:记忆区 `assets/` 是靠人肉对账维持的第二份手抄本,必然漂移。本 spec 从机制上根治。

## 2. 核心决策(已定稿)

| # | 决策 | 说明 |
|---|---|---|
| D1 | **core 公开发 npm,包名 `@geist-nuxt/core`** | npm org `geist-nuxt` 已注册(2026-07-11)。与 workspace 现有包名一致,`extends` 写法不变 |
| D2 | **starter 永远依赖发布版 core** | `"@geist-nuxt/core": "^x.y.z"`,不用 `workspace:*`。starter 源码即分发物,无 templates 抽象、无依赖改写脚本 |
| D3 | **gallery 保持 `workspace:*` 引 core 与 kits** | 仓库内即时迭代反馈由 gallery 独家承担 |
| D4 | **kits 不发包,保持 copy-in** | 以 registry 切片为分发单位(见第 6 节)。触发发包的信号:出现第 2-3 个 kit 或同一 kit 被多个真实项目消费 |
| D5 | **GeistShowcase 收编进 core** | 展示页成为 core 的自描述组件,starter 首页只渲染 `<GeistShowcase />`,新组件进 core 发版后所有账号新会话预览自动带上 |
| D6 | **CI 构建 dist-skill 并打 tag** | 不写自定义构建脚本,用普通 GitHub Action steps(见第 7 节) |
| D7 | **发布流程用裸 `pnpm publish`** | 不上 changesets/semantic-release,包多了再考虑 |
| D8 | **记忆区同步 = 整体覆盖 dist-skill + 核对 tag** | 替代 step1 时代的逐文件 gh api 对账(见第 9 节) |

## 3. 目标结构

```
abel-2333-org/geist-nuxt (唯一真源)
├── packages/core/               # @geist-nuxt/core —— 唯一发 npm 的包
│   └── app/components/GeistShowcase.vue   # 新增:收编现 starter 的 sections/*
├── packages/kits/api-docs/      # 不发包;含 registry.json 切片清单
├── apps/gallery/                # workspace:*;部署到 Vercel 作为常驻画廊
├── starter/                     # 依赖发布版 core;源码即分发物;首页 = <GeistShowcase />
├── skill/                       # SKILL.md、references/、v0.json(文档层,不含代码快照)
├── docs/archive/                # refactor-spec-step1.md 等历史蓝图归档
└── .github/workflows/skill.yml  # 发包 + lock 生成 + boot 验证 + dist-skill 组装 + tag
```

## 4. core 发包改造

`packages/core/package.json` 要求:
- `"name": "@geist-nuxt/core"`(不变)、语义化 `version`(首发建议 `1.0.0`)
- `files` 只含 layer 运行所需(`app/`、`nuxt.config.ts` 等),不带测试/开发文件
- core 是「源码即可用」的 Nuxt layer,无构建产物,`pnpm publish --access public` 直接发
- 首次发布验证:公开 registry 可见、干净目录 `pnpm add @geist-nuxt/core` 可装、`extends` 生效

**GeistShowcase(D5)**:把现 starter 的 `HeroSection` / `FoundationsSection` / `ComponentsSection` 收编为 core 内的 `GeistShowcase.vue`(可保留内部子组件拆分)。**工程纪律:core 新增通用组件时,同步在 GeistShowcase 加展示条目**——这是「新组件自动出现在所有账号新会话预览」的前提。

## 5. starter 改造

- `package.json`:依赖 `nuxt`、`@nuxt/ui`、`"@geist-nuxt/core": "^1.0.0"`;删除所有从 core 复制来的组件/composables/CSS
- `nuxt.config.ts`:`extends: ['@geist-nuxt/core']`(写法不变,解析目标从 workspace 变为 node_modules)
- `app/pages/index.vue` 只渲染 `<GeistShowcase />`
- `pnpm-lock.yaml` **由 CI 生成**(`pnpm install --lockfile-only`),不手写、不手抄
- core 发版后 bump starter 依赖版本号(可配 Renovate/dependabot 自动化)

**组件回流边界(维护者已确认,不设自动化约定)**:v0 会话里设计的组件原型只存在于该会话项目;要成为系统组件,须人工收编进 `packages/core` + 补 GeistShowcase 条目 + 发版。这道人工闸门是有意保留的采纳关口。

## 6. kit registry 切片规则

kit 组件常依赖 composable/util(如 `CodeBlock` → `useCodeWrap`),单文件 copy-in 会断依赖。规则:

1. **每个 kit 维护 `registry.json`,以「切片」为分发单位**:
```jsonc
{
  "items": [
    {
      "name": "code-block",
      "files": ["components/CodeBlock.vue", "composables/useCodeWrap.ts"],
      "coreDeps": ["useCopy"]           // 声明依赖 core;消费项目 extends core 必然满足
    },
    { "name": "request-example", "files": ["components/RequestExample.vue"], "registryDeps": ["code-block"] }
  ]
}
```
2. **kit 内新增组件必须同步更新 registry 条目**,把依赖的 composables/utils 列进 `files`
3. **依赖方向只允许两种**:kit → 自身内部(声明进切片)、kit → core(天然满足);**禁止 kit → kit**,跨 kit 共性一律上提 core
4. v0 会话使用 kit 组件时按 registry 条目**整切片 copy-in**(组件 + composables 一次到位,落 `app/components/` 与 `app/composables/`)
5. gallery 不受影响(extends workspace 源码,依赖天然完整);kit 未来若发包,切片问题自动消失,registry 转为文档用途

**kit 组件的 gallery 流程**(与 core 的不对称是有意的):kit 改动经 `workspace:*` 即时进 gallery,无发版环节——落地组件 → gallery 加展示(小块进首页 section,整屏装配如 ApiDocsSection 单独开 page)→ 明暗/响应式验证 → push main 自动部署。

## 7. CI(`.github/workflows/skill.yml`)

不写自定义构建脚本,普通 steps 完成:

1. **发包**(触发:core 版本变更或手动):`pnpm publish --access public`(用 secret `NPM_TOKEN`,Automation 类型)
2. **lock 生成**:`cd starter && pnpm install --lockfile-only`
3. **boot 验证**:starter 真实 `pnpm install && pnpm build` —— 这是「v0 预览必能跑」的唯一机械保证,**不可省**
4. **组装**:`skill/` + `starter/`(含新 lock)→ `dist-skill/`,其中 `v0.json` 的 `starter.path` 指向组装后的 starter 目录
5. **打 tag**(如 `skill-v20260711`),tag 即分发版本

## 8. 文档重写(单一职责,合并 step1 遗留清理)

维护者已认可:step1 遗留的文档清理不单独执行,合并进本节。

- **结构真相只写一处**:`references/architecture-decisions.md`(或新 `architecture.md`),其余文档只放指针
- **README** = 人类入口(是什么、怎么跑 gallery、怎么消费 starter);**AGENTS** = 非 v0 agent 接线说明;**SKILL.md** = v0 运行时路由 —— 三者不再各自复述目录结构,消灭旧 `assets/` 死路径
- `references/refactor-spec-step1.md` 归档至 `docs/archive/`(本文件执行完亦归档)
- 根 `package.json` 删除与 `dev` 重复的 `dev:gallery` 别名
- 重写 `references/maintenance/sync.md` 为第 9 节的新流程

## 9. 新同步流程(替代逐文件对账)

1. 真源 CI 产出 `dist-skill/` 并打 tag
2. 各 v0 账号同步 = **用 tag 对应的 dist-skill 整体覆盖记忆区 skill 目录**(不做逐文件判断)
3. SKILL.md 内记录当前 tag 号,会话开头可对 tag 判断记忆区是否过时
4. 多账号一致性由「同一 tag + 同一 npm 版本 + lockfile」机械保证

## 10. 三个展示面的分工(定稿)

| 展示面 | 内容 | 更新机制 |
|---|---|---|
| starter 预览(GeistShowcase) | 仅 core:通用件 + foundations | 跟 core 发版走,starter 零改动 |
| gallery(Vercel 常驻) | core 全量 + 各 kit 场景 demo | workspace 即时,push main 自动部署 |
| v0 会话 | 用户项目自身 + 按需 copy-in 的 kit 切片 | 会话本地 |

## 11. 验证清单(执行后逐项过)

- [ ] `@geist-nuxt/core` 公开可装,干净项目 `extends` 后组件/CSS/composables 生效
- [ ] starter 无任何 core 复制体文件;`pnpm install && pnpm dev` 一次成功
- [ ] 新会话预览渲染 GeistShowcase,明暗两模式正常
- [ ] core 加一个测试组件 → 发版 → bump starter → 新拷 starter 预览自动出现该组件(D5 链路验证)
- [ ] kit 切片按 registry copy-in 后无缺依赖报错
- [ ] gallery 在 Vercel 部署成功,含 api-docs demo 页
- [ ] CI 全链路绿:publish → lock → boot 验证 → dist-skill → tag
- [ ] 记忆区整体覆盖后,`v0.json` starter.path 指向新布局且 ApplyV0SkillConfig 成功
- [ ] README/AGENTS/SKILL.md 无 `assets/` 死路径,结构描述只在一处

## 12. 执行顺序

1. 维护者:npm org `geist-nuxt` ✅(2026-07-11 已建)→ 生成 Automation token → 存 GitHub secret `NPM_TOKEN`
2. core 整理 package.json + GeistShowcase 落地 → 首发 `1.0.0`
3. starter 瘦身改造 + registry.json 落地
4. CI workflow 上线,跑通全链路,打首个 tag
5. 文档重写 + 归档(第 8 节)
6. 记忆区整体覆盖切换(第 9 节),验证新会话预览

## 进度

- [x] 决策定稿(2026-07-11,含 npm scope 确认)
- [ ] 步骤 1:NPM_TOKEN 入 GitHub secret
- [ ] 步骤 2-4:仓库改造与首发
- [ ] 步骤 5:文档重写
- [ ] 步骤 6:记忆区切换
> **Superseded（2026-07-18）**：本文记录旧的 npm core / Nuxt layer / standalone starter / kit registry 分发历史，仅供追溯。现行架构使用根 gallery + `foundation/` + `kits/` + 根 `registry.json` + 可运行 dist snapshot；权威规则见 `SKILL.md`、`references/architecture-decisions.md` 与 `references/registry.md`。不要按本文执行。
