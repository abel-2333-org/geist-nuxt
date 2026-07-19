# AGENTS.md — geist-nuxt 设计系统

> Codex / 通用 agent 的入口指针。实现任何 UI 前先读 `SKILL.md`，再按任务加载
> `references/**`；不要凭记忆臆造组件、token、registry item 或 API。

## 权威边界

- 本仓库采用 **Source-first**：根目录本身就是可运行的 Nuxt gallery，也是 v0 的 preview snapshot。
- 通用资产真源在 `foundation/`；领域资产真源在 `kits/<kit>/`；候选组件只放 `playground/`。
- `registry.json` 是唯一 copy-in manifest。不要手抄文件、不要维护 kit 内 registry，也不要依赖 npm 包或 Nuxt layer。
- 根 app 是活的可视镜像；设计规则仍以 `references/**` 为准。

## 按任务读取

- 契约与总流程：`SKILL.md`
- registry 安装、更新、漂移检查：`references/registry.md`
- foundations：`references/foundations/`
- 通用组件选择：`references/components/index.md`
- 页面与组合：`references/compositions/index.md`
- gallery / playground：`references/gallery.md`、`references/method/component-reflow.md`
- API Docs kit：`references/kits/api-docs/index.md`
- 品牌资源：`references/brand-assets.md`
- 已部署画廊：https://geist-nuxt-gallery.vercel.app

## 硬规则

- 只用 Nuxt UI v4（Vue）原语 + 语义 token；不用 React。
- 不硬编码颜色、尺寸或圆角；响应式遵循系统断点和 primitive。
- foundation 可被任何消费项目安装；kit 只能依赖 foundation 或本 kit，禁止 kit → kit。
- copy-in 只走 `pnpm geist:copy` / `pnpm geist:update`；两者默认 dry-run，确认 plan 后必须显式加 `--write` 才会修改目标。可复现安装用 `--to <40-char-sha>`，该 SHA 必须等于当前 checkout `HEAD`；改完跑 `pnpm geist:check`。
- 新组件先在 `/playground` 验证明暗、响应式、键盘和关键状态；人工采纳后才进入 foundation/kit + registry + gallery。

## 起步

```bash
pnpm install
pnpm dev
```

本地 gallery 与 v0 都从根 `.` 启动；`/playground` 是候选设计面，正式组件目录和 kit 页面是采纳后的评审面。
