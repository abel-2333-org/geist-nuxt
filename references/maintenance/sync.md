# Source-first 分发与 memory 同步

## 唯一数据流

```text
GitHub 真源根目录
  → CI 验证 registry / root typecheck+build / 临时 consumer
  → 组装可运行的 dist-skill 根 snapshot
  → 在 dist-skill 内重新 install / typecheck / build
  → U+FFFD gate
  → skill-v* release asset
  → v0 memory area 整体覆盖
```

没有 npm publish、registry 可见性等待、独立 starter lockfile 或 Nuxt layer。根 snapshot 自带 `app/`、`foundation/`、`kits/`、`playground/`、`registry.json`、工具脚本、配置和 references；`v0.json` 从 `.` 启动它。

## CI 完成定义

Source-first 真源必须依次通过：

```bash
pnpm registry:validate
pnpm test:registry
pnpm typecheck
pnpm build
pnpm test:consumer
```

随后 CI 将仓库根复制为干净的 `dist-skill/`（排除 `.git`、`node_modules`、`.nuxt`、`.output`、coverage、日志），写入顶层 `RELEASE`，并在 assembled 目录再次：

```bash
pnpm install --frozen-lockfile
pnpm typecheck
pnpm build
```

这两层验证分别证明：真源能运行、registry 能装进独立 consumer、实际 release snapshot 也能独立运行。

## U+FFFD 编码闸门

分发前扫描 `dist-skill` 的 UTF-8 replacement character U+FFFD（字节 `EF BF BD`）。发现任意一处立即失败，并打印文件与行号。

U+FFFD 表示多字节文本在写入链路中被破坏，不是正常中文输入。不要删除 gate 或只排除 docs；foundation、kit、registry、源码和 references 都会进入下游，必须全量干净。

## 下载 release

先在顶层 shell 下载最新 `skill-v*` asset，不要让离线同步脚本代替 `gh` 认证：

```bash
gh release list --repo abel-2333-org/geist-nuxt --limit 20
gh release download <skill-vTAG> \
  --repo abel-2333-org/geist-nuxt \
  --pattern dist-skill.tar.gz \
  --dir /tmp/geist-nuxt-skill
```

再生成确定性覆盖计划：

```bash
node scripts/sync-skill-memory.mjs /tmp/geist-nuxt-skill/dist-skill.tar.gz
```

脚本只解包、列 manifest、输出 copy/delete 计划；v0 memory area 是虚拟文件面，只能由 AI 文件工具执行实际覆盖。

## 应用同步计划

目标：`v0_memories/team/skills/geist-nuxt`。

1. 读取脚本输出的 `sync-manifest.json`。
2. 对 manifest 中每个文件执行整体复制，保留相对路径。
3. 删除目标目录中不在 manifest 的旧文件。
4. 不触碰目标的 `skills/**` 独立系统目录。
5. 确认顶层 `RELEASE` 与下载 tag 一致。
6. 确认 `v0.json` 的 `starter.path` 为 `.`。

这是**完整 desired state 覆盖**，不是按文件人工合并。旧的 `starter/`、`packages/`、`apps/gallery/` 若残留，必须按 manifest 删除，否则 v0 会读取双活结构。

## 维护会话新鲜度自检

当会话准备修改 `foundation/**`、`kits/**`、`registry.json`、`app/**`、`references/**` 或 `SKILL.md` 时：

1. 读取当前 memory area 的 `RELEASE`。
2. 对照 GitHub 最新 `skill-v*` tag。
3. 落后或无 stamp 时，先完成整体同步再维护。

纯消费 skill、只在外部项目运行 `geist:copy` 的会话不做此自检。

## 推送前人工边界

提交前逐项说明：

- 真源变化属于 foundation、kit、root gallery、registry、references 还是 playground；
- registry item 为什么新增 / 改依赖 / 改 target；
- playground 草稿是删除、清空还是保留未采纳；
- root 与 consumer gate 的实际结果；
- 是否授权 push。未经授权不推送、不创建 release。

## 常见失败

- **registry validation 失败**：检查 source/target 越界、重复 owner、缺失依赖、依赖环或 kit → kit。
- **consumer build 失败**：通常是切片漏列 composable / util / CSS / config，或 target 路径与自动导入命名不一致；修 registry，不在 fixture 里偷偷补文件。
- **assembled dist build 失败**：release snapshot 漏文件、lockfile 不一致或脚本依赖了仓库外状态；dist 必须自足。
- **v0 仍显示旧结构**：确认 memory area 做的是 wholesale overwrite，旧 `starter/` / `packages/` / `apps/` 已删除，`starter.path` 为 `.`。
- **U+FFFD gate 失败**：定位 replacement character，按上下文恢复原文；不要用排除规则绕过。
