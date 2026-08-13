# Source-first registry 操作

根 `registry.json` 是 geist-nuxt 唯一的机器可读分发契约。它覆盖 `foundation/` 与 `kits/` 的全部可安装切片；不存在 kit 内 registry、npm core 包或 Nuxt layer 兜底。

根级 `compatibility` 声明 consumer 支持范围；其中 `nuxt`、`nuxtUi`、`tailwindcss` 必须分别与
`externalRequirements.packages` 的 `nuxt`、`@nuxt/ui`、`tailwindcss` 表达语义等价的 semver
集合。根 `package.json` 的精确版本只固定本仓库 gallery / 测试环境，不收窄 consumer 契约。

## 消费者与职责

| 消费者 | 使用方式 |
|---|---|
| 根 gallery / v0 preview | 直接运行根源码，不执行 copy-in |
| 外部 Nuxt 项目 | 用 `geist:copy` 预览并安装 `geist-foundation`、所选切片及依赖闭包 |
| 已安装项目 | 用 `geist:update` 预览并更新受管文件，用 `geist:check` 检查漂移 |
| 外部项目内 AI | 用 `geist:skill` 同步 `.agents/skills/geist-nuxt/`，与 runtime 资产独立更新 |
| CI | `test:agent` + `registry:validate` + `test:registry` + `test:component` + `typecheck` + `build` + `test:consumer` |

## Manifest 契约

每个 item 至少描述：

- `name`：稳定、唯一、kebab-case 的切片 id。
- `type` / `title` / `description`：分类与人类说明。
- `verification`：该切片文件变化时，消费端应叠加执行的验证维度 tags（见下节词表）。
- `files[]`：每个文件的 `path`（真源相对仓库根）和 `target`（消费项目相对路径）。
- `registryDependencies[]`：同一根 registry 中必须先安装的切片。
- `packageDependencies`（可选）：该切片运行时额外需要的 npm package → version range；只随包含该 item 的解析闭包生效。

约束：

1. `path` 只能落在允许分发的 `foundation/` 或 `kits/`，不能指向 `app/`、`playground/`、fixture、archive 或生成目录。
2. `target` 必须是消费项目内的相对路径，不能含 `..`、绝对路径或落到 `node_modules` / `.nuxt`。
3. 一个 source file 只能有一个 owning item；共享能力通过依赖某个 owner slice 取得，不在多个 item 重复列文件。
4. 依赖图必须存在、无环、稳定排序。
5. kit item 可依赖 foundation 或同 kit item；禁止跨 kit 依赖。
6. foundation item 不依赖 kit。
7. demo、fixture、adapter、页面私有 recipe（如 `DocsShell` 系列）不得进入 registry。
8. `packageDependencies` 的包名与 semver range 必须有效；分发源码的 bare import 必须能由根 packages 或所属 item 的依赖闭包解释。同一解析闭包若对同一包声明不同 range，验证与 copy 都 fail closed，不擅自选择版本；互不相交的闭包可声明不同 range。
9. 每个 `registry:component` / `registry:block` 恰好暴露一个扁平的 `app/components/<Name>.vue`；`title` 必须等于 `<Name>`，公共名称不得使用 `ApiDocs` / `Composition` 这类来源前缀。
10. 随公共组件复制但不应被消费者直接使用的 Vue helper 放到 `app/internal/`，由公共组件显式相对导入。
11. `verification` 必填且非空；tag 必须来自下节稳定词表，未知 tag、缺失或重复一律验证失败（fail closed），不允许消费端按路径或 `type` 自行推断。

## Verification tags

registry 是 item verification metadata 的唯一 authority。tags 可叠加，描述"该 item 的文件产生真实 create / update / delete operation 时，消费端应执行哪些验证维度"；依赖闭包中的 item 只在自身文件产生真实 operation 时贡献 tags，仅 lock / source SHA 重写不构成 runtime impact。

| Tag | 语义 |
|---|---|
| `reference` | 只影响文档 / 参考资料（skill 同步产物），不影响 runtime 渲染 |
| `visual` | 影响渲染外观，需要视觉验证 |
| `interaction` | 影响交互行为（点击、键盘、复制、拖拽、搜索、状态持久化） |
| `responsive` | 影响断点 / 布局自适应行为 |
| `foundation` | 影响全局设计基础（tokens、theme），验证面是全站而非单组件 |
| `config` | 涉及 config fragment 或受保护入口接线，需要人工检查消费端合并 |
| `dependency` | runtime 依赖外部 npm package，需要确认依赖安装与集成 |

词表由 `scripts/lib/registry.mjs` 的 `VERIFICATION_TAGS` 导出，顺序即 canonical 顺序。新增 tag 属于 registry contract 变更，必须同步本表、schema 校验与下游 sync plan 消费者。

## 验证 registry

```bash
pnpm registry:validate
pnpm test:registry
```

- `registry:validate` 校验 schema、唯一性、source 存在性、target 安全、公共组件命名、verification tags、依赖闭包和方向。
- `test:registry` 对 resolve / copy / update / check 做行为测试，防止只通过静态 JSON 校验。

新增、移动或删除任何 foundation / kit 文件时，必须同步 registry 并运行两条命令。

## 安装切片

```bash
# 1. 默认 dry-run：只打印 create / update / unchanged plan
pnpm geist:copy -- geist-foundation <item...> \
  --target <consumer-directory> \
  --to <checkout-40-char-sha>

# 2. 确认 plan 后才实际写入
pnpm geist:copy -- geist-foundation <item...> \
  --target <consumer-directory> \
  --to <checkout-40-char-sha> \
  --write
```

`geist-foundation` 是基础 item 的稳定名称，提供可直接运行的 `app/assets/css/main.css` 与非覆盖式 app / Nuxt config fragments。请求其它 item 时，工具仍会自动展开其 `registryDependencies`；显式列基础 item 能让初次安装意图清楚。

`geist:copy` / `geist:update` 默认都是 **dry-run**，不创建文件、不删除文件，也不写 lock。只有显式 `--write` 才应用整个 batch。`--dry-run` 可用于强调只读意图，但不能与 `--write` 同时使用。

`--to <sha>` 接受且只接受精确 40 位 Git SHA，并且必须等于当前 checkout 的 `HEAD`。它是“我确认正在从这个 commit 安装”的断言，不会 fetch、checkout 或从远端读取其它 commit；省略时工具使用当前 `HEAD`。为保证 lock 中的 SHA 真能重现文件内容，`foundation/`、`kits/` 或 `registry.json` 有未提交变化时 CLI 会拒绝 copy / update，必须先提交来源资产。

`geist:copy` 的完整行为：

1. 从根 `registry.json` 解析请求 item；
2. 展开并拓扑排序 `registryDependencies`，聚合根 `externalRequirements.packages` 与闭包内各 item 的 `packageDependencies`；
3. dry-run 打印解析后的 package requirements，并计算完整闭包中每个 target 的操作；
4. 带 `--write` 时将完整闭包写入每个 `target`，并生成 / 更新 `geist.lock.json`；
5. 遇到未受管的同名文件或已修改受管文件时，整个 batch 在写入前停止并报告。

不要只复制 `.vue`：切片里的 composable、util、CSS 和 config 都是运行契约的一部分。

## 机器可读 sync plan（`--json`）

`geist:copy` / `geist:update` / `geist:skill` 接受 `--json`，把 dry-run plan 以 versioned JSON 输出到 stdout；这是给下游 sync orchestrator 的机器契约，人工流程继续用默认文本输出。`--json` 单独使用时是纯 dry-run 输出模式，不写任何文件；与 `--write` 组合时执行 guarded apply 并输出 apply result（见下文）。

runtime 与 skill plan 共用同一 schema family（`planSchemaVersion: 1`），`kind` 分别为 `runtime` / `skill`：

- `registry`：`name` 与 `repository`，绑定 plan 所属 registry；
- `sourceSha`：与 `--to` 同语义的精确 40 位 checkout SHA；runtime 与 skill plan 必须绑定同一 SHA；
- `consumer.lockPresent` / `consumer.lockSourceSha`：consumer 受管状态摘要；
- `operations[]`：按 `target` 排序。每条含 `action`（`create` / `update` / `delete` / `unchanged`）、稳定 `owner`（`item:<name>` 或 `skill:geist-nuxt`）、repo 相对 `source`（无源侧为 `null`）、consumer 相对 `target`、`beforeHash` / `afterHash`（缺失侧为 `null`）与 canonical 顺序的 `verification` tags；skill adapter symlink 以 `link` 表达且两侧 hash 为 `null`；
- `packageOperations[]` / `consumerSetupOperations[]`：相对 lock 记录 requirements 的结构化 diff（`add` / `remove` / `change`）；
- `configMigrations[]`：同一 owner 在一个 plan 内同时 create 与 delete target 即视为受管文件迁移，`from` / `to` 列出两侧 target；
- `requirements`：解析后的完整 `packages` 与 `consumerSetup`；
- `summary`：各 action 计数与 changed operations 的 verification tags 并集；
- `planDigest`：对 canonical 化文档（排除 `planDigest` 自身）的 sha256。

文档不含绝对路径与时间戳；同一 checkout、consumer state 与参数下，输出与 digest 确定性一致。仅 `sourceSha` 重写、内容 hash 未变化的 target 保持 `unchanged`，不贡献 `summary.verification`。

delete operation 的 tags 按序解析：当前 registry item → lock 记录的 `verification` → 全量词表保守 fallback（宁可过度验证，不猜测）；`verificationSource`（`registry` / `lock` / `vocabulary-fallback`）标记来源。

### Guarded apply 与 apply result

`--write --expect-plan <planDigest>` 执行 guarded apply：write 调用会从磁盘完整重算 plan（target、lock 与全部 consumer input 都参与 digest），重算 digest 与期望值不一致时以 `PLAN_CHANGED` 失败且零写入。apply 在首个 mutation 前还会逐 target 复核 plan 记录的 before-state，dry-run 与 apply 之间任何 target 变化同样 `PLAN_CHANGED` 零写入。`--expect-plan` 只能与 `--write` 组合，取值必须是 64 位 sha256 plan digest。

`--write --json` 输出 apply result：在重算的 plan 文档上追加 `apply` 段——`expectedPlanDigest`（未传 `--expect-plan` 时为 `null`）、写后 lock 的 `lockSourceSha`、以及每个 operation 的实际 `outcome`（`applied` = 发生文件系统变更；`skipped` = 无需变更，即 planned `unchanged` 或 target 已缺失的 delete）。注意 skill sync 在 payload 无变化时保留 installed sourceSha（`.geist-skill.json` 语义），此时 `apply.lockSourceSha` 可以早于本次 `sourceSha`，consumer 不应把两者强行画等号。consumer 校验 apply result 的 `planDigest` 等于评审过的 dry-run digest，即证明 plan 与最终写入结果一致。

`--json` 模式下所有错误（含意外异常）输出结构化 JSON `{ "error": { "code", "message", "details" } }` 到 stdout 并以非零退出；`code` 为 `PLAN_CHANGED`、缺省 `REGISTRY_ERROR`，意外异常透传原生 code（如 `EACCES`）或 `UNEXPECTED`。orchestrator 推荐流程：`--json` 出 plan → 审阅/选择验证集 → `--write --expect-plan <digest> --json` → 校验 apply result → 再次 `--json` 确认收敛零变化。

## `geist.lock.json` 契约

成功写入后，目标项目根目录的 lock 会记录：

- registry 名称、仓库、最后一次 source SHA；
- `compatibility` 与本次解析闭包的 `externalRequirements`，包括根基础包、所选 item 的额外包和消费项目必须人工合并的 setup；
- 用户直接请求的 items，以及解析后的完整依赖闭包；
- 每个 resolved item 的 `verification` tags（供后续 plan 为已移除 item 的 delete operation 解析 tags）、`registryDependencies`、`packageDependencies`、source SHA 和目标文件列表；
- 每个受管文件的 source、target、source SHA、source hash 与 target hash。

lock 是 update / check 的受管状态真源，不是依赖安装器；copy-in 不修改消费项目的 `package.json` 或 lockfile。消费项目必须安装 `geist.lock.json.registry.externalRequirements.packages` 中的解析结果。尤其 `geist-foundation` 会把 app config fragment 放到 `app/config/foundation/app.ts`；消费项目还必须按 `externalRequirements.consumerSetup` 将它的 default export 显式合并进自己拥有的 `app/app.config.ts`，并把 `app/config/foundation/nuxt.ts` 的 default export 合并进根 `nuxt.config.ts`。不要手改 lock，也不要把 lock 中的依赖范围当成已自动满足。

## Nuxt 4 消费项目接线

copy-in 不覆盖消费项目拥有的 `nuxt.config.ts`、`app/app.config.ts` 和 `app/app.vue`；foundation 的 `main.css` 则作为完整设计系统入口复制到 `app/assets/css/main.css`。安装 `geist-foundation` 后，按下列方式显式接线。

### `app/app.config.ts`

```ts
import base from './config/foundation/app'

export default defineAppConfig({
  ...base,
  ui: {
    ...base.ui,
    colors: {
      ...base.ui.colors,
      // 在这里追加或覆盖消费项目自己的语义色别名。
    },
    // 在这里追加消费项目自己的 Nuxt UI component overrides。
  },
})
```

入口必须是 Nuxt 4 的 `app/app.config.ts`。受管 fragment 留在 `app/config/foundation/app.ts`，不要改它，也不要另建根 `app.config.ts`。

### 根 `nuxt.config.ts`

```ts
import base from './app/config/foundation/nuxt'

export default defineNuxtConfig({
  modules: [
    '@nuxt/ui',
    // 保留消费项目自己的 modules。
  ],

  css: [
    './app/assets/css/main.css',
  ],

  colorMode: {
    ...base.colorMode,
    // 在这里追加消费项目自己的 color-mode 配置。
  },

  ui: {
    ...base.ui,
    theme: {
      ...base.ui.theme,
      // 在这里追加消费项目自己的 Nuxt UI theme 配置。
    },
  },
})
```

复制得到的样式入口已经包含 Tailwind、Nuxt UI 和全部设计基础：

```css
/* app/assets/css/main.css */
@import "tailwindcss";
@import "@nuxt/ui";

/* Foundation @theme、semantic tokens、light/dark 与 motion。 */

/* 消费项目自己的 override 放在 foundation 声明之后。 */
```

如果项目已有 `app/assets/css/main.css` 且内容不同，首次 copy 会停止并报告 conflict，不会覆盖。先人工合并或采用 foundation 入口，再重新执行 copy；复制完成后该文件归消费项目所有，可以继续追加 override，但任何本地修改都会让后续 `geist:update` 停止并要求人工合并。若已有 `colorMode` / `ui` 配置，在消费项目入口按示例显式合并覆盖；不要修改 `app/config/foundation/nuxt.ts`。所需 package 版本以 lock 的 `externalRequirements.packages` 为准。

### `app/app.vue`

```vue
<template>
  <UApp>
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </UApp>
</template>
```

`UApp` 提供 toast、tooltip 等应用级上下文；已有根壳时只需让现有内容位于单一 `<UApp>` 内，不要嵌套多个 app provider。

## 更新与漂移检查

```bash
# 先预览；不会改文件
pnpm geist:update -- \
  --target <consumer-directory> \
  --to <checkout-40-char-sha>

# 确认后应用
pnpm geist:update -- \
  --target <consumer-directory> \
  --to <checkout-40-char-sha> \
  --write

pnpm geist:check -- --target <consumer-directory>
```

- `geist:update` 读取目标项目的受管状态，按当前 registry 重新解析相同 item 集合；不靠目录扫描猜安装内容。
- dry-run 会把已不属于新依赖闭包的受管文件显示为 `delete`，但不会删除。
- 带 `--write` 更新时，未被本地修改的 stale managed file 会被删除，并从 lock 的 item / file 记录中清理；若 stale file 已被本地修改，则整个 batch 停止且不写入。
- 现存受管文件也是同一冲突规则：内容仍等于 lock hash 才能更新；有本地修改就停止整个 batch。
- `geist:check` 只读比较 lock、当前 checkout、当前 registry 与目标文件；lock 的 source SHA 落后当前 checkout，或发现缺失、内容漂移、陈旧受管文件、manifest 不一致时均非零退出，并要求先运行 `geist:update`。
- 普通受管组件的本地业务改动优先放在消费项目外层组合；`main.css` 可以按消费项目需要追加 override，但后续更新会把它视为需要人工合并的本地差异。

当 registry 移动受管 config fragment 时，dry-run 会把新 target 显示为 `create`、旧 target 显示为 `delete`。`nuxt.config.ts` 与 `app/app.config.ts` 是消费项目拥有的 protected entrypoint，update 不会改写其中的 import；消费方必须在同一个变更批次内把 import 切到新的中性路径。`geist:check` 只验证 lock 与 managed files，不能替代消费项目自己的 typecheck / build。

更新后在消费项目运行其 typecheck / build / focused tests。仓库自己的 fresh-install 端到端保证由 `pnpm test:consumer` 提供；PR 另由 `test:consumer:upgrade` 自动从 base Git tree 安装旧 lock、更新到 GitHub checkout 的 PR merge tree，再执行 check / typecheck / build。

## 新增 item 的最小流程

1. 将采纳后的源码放进 `foundation/` 或 `kits/<kit>/`。
2. 确定 owning slice；把全部分发文件列进 `files[]`，内部切片依赖列进 `registryDependencies[]`，额外 npm 运行依赖列进 `packageDependencies`。
3. 为消费项目选择稳定 target：components → `app/components/`，composables → `app/composables/`，utils → `app/utils/`，样式 / config 按根基础切片约定落位。
4. 更新正式 gallery story；playground 草稿删除或清空。
5. 运行完整 gate：

```bash
pnpm test:agent
pnpm registry:validate
pnpm test:registry
pnpm test:component
pnpm typecheck
pnpm build
pnpm test:consumer
```

## 数据与文案边界

- foundation / kit 只接收通用 props / ViewModel，不认识消费项目私有 spec。
- 私有 DSL、adapter、fixture 与 demo 数据留在根 `app/` 或消费项目。
- 用户内容走 props / slots；结构 chrome 可有默认值，但必须允许消费项目覆盖或本地化。
