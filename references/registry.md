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

## 验证 registry

```bash
pnpm registry:validate
pnpm test:registry
```

- `registry:validate` 校验 schema、唯一性、source 存在性、target 安全、公共组件命名、依赖闭包和方向。
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

## `geist.lock.json` 契约

成功写入后，目标项目根目录的 lock 会记录：

- registry 名称、仓库、最后一次 source SHA；
- `compatibility` 与本次解析闭包的 `externalRequirements`，包括根基础包、所选 item 的额外包和消费项目必须人工合并的 setup；
- 用户直接请求的 items，以及解析后的完整依赖闭包；
- 每个 resolved item 的 `registryDependencies`、`packageDependencies`、source SHA 和目标文件列表；
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
