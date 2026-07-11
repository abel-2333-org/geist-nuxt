# core 组件回流规范

当一个通用组件在 v0 会话里做成、并决定让它成为设计系统的一部分时，走这条链把它「回流」进 `@geist-nuxt/core`，发版后所有会话的默认预览自动带上它。

本规范写成 **AI 可执行 checklist**：只有第 0 步（采纳决策）必须由人拍板，第 1–6 步 AI 可主导执行，人只在推送/发版处授权。

---

## 第 0 步：采纳决策（人拍板，AI 不替代）

回流前先确认这组件**值得进 core**。逐条自检，全部为「是」才继续：

- **通用**：它会被多个项目/场景用，而不是当前项目一次性拼装的业务块？
- **无现成**：`references/components/index.md` 的决策表和 Nuxt UI 原语里没有现成的，也无法用 `UCard`+`UBadge`+… 简单组合出来？
- **归属 core 而非 kit**：任何 UI 项目都可能用 → core；只服务特定场景（如 API 文档）→ 该走 `kits/<场景>` 而不是本规范。

任一为「否」→ 不回流（留在项目里，或沉淀到对应 kit）。

## 第 1 步：搬运源码到 core

- 目标目录：`packages/core/app/components/<分组>/<Name>.vue`（分组子目录仅用于组织，`pathPrefix: false` 下不进组件名；**basename 必须全局唯一**，含 core 已有组件如 `CopyButton`/`ThemeToggle`）。
- **文案无关化**：会话里可能硬编码了字符串，搬进 core 时一律改成 props/slot 传入，core 组件不含业务文案。
- 只用 `@nuxt/ui` 原语 + 语义 token，守住硬规则（focus 环、`aria-label`、`UFormField`、无固定宽度）。
- 若组件带自己的 composable/util，一并搬进 `packages/core/app/composables/` 或 `app/utils/`。

## 第 2 步：过规格（有交互才需要）

按 `component-spec-template.md`：有交互/状态/焦点管理 → 走 anatomy→state→a11y 三表；纯展示原子 → 口头过 anatomy + a11y 即可。AI 起草规格，人评审。

## 第 3 步：加 ShowcaseComponents 展示条目

在 `packages/core/app/components/showcase/ShowcaseComponents.vue` 加一段，让组件出现在每个消费项目的默认预览里。**按现有条目模板**（每块 = 一个 `UCard`）：

```vue
<!-- <Name>：一句话说明它是什么 -->
<UCard>
  <template #header>
    <h3 class="font-medium text-highlighted">分组标题</h3>
  </template>
  <div class="space-y-4">
    <!-- 主示例：最典型用法 -->
    <NewComponent title="示例标题" />
    <!-- 关键变体：尺寸/语义色/状态各摆一个，用真实 token，不写死颜色 -->
  </div>
</UCard>
```

要求：主示例 + 关键变体各一；文案用占位示例值；明暗两种模式都要成立（用语义 token，不用原始色值）。

## 第 4 步：验证

- 在 starter 里 `pnpm dev` 跑起来（starter 依赖发布版 core，本地验证可临时用 `pnpm --filter starter add @geist-nuxt/core@link:../packages/core` 或直接在 gallery 里验证，gallery 用 workspace 即时生效）。
- 明暗模式 + 移动→宽屏都过一遍。gallery 是最快的验证场（`workspace:*`，改完热更）。

## 第 5 步：bump core 版本（发版闸门，人授权推送）

- **semver 规则**：新增组件 = **minor** bump（`1.2.0`→`1.3.0`）；仅修 bug = patch；破坏性改（删/改 prop、改行为）= major。
- 改 `packages/core/package.json` 的 `version`。
- 提交 + 推送 main → CI 自动发布 `@geist-nuxt/core@<新版>` 到 npm、并出 `dist-skill` release。**推送需人授权。**

## 第 6 步：bump starter 依赖（钉死精确版本）

- 改 `starter/package.json`：`"@geist-nuxt/core": "<新版>"`（**精确版本，不加 `^`**——跨账号字节级一致靠它 + lockfile 双重钉死）。
- 同一次提交里改；CI 会重新生成 starter 的 `pnpm-lock.yaml` 并跑 boot 验证，boot 不过则视为回流失败，必须修好。

---

## 完成后

CI 绿灯后，按 `maintenance/sync.md` 把新 `dist-skill` 整体覆盖到记忆区。此后**所有 v0 账号的新会话**预览里都会出现这个组件——无需改任何 starter 文件（`index.vue` 永远只是 `<GeistShowcase />`，showcase 住在 core 里跟着发版走）。

## 一句话记忆

**人只做「第 0 步：该不该进」和「第 5 步：授权推送」两个决策，其余 AI 一条龙。**
