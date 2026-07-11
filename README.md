# geist-nuxt

Geist 风格设计系统:视觉参考 Vercel Geist,组件基座 Nuxt UI v4 (Vue),方法论参考 Adobe Spectrum。
本仓库是**唯一真源**,产出两个分发物,均由 CI 构建,**不靠手抄**:

1. **npm 公共包 [`@geist-nuxt/core`](https://www.npmjs.com/package/@geist-nuxt/core)** — 基座 Nuxt layer(token、字体、明暗模式、公共组件、GeistShowcase 展示页)
2. **v0 skill 分发物(`skill-v*` release)** — 文档 + 自足 starter,供 v0 记忆区整体覆盖同步

> 目录结构与决策依据**只写在一处**:`references/architecture-decisions.md`。本文件不复述结构,只讲怎么用。

## 消费方式

### 新项目(从 starter 起步)

```bash
# starter 是自足项目:依赖发布版 @geist-nuxt/core,不依赖本仓库其他内容
cp -r starter my-app && cd my-app
pnpm install
pnpm dev
```

首页默认渲染 `<GeistShowcase />`(设计系统自描述展示页)。做自己的应用时替换 `app/pages/index.vue` 即可。

### 已有 Nuxt 项目

```bash
pnpm add @geist-nuxt/core
```

```ts
// nuxt.config.ts
export default defineNuxtConfig({
  extends: ['@geist-nuxt/core'],
  modules: ['@nuxt/ui'],
})
```

### 场景组件(kits,不发包)

按 kit 的 `packages/kits/<场景>/registry.json` **整切片 copy-in**:把条目 `files` 列的所有文件一起拷进项目。规则见 registry 文件内 description。

## 开发(本仓库内)

```bash
pnpm install        # workspace: packages/core + packages/kits/* + apps/gallery
pnpm dev            # 起 gallery(改 core/kit 即时热更,workspace:* 引用)
pnpm dev:starter    # 起 starter(注意:装的是发布版 core,不反映未发版改动)
pnpm -r typecheck && pnpm -r build
```

**gallery**(`apps/gallery`)是常驻画廊,唯一权威部署:**https://geist-nuxt-gallery.vercel.app**(Vercel root directory = `apps/gallery`,push main 自动更新)。一个部署服务所有 v0 账号,不要为其它账号另建平行部署——那只会重复消耗构建额度、造成画廊脑裂。

## 发版与分发(CI:`.github/workflows/skill.yml`)

1. bump `packages/core/package.json` 的 `version` → push main
2. CI 自动:发包(版本未发布时)→ 生成 starter lockfile → **真实 install + build 验证**(v0 预览必能跑的机械保证)→ 组装 dist-skill → 打 `skill-v*` release
3. core 发版后 bump `starter/package.json` 里的 `@geist-nuxt/core` 版本

需要 GitHub secret `NPM_TOKEN`(npm granular token,对 `@geist-nuxt` scope 有 read-write)。发包失败报 401/403 = token 过期或权限不足。

## 多入口接线

- **v0**:记忆区 skill 从 `skill-v*` release 整体覆盖同步(流程见 `references/maintenance/sync.md`)
- **Claude Code**:submodule 或 clone 本仓库后,软链到 `.claude/skills/geist-nuxt/`(SKILL.md 原生被发现)
- **Codex**:读根 `AGENTS.md`;作为 submodule 时在宿主项目根 AGENTS.md 加指针指向本仓库路径

**铁律:只在本仓库改。** v0 记忆区、消费项目里的拷贝都是下游,绝不反向同步。

## 工程纪律(摘要,详见 SKILL.md 与 ADR)

- 新增**通用**组件 → 进 `packages/core` + 在 `ShowcaseComponents` 加展示条目 → 发版后所有消费端预览自动带上
- 新增**场景**组件 → 进对应 `packages/kits/<场景>` + 更新其 `registry.json` 切片 + gallery 加 demo
- 依赖方向:kit→自身、kit→core;**禁止 kit→kit**(共性上提 core)
- starter 永远依赖**发布版** core,不用 `workspace:*`
