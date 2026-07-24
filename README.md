# geist-nuxt

Geist 风格的 Source-first Nuxt UI v4（Vue）设计系统。仓库根目录同时是：

- 可直接运行的 gallery；
- v0 的 preview snapshot；
- `foundation/` 与 `kits/` 的唯一源码真源；
- 根 `registry.json` 的 copy-in 分发源。

不再发布 `@geist-nuxt/core`，不使用 Nuxt layer、workspace package 或独立 starter。旧方案保留在 `docs/archive/`，仅用于追溯。

## 本地设计与预览

```bash
pnpm install
pnpm dev
```

- `/`：Foundations / overview
- `/components`：通用组件目录
- `/compositions`：组合组件
- `/kits/api-docs`：API Docs kit
- `/kits/api-docs/endpoint-reference`：完整 Endpoint 参考页
- `/kits/api-docs/webhook-reference`：完整 Webhook 参考页
- `/playground`：候选组件草稿面，不进入正式导航

设计中源码放 `playground/`；人工采纳后再移动到 `foundation/` 或 `kits/<kit>/`，补根 registry 与正式 gallery。详细流程见 `references/method/component-reflow.md`。

## 目录边界

```text
app/                         根 gallery / v0 preview；含正式 story、fixture、adapter、页面私有 recipe
foundation/
  components/               通用组件
  compositions/             可复用页面组合
  composables/              通用 composables
  utils/                    通用 utils
  assets/css/               Geist token 与全局样式
  config/                   可 copy-in 的 Nuxt UI / app 配置
kits/api-docs/
  components/               API Docs 领域组件
  composables/              kit composables
  utils/                    kit utils
playground/                  未采纳候选
registry.json                唯一 copy-in manifest
references/                  设计与操作契约
```

依赖方向：kit → foundation、kit → 同 kit；禁止 kit → kit。gallery 私有 demo（例如 docs-shell 的 `DocsShell` 系列）留在 `app/components/demo/`，不进入 registry。

## Copy-in registry

不要手抄文件，也不要维护 kit 内 registry。所有安装、更新与漂移检查都以根 `registry.json` 为准：

```bash
pnpm registry:validate
pnpm geist:copy -- geist-foundation <item...> --target ../my-nuxt-app --to <checkout-40-char-sha>
pnpm geist:copy -- geist-foundation <item...> --target ../my-nuxt-app --to <checkout-40-char-sha> --write
pnpm geist:update -- --target ../my-nuxt-app --to <checkout-40-char-sha>
pnpm geist:update -- --target ../my-nuxt-app --to <checkout-40-char-sha> --write
pnpm geist:check -- --target ../my-nuxt-app
```

`geist:copy` / `geist:update` 默认只打印 dry-run plan；只有显式传 `--write` 才修改目标项目。`--to` 是精确来源断言，必须是当前 clean checkout `HEAD` 的 40 位 Git SHA，并不会替你切换或下载版本；foundation / kit / registry 未提交时会拒绝生成 lock。基础 item 名为 `geist-foundation`；工具会展开 `registryDependencies`，将完整依赖闭包中的 component / composable / util / CSS / config 写入目标项目。完整命令、lock、冲突与更新语义见 `references/registry.md`。

## 维护验证

```bash
pnpm registry:validate
pnpm test:registry
pnpm typecheck
pnpm build
pnpm test:consumer
```

CI 按同一顺序验证根真源，再组装可运行的 `dist-skill` 根 snapshot，并在分发目录重新 install、typecheck、build。release asset 供 v0 memory area 整体覆盖同步；没有 npm publish 或 registry 可见性等待。

## 多入口

- **v0**：`v0.json` 的 starter path 是根 `.`，新会话直接运行同一份 Source-first snapshot。
- **Codex**：读取根 `AGENTS.md` 和 `SKILL.md`；作为上游引入消费项目时，用 registry 工具安装，不复制整套 gallery。
- **人类评审**：本地 gallery 或 https://geist-nuxt-gallery.vercel.app。

铁律：只在真源仓库修改 foundation / kit / registry / references。消费项目里的 copy-in 文件是受管副本，用 `geist:update` 更新，不反向覆盖真源。
