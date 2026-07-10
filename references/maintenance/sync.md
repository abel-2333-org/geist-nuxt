# 维护：改动本 skill 后如何同步到 GitHub 真源

本 skill 的**真源仓库**是 GitHub `abel-2333-org/geist-nuxt`（`main` 分支）。v0 记忆区里的这份 skill 是**下游镜像**——任何在记忆区里的改动，**必须**对账同步回 GitHub，否则真源会漂移。

> 适用对象：这是 **v0 自己维护本 skill 时**的操作纪律，不是 skill 使用者（消费项目）需要关心的内容。

## 三层文件关系

改动会经过三个位置，必须让它们最终一致：

1. **`v0_memories/user/skills/geist-nuxt/`** — 记忆区里的 skill 源（用 Read/Write/Edit/Glob 操作）。**权威的编辑入口。**
2. **`exports/geist-nuxt/`** — 项目内的可 Bash 访问镜像。**仅用于推送**（因为 Bash 读不到 `v0_memories/`，见下）。
3. **GitHub `abel-2333-org/geist-nuxt` `main`** — 真源。

## 关键踩坑

### 1. Bash 读不到 `v0_memories/`
`v0_memories/` 路径对 Bash 工具不可见（`find`/`cat`/`sha256sum` 都会 MISSING 或报错）。所以：
- 在记忆区里改文件：用 **Read / Write / Edit / Glob**。
- 要用 Bash（如 `base64`、`git hash-object`、`gh api`）处理这些文件前，**先用 Move(operation="copy")** 把改动过的文件从 `v0_memories/.../geist-nuxt/` 复制到 `exports/geist-nuxt/` 对应路径，再在镜像里跑 Bash。

### 2. 用 GitHub API 推送，不用 `git push`
v0 环境里对该仓库走 **`gh api`（Git Data API）**提交，不用 `git push`。基本流程：
1. 取 base：`gh api repos/abel-2333-org/geist-nuxt/git/refs/heads/main --jq '.object.sha'`，再取其 tree。
2. 为每个改动文件建 blob：`gh api --method POST .../git/blobs -f content="$(base64 -w0 FILE)" -f encoding="base64" --jq '.sha'`。
3. 建 tree、建 commit、`PATCH .../git/refs/heads/main` 更新 ref。

### 3. 删除文件时不要用 `base_tree` + `sha:null`（重要）
用 Git Data API **删除**文件时，`base_tree` 增量 tree 里挂 `{"path":..,"sha":null}` 会**稳定触发 `GitRPC::BadObjectState`**（试过带/不带 `mode`+`type` 都失败）。

**可靠做法——提交「完整 tree」，不带 `base_tree`：**
1. 拉完整递归 tree：`gh api "repos/abel-2333-org/geist-nuxt/git/trees/main?recursive=1"`（确认 `.truncated==false`）。
2. 用 jq：过滤掉要删的 path、把改动 path 的 sha 换成新 blob、其余 blob 保留原 sha。
3. `POST .../git/trees`（tree 里只放 `type=="blob"` 的条目，**不传 `base_tree`**）。
4. 建 commit + 更新 ref。

> 纯**修改/新增**（无删除）时，用标准 `base_tree` 增量提交即可，不会触发该 bug。

## 对账（每次同步后必做）

推送后确认记忆区 ↔ GitHub 逐字节一致：
- 拉远端 tree：`gh api "repos/abel-2333-org/geist-nuxt/git/trees/main?recursive=1"`。
- 对每个改动文件，比对**本地 `git hash-object FILE`（在 `exports/` 镜像里跑）**与远端该 path 的 `.sha`。相等即一致。
- 删除的文件：确认远端 tree 里已无该 path（或 contents API 返回 `Not Found`）。
- 注意 contents API 刚推送后可能有缓存延迟返回空 sha；此时用 **git tree API 的 blob sha 比对**更可靠。

## 触发时机

只要改动了 `v0_memories/user/skills/geist-nuxt/` 下**任何文件**（SKILL.md、references、assets/starter、assets/kits……），都要走一遍：**记忆区编辑 → Move copy 到 exports 镜像 → GitHub API 推送 → 对账**。
