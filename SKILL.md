---
name: geist-nuxt
description: 维护 geist-nuxt 设计系统真源，在含 geist.lock.json 的 Nuxt 消费项目中实现或评审界面，或按用户明确要求接入、安装和更新 geist-nuxt。遵循 Nuxt UI v4（Vue）与 Source-first registry 契约；普通 Nuxt UI 或泛 Geist 风格任务不自动适用。
---

# geist-nuxt

## 先判断工作模式

- **Author 模式**：当前项目根含 `registry.json`、`foundation/` 与 `kits/`，即 geist-nuxt 真源。维护设计契约、候选组件、registry 和 gallery；根 app 同时是可运行 gallery 与 v0 preview。
- **Consumer 模式**：当前项目根含 `geist.lock.json`。使用已安装的 Nuxt UI / Geist 资产实现消费项目页面和业务组合；不要把消费项目当成设计系统真源。
- **首次接入**：尚无 lock，但用户明确要求接入 geist-nuxt 时，按 Consumer 安装流程处理。先定位可用的真源 checkout；只有目标项目或来源无法确定时才询问，不臆造本机路径或手抄资产。

只看效果时，在 Author checkout 运行 `pnpm dev`，或打开 https://geist-nuxt-gallery.vercel.app。

## Author 真源结构

- `foundation/`：通用 token、配置、components、compositions、composables、utils；所有消费项目的基础切片。
- `kits/<kit>/`：领域增量；只依赖 foundation 或本 kit，禁止 kit → kit。
- `playground/`：未采纳候选，不属于分发资产。
- `app/`：根 gallery / v0 preview；demo、fixture、adapter 和页面私有 recipe 留在这里。
- `registry.json`：唯一机器可读 manifest，描述 source、target、依赖闭包和每个 item 的 consumer verification tags。
- `references/`：AI 读取的设计与操作契约；视觉实现不得反向覆盖文字规则。

不存在 `@geist-nuxt/core` npm 包、Nuxt layer、workspace package 或 starter 分发边界。旧架构仅保留在 Git 历史中，不得恢复为现行边界。

## 按任务选择流程与验证

| 任务 | 工作范围与验收 |
| --- | --- |
| 只读审查 / 问答 | 读取相关契约与事实源；按问题运行必要检查。报告发现与未验证项，不套用实现或晋升流程。 |
| 纯文档 / agent 指令 | 检查内容、路径、命令与规则一致性；入口或同步变更运行 `pnpm test:agent`。只有改变渲染内容时才增加相关页面预览。 |
| 现有组件 / 页面修复 | 在现有归属内修复，运行相关测试；Vue / 类型变更做 typecheck，构建集成受影响时做 build。UI 变更真实检查受影响的明暗、响应式、键盘与关键状态。无需重新晋升。 |
| 新组件候选 / 晋升 | 先查现有原语与组合；候选只进 `playground/`，按 `references/method/component-reflow.md` 验证。人工采纳后同步正式真源、registry 与 gallery，并执行该文档的完整门禁。 |
| registry / runtime 安装更新 | 按 `references/registry.md` 核对依赖闭包、dry-run 与写入结果。真源 registry 变更运行 `registry:validate`、`test:registry` 及受影响 consumer 验证；目标项目应用后运行 `geist:check` 与其相关检查。 |
| 发布 / v0 snapshot 同步 | 按 `references/maintenance/sync.md` 执行完整发布门禁、来源与编码检查。v0 memory 新鲜度自检仅用于 v0 snapshot。 |

以上用于选择本地检查，不豁免仓库 CI、晋升或发布的强制门禁。未运行或环境阻断的检查要明确说明，不用静态检查代替真实预览。

## Consumer 模式：实现与更新

1. 先读消费项目根 `geist.lock.json`，确认已安装 item、受管文件和来源；需要查能力时再读本 skill 的 `registry.json` 与对应 reference。
2. 依次优先使用 Nuxt UI v4 原语、lock 中已安装的 Geist 资产，再编写消费项目拥有的业务组合。
3. 不直接修改 lock 中的受管文件；确需通用能力时，从可用的 geist-nuxt clean checkout 通过 registry dry-run 规划安装或更新。
4. 将业务文案、状态编排、adapter、fixture 和页面 recipe 留在消费项目，不反向写入 foundation / kit。
5. 按上表选择消费项目已有的相关检查，遵循消费项目自身的必需门禁；UI 变更真实检查受影响的明暗、响应式、键盘和关键状态。

### 同步项目内 skill

从 geist-nuxt checkout 运行：

```bash
pnpm geist:skill -- --target <consumer> --to <checkout-40-char-sha>
pnpm geist:skill -- --target <consumer> --to <checkout-40-char-sha> --write
```

第一条只输出同步 plan；agent 核对目标、差异与已有授权后才运行带 `--write` 的第二条。`--to` 与 runtime 工具一样，只接受当前 checkout 的精确 SHA；`SKILL.md`、`agents/openai.yaml`、`references/` 或 `registry.json` 未提交时拒绝同步。结果写入消费项目 `.agents/skills/geist-nuxt/`，应随消费项目提交 Git。不要手改受管 skill 文件，也不要用同步 skill 代替 runtime copy / update。

### 安装 / 更新 runtime 资产

只使用仓库公开命令：

```bash
pnpm geist:copy -- geist-foundation <item...> --target <consumer> --to <checkout-40-char-sha>
pnpm geist:copy -- geist-foundation <item...> --target <consumer> --to <checkout-40-char-sha> --write
pnpm geist:update -- --target <consumer> --to <checkout-40-char-sha>
pnpm geist:update -- --target <consumer> --to <checkout-40-char-sha> --write
pnpm geist:check -- --target <consumer>
```

copy / update 默认 dry-run。核对 plan 指 agent 检查目标、差异、依赖与授权范围；已有授权覆盖时可直接应用，超出范围时才请用户决定。组件采纳、push、发布与 merge 的授权仍分别遵循项目规则。

`--to` 是当前 checkout `HEAD` 的精确 40 位 SHA 一致性断言；foundation / kit / registry 未提交时工具拒绝生成 lock。copy-in 记录文件闭包与待安装依赖，不修改消费项目 `package.json`。自动化可使用 `--json` 与 `--write --expect-plan <planDigest>` 防止计划漂移；完整参数、schema 与冲突策略见 `references/registry.md`。

## 硬规则

- 只用 Nuxt UI v4（Vue）原语 + 设计 token；不用 React。
- 配色使用 `--ui-*` 或 Tailwind 语义类；尺寸与圆角使用系统 scale、token 或已有契约规定值，不引入临时任意值。
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

## 完成说明

说明本次范围、采用的验证及结果、仍未验证的部分。正式 gallery 不含 playground 草稿或私有数据；runtime 安装更新后受管文件与 `geist.lock.json` 一致；晋升与发布须满足对应完整门禁。
