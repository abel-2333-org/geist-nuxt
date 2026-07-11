# @geist-nuxt/gallery

常驻画廊：core 全量 + 各 kit demo 的真实渲染，是跨会话/跨账号查看组件长相的公共参照。

## 部署（Vercel）

- **地址**：https://geist-nuxt-gallery.vercel.app
- **Root Directory**：`apps/gallery`（monorepo 子目录，务必设对）
- **触发**：push `main` 自动部署；改到 `apps/gallery/**` 才会触发构建（monorepo 跳过逻辑）
- **归属**：部署建在 repo org owner 对应的 Vercel 账号下，与仓库归属对齐
- 一个部署服务所有 v0 账号，不要为其它账号另建平行部署

## 本地开发

```bash
pnpm install            # 仓库根执行，装齐 workspace 依赖
pnpm --filter @geist-nuxt/gallery dev
```

## 加组件条目

见 `references/gallery.md`：用 `GalleryItem` / `GalleryVariant` 加瘦身版条目（名称 + 描述 + 带标签的真实实例 + Usage 链接，不复制源码/props）。
