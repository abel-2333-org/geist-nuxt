---
name: geist-nuxt
description: geist-nuxt 是基于 Nuxt UI v4（Vue）的 Geist 风格 Source-first 设计系统。用于维护 geist-nuxt 真源，或在含 geist.lock.json 的消费 Nuxt 项目中设计、实现、预览、安装、更新和评审页面、布局、表单、导航、反馈、覆盖层、主题、通用组件与 API Docs 组件；触发词包括 geist-nuxt、Geist、Nuxt UI、registry、copy-in、gallery、playground。视觉参考 Vercel Geist，组件方法论参考 Adobe Spectrum；不用 React。
---

# geist-nuxt

## 先判断工作模式

- **Author 模式**：当前项目根含 `registry.json`、`foundation/` 与 `kits/`，即 geist-nuxt 真源。维护设计契约、候选组件、registry 和 gallery；根 app 同时是可运行 gallery 与 v0 preview。
- **Consumer 模式**：当前项目根含 `geist.lock.json`。使用已安装的 Nuxt UI / Geist 资产实现消费项目页面和业务组合；不要把消费项目当成设计系统真源。
- 两种条件都不满足时，先确认用户是在查看 gallery，还是准备把 geist-nuxt 接入当前 Nuxt 项目；不要臆造本机上游路径或手抄资产。

只看效果时，在 Author checkout 运行 `pnpm dev`，或打开 https://geist-nuxt-gallery.vercel.app。

## Author 真源结构

- `foundation/`：通用 token、配置、components、compositions、composables、utils；所有消费项目的基础切片。
- `kits/<kit>/`：领域增量；只依赖 foundation 或本 kit，禁止 kit → kit。
- `playground/`：未采纳候选，不属于分发资产。
- `app/`：根 gallery / v0 preview；demo、fixture、adapter 和页面私有 recipe 留在这里。
- `registry.json`：唯一机器可读 manifest，描述 source、target 和依赖闭包。
- `references/`：AI 读取的设计与操作契约；视觉实现不得反向覆盖文字规则。

不存在 `@geist-nuxt/core` npm 包、Nuxt layer、workspace package 或 starter 分发边界。旧架构仅保留在 Git 历史中，不得恢复为现行边界。

## Author 模式：维护真源

1. 查 `references/components/index.md` 和 Nuxt UI，确认没有现成原语或简单组合。
2. 交互 / 状态 / 焦点复杂时，按 `references/method/component-spec-template.md` 过 anatomy、state、a11y；纯展示件轻量处理。
3. 候选源码放 `playground/`，在根 `/playground` 用真实状态数据验证 HMR。
4. 验证明暗、390px 到宽屏、键盘、focus、loading / empty / error / disabled / 长内容等相关状态。
5. 人工决定归属：跨场景 → `foundation/`；单领域 → `kits/<kit>/`；未采纳则留在消费项目或删除。
6. 采纳后同步根 `registry.json` 与正式 gallery；运行 `pnpm test:agent && pnpm registry:validate && pnpm test:registry && pnpm test:component && pnpm typecheck && pnpm build && pnpm test:consumer`。

完整晋升与 playground 收尾见 `references/method/component-reflow.md`。

## Consumer 模式：实现与更新

1. 先读消费项目根 `geist.lock.json`，确认已安装 item、受管文件和来源；需要查能力时再读本 skill 的 `registry.json` 与对应 reference。
2. 依次优先使用 Nuxt UI v4 原语、lock 中已安装的 Geist 资产，再编写消费项目拥有的业务组合。
3. 不直接修改 lock 中的受管文件；确需通用能力时，从可用的 geist-nuxt clean checkout 通过 registry dry-run 规划安装或更新。
4. 将业务文案、状态编排、adapter、fixture 和页面 recipe 留在消费项目，不反向写入 foundation / kit。
5. 完成后运行消费项目已有的 lint、typecheck、test、build，并真实检查本次涉及的明暗、响应式、键盘和关键状态。

### 同步项目内 skill

从 geist-nuxt checkout 运行：

```bash
pnpm geist:skill -- --target <consumer> --to <checkout-40-char-sha>
pnpm geist:skill -- --target <consumer> --to <checkout-40-char-sha> --write
```

第一条只输出同步 plan；确认后才运行带 `--write` 的第二条。`--to` 与 runtime 工具一样，只接受当前 checkout 的精确 SHA；`SKILL.md`、`agents/openai.yaml`、`references/` 或 `registry.json` 未提交时拒绝同步。结果写入消费项目 `.agents/skills/geist-nuxt/`，应随消费项目提交 Git。不要手改受管 skill 文件，也不要用同步 skill 代替 runtime copy / update。

### 安装 / 更新 runtime 资产

只使用仓库公开命令：

```bash
pnpm geist:copy -- geist-foundation <item...> --target <consumer> --to <checkout-40-char-sha>
pnpm geist:copy -- geist-foundation <item...> --target <consumer> --to <checkout-40-char-sha> --write
pnpm geist:update -- --target <consumer> --to <checkout-40-char-sha>
pnpm geist:update -- --target <consumer> --to <checkout-40-char-sha> --write
pnpm geist:check -- --target <consumer>
```

前一条 copy / update 命令都是 dry-run；确认 plan 后才运行带 `--write` 的后一条。`--to` 必须是当前 clean checkout `HEAD` 的精确 40 位 SHA，它只做一致性断言；foundation / kit / registry 未提交时工具会拒绝生成 lock。工具会解析 `registryDependencies` 与所选闭包的 `packageDependencies`，整切片复制 component + composable + util + config / CSS，并在 `geist.lock.json` 记录来源、文件闭包与待安装 package requirements；copy-in 不修改消费项目 `package.json`。参数和冲突策略见 `references/registry.md`；不要绕过工具手抄。

## 硬规则

- 只用 Nuxt UI v4（Vue）原语 + 设计 token；不用 React。
- 配色使用 `--ui-*` 或 Tailwind 语义类；不硬编码颜色、圆角或临时尺寸。
- 响应式使用 `UContainer` / `UPage*` + 系统 `sm/md/lg/xl/2xl`；测量式溢出按 `references/foundations/responsiveness.md`。
- 交互元素必须有 `focus-visible`；纯图标按钮有 `aria-label`；表单用 `UFormField`；不只靠颜色传意。
- 用户内容通过 props / slots；结构 chrome 提供默认文案并允许覆盖。
- demo 数据、私有 spec、adapter、fixture 和页面 recipe 不进入 foundation / kit。

## 按需加载 references

- registry 操作：`references/registry.md`
- token / 排版 / 布局 / 响应式 / a11y / 文案：`references/foundations/`
- 组件选择与 API：`references/components/index.md`
- 页面组合：`references/compositions/index.md`
- gallery 与 story 分层：`references/gallery.md`
- 品牌资源：`references/brand-assets.md`
- 新组件规格与晋升：`references/method/`
- API Docs kit：`references/kits/api-docs/index.md`
- 分发与 memory 同步：`references/maintenance/sync.md`

## 最终检查

- **Author**：`registry.json` 可验证，依赖闭包无环、无越界 source / target；根 app typecheck + build 通过，临时 consumer 可按 registry copy-in 后 build；正式 gallery 不含 playground 草稿或私有数据；分发物不存在 U+FFFD replacement character。
- **Consumer**：受管文件与 `geist.lock.json` 一致，消费项目自身的 lint / typecheck / test / build 通过。
- **两种模式**：明暗、移动到宽屏、键盘与本次涉及的关键状态已真实预览。
