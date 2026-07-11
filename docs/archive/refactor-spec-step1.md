# 第一步：repo 重构规格（方案 B｜可执行蓝图）

> 用途：在真源仓库 `abel-2333-org/geist-nuxt` 的 v0 会话里照此执行重构。
> 本文件是「怎么改」的操作规格；「为什么这么改」见 `architecture-decisions.md`。
> 执行位置：**真源 repo 会话**（原地重构，不新开 repo）。改完在 repo 侧 `pnpm install && pnpm build` 验证通过，再按 `maintenance/sync.md` 同步回 skill assets。

## 0. 已定的全部决定（第一步）

- **原地重构** `abel-2333-org/geist-nuxt`，不新开 repo（无改名、无历史包袱诉求）。
- **workspace 工具**：pnpm（沿用现有 pnpm-lock）。
- **包命名**：带 scope `@geist-nuxt/*`（内部包一眼可辨 + 未来发布无裸名冲突）。
- **kit 收纳**：`packages/kits/<场景>/`，不在根目录平铺 `kit-*`；kit 间默认全平级、不预设领域层级；kit 间关系用 package 依赖表达，不用目录嵌套。
- **token 共享**：选项一 —— token（main.css）放 `packages/core`，kit 依赖 core 自动获得。
- **展示页归属**：`index.vue` + `AppHeader.vue` + `sections/*` → 迁入 `apps/gallery`（它们是画廊雏形）；`starter` 变成干净空脚手架。

## 1. 目标目录结构

```
geist-nuxt/                          (原地重构，单一真源)
├── pnpm-workspace.yaml              新增：packages: ['packages/*','packages/kits/*','apps/*','starter']
├── package.json                     根 workspace（private，装 devDeps/脚本）
├── packages/
│   └── core/                        @geist-nuxt/core
│       ├── package.json
│       ├── assets/css/main.css      ← 从 starter 迁入（token/紫色 ramp/Geist 覆盖）
│       ├── components/
│       │   ├── CopyButton.vue
│       │   ├── SplitPane.vue
│       │   ├── SplitPaneHandle.vue
│       │   └── ThemeToggle.vue
│       └── composables/
│           ├── useCopy.ts
│           └── useSplitPane.ts
├── packages/kits/
│   └── api-docs/                    @geist-nuxt/kit-api-docs（依赖 @geist-nuxt/core）
│       ├── package.json
│       ├── components/
│       │   ├── CodeBlock.vue
│       │   ├── RequestExample.vue
│       │   ├── ResponseExample.vue
│       │   └── ApiDocsSection.vue
│       ├── composables/
│       │   └── useCodeWrap.ts
│       └── registry.json            ← 第二步再填（现在可留空骨架）
├── apps/
│   └── gallery/                     @geist-nuxt/gallery（依赖 core + 各 kit）
│       ├── package.json
│       ├── nuxt.config.ts
│       ├── app/
│       │   ├── app.vue              UApp provider（从 starter 复制）
│       │   ├── pages/index.vue      ← 从 starter 迁入
│       │   ├── components/AppHeader.vue
│       │   └── components/sections/{HeroSection,FoundationsSection,ComponentsSection}.vue
│       └── public/favicon.svg
└── starter/                         干净脚手架（只依赖 @geist-nuxt/core）
    ├── package.json
    ├── nuxt.config.ts
    ├── app.config.ts
    ├── tsconfig.json
    ├── app/app.vue                  UApp provider
    ├── app/pages/index.vue          空首页（占位，不含 showcase）
    └── public/favicon.svg
```

## 2. 文件迁移映射（从现 starter → 新结构）

| 现文件（skill assets 当前位置） | 去向 |
|---|---|
| `app/assets/css/main.css` | `packages/core/assets/css/main.css` |
| `CopyButton.vue` | `packages/core/components/` |
| `SplitPane.vue` / `SplitPaneHandle.vue` | `packages/core/components/` |
| `ThemeToggle.vue` | `packages/core/components/` |
| `useCopy.ts` / `useSplitPane.ts` | `packages/core/composables/` |
| `CodeBlock.vue` / `RequestExample.vue` / `ResponseExample.vue` / `ApiDocsSection.vue` | `packages/kits/api-docs/components/` |
| `useCodeWrap.ts` | `packages/kits/api-docs/composables/` |
| `app/pages/index.vue` | `apps/gallery/app/pages/index.vue` |
| `AppHeader.vue` | `apps/gallery/app/components/` |
| `sections/{Hero,Foundations,Components}Section.vue` | `apps/gallery/app/components/sections/` |
| `app.vue` / `nuxt.config.ts` / `app.config.ts` / `tsconfig.json` | 复制到 `starter/` 和 `apps/gallery/`（各自一份） |
| `public/favicon.svg` | 复制到 `starter/public/` 和 `apps/gallery/public/` |

## 3. workspace 接线要点

- **根** `package.json`：private，放 `pnpm -r` 脚本（build/typecheck 递归），tailwindcss/typescript/vue-tsc 等 devDeps 提到根。
- **`pnpm-workspace.yaml`**：`packages: ['packages/*', 'packages/kits/*', 'apps/*', 'starter']`。
- **`@geist-nuxt/core`**：作为 Nuxt layer 或普通包被 starter/gallery/kit 引用（Nuxt 场景推荐 layer：`extends: ['@geist-nuxt/core']`，自动带组件/css/composables）。确认现有组件自动导入策略（`pathPrefix: false`）在 layer 下仍成立。
- **kit 依赖**：`@geist-nuxt/kit-api-docs` 的 package.json 里 `dependencies: { "@geist-nuxt/core": "workspace:*" }`。
- **gallery**：`extends` core + 各 kit layer，或直接依赖并注册组件。
- 现有版本组合保持：Nuxt 4.4.8 / @nuxt/ui 4.9 / vue-router 5 / tailwindcss 4（已验证可 build）。

## 4. 验证清单（repo 侧，必过）

- [ ] 根目录 `pnpm install` 成功。
- [ ] `pnpm -r typecheck` 通过。
- [ ] `starter` 能独立 `pnpm build`，且**不含** api-docs 组件（干净）。
- [ ] `apps/gallery` 能 `pnpm build`，showcase 页面正常（明暗双模式 + 窄屏）。
- [ ] core 的 token/字体/明暗在 starter 和 gallery 两处都生效。

## 5. 完成后

- 按 `maintenance/sync.md` 把新结构同步回 skill `assets/`（repo 权威 → skill 镜像）。
- 同步后 SKILL.md「起点」描述要更新：starter 只吃 core；kit 在 `packages/kits/`；gallery 是独立 app。
- 更新 `architecture-decisions.md` 第 2、9 节的待定项为已决。
- 进入第二步：定 registry schema 并填 `packages/kits/api-docs/registry.json` 分片。
