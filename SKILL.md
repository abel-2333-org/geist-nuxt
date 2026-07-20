---
name: geist-nuxt
description: geist-nuxt 是基于 Nuxt UI v4（Vue）的 Geist 风格 Source-first 设计系统。用于在本仓库或消费 Nuxt 项目中设计、实现、预览、安装、更新和评审页面、布局、表单、导航、反馈、覆盖层、主题、通用组件与 API Docs 组件；触发词包括 geist-nuxt、Geist、Nuxt UI、registry、copy-in、gallery、playground。视觉参考 Vercel Geist，组件方法论参考 Adobe Spectrum；不用 React。
---

# geist-nuxt

## 先判断工作面

- **设计 / 维护真源**：在本仓库根工作。根目录是可运行 Nuxt gallery，也是 v0 preview。
- **使用现有资产**：在消费项目通过根 `registry.json` copy-in；不要复制粘贴零散文件。
- **只看效果**：本地 `pnpm dev`，或打开 https://geist-nuxt-gallery.vercel.app。

## Source-first 结构

- `foundation/`：通用 token、配置、components、compositions、composables、utils；所有消费项目的基础切片。
- `kits/<kit>/`：领域增量；只依赖 foundation 或本 kit，禁止 kit → kit。
- `playground/`：未采纳候选，不属于分发资产。
- `app/`：根 gallery / v0 preview；demo、fixture、adapter 和页面私有 recipe 留在这里。
- `registry.json`：唯一机器可读 manifest，描述 source、target 和依赖闭包。
- `references/`：AI 读取的设计与操作契约；视觉实现不得反向覆盖文字规则。

不存在 `@geist-nuxt/core` npm 包、Nuxt layer、workspace package 或 starter 分发边界。旧架构仅保留在 `docs/archive/`，已 superseded。

## 新增组件流程

1. 查 `references/components/index.md` 和 Nuxt UI，确认没有现成原语或简单组合。
2. 交互 / 状态 / 焦点复杂时，按 `references/method/component-spec-template.md` 过 anatomy、state、a11y；纯展示件轻量处理。
3. 候选源码放 `playground/`，在根 `/playground` 用真实状态数据验证 HMR。
4. 验证明暗、390px 到宽屏、键盘、focus、loading / empty / error / disabled / 长内容等相关状态。
5. 人工决定归属：跨场景 → `foundation/`；单领域 → `kits/<kit>/`；未采纳则留在消费项目或删除。
6. 采纳后同步根 `registry.json` 与正式 gallery；运行 `pnpm registry:validate && pnpm test:registry && pnpm typecheck && pnpm build && pnpm test:consumer`。

完整晋升与 playground 收尾见 `references/method/component-reflow.md`。

## 在消费项目安装 / 更新

只使用仓库公开命令：

```bash
pnpm geist:copy -- geist-foundation <item...> --target <consumer> --to <checkout-40-char-sha>
pnpm geist:copy -- geist-foundation <item...> --target <consumer> --to <checkout-40-char-sha> --write
pnpm geist:update -- --target <consumer> --to <checkout-40-char-sha>
pnpm geist:update -- --target <consumer> --to <checkout-40-char-sha> --write
pnpm geist:check -- --target <consumer>
```

前一条 copy / update 命令都是 dry-run；确认 plan 后才运行带 `--write` 的后一条。`--to` 必须是当前 clean checkout `HEAD` 的精确 40 位 SHA，它只做一致性断言；foundation / kit / registry 未提交时工具会拒绝生成 lock。工具会解析 `registryDependencies`，整切片复制 component + composable + util + config / CSS，并在 `geist.lock.json` 记录来源与依赖闭包。参数和冲突策略见 `references/registry.md`；不要绕过工具手抄。

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

- `registry.json` 可验证，依赖闭包无环、无越界 source / target。
- 根 app typecheck + build 通过，临时 consumer 可按 registry copy-in 后 build。
- 明暗、移动到宽屏、键盘与关键状态已真实预览。
- 正式 gallery 不含 playground 草稿或私有数据。
- 分发物不存在 U+FFFD replacement character。
