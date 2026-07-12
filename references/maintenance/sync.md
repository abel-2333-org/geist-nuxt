# 维护:skill 分发与记忆区同步(整体覆盖,不逐文件对账)

> 适用对象:**v0 维护本 skill 时**的操作纪律,不是 skill 使用者需要关心的内容。
> 本流程自 step2(发包化重构)起生效,替代旧的「逐文件 gh api 对账」流程。

## 分发模型

```
真源 abel-2333-org/geist-nuxt (main)
  → CI (.github/workflows/skill.yml):发包 @geist-nuxt/core + 验证 starter 可 boot
  → 组装 dist-skill(SKILL/README/AGENTS/v0.json/references/ + starter/ 含 CI 生成的 lockfile)
  → 打 GitHub release(tag: skill-v*,附 dist-skill.tar.gz)
  → 各 v0 账号:下载 → 整体覆盖记忆区 skill 目录
```

**多账号一致性保证**:同一 tag + 同一 `@geist-nuxt/core` npm 版本 + lockfile,三者机械钉死,无人工判断空间。

## 两条硬约束(决定了同步为什么半自动)

1. **记忆区只有 AI 够得着**:`v0_memories/` 是虚拟层,**Bash 读不到**,只能用 AI 文件工具(Read/Write/Move/Delete/Glob)读写。所以脚本**无法直接写记忆区**,只能备好"该有哪些文件"的计划,由 AI 机械套用。
2. **gh 鉴权不进 node 子进程**:node 里 spawn 的 `gh` 常拿不到 token;**直接的 top-level `gh` 命令**(鉴权正常时)才可靠。所以下载用直接 `gh`,脚本只做离线的解包 + 生成计划。

## 新鲜度自检(维护会话开场,兜底"怕漏同步")

dist 里带一个 `RELEASE` 戳(CI 在打包时写入 = 该次 release tag,随产物走)。开场比对:

```bash
# 最新分发 tag(直接 gh,可靠)
gh release list -R abel-2333-org/geist-nuxt --limit 20 --json tagName,isLatest \
  -q 'map(select(.isLatest))[0].tagName'
```
AI 再 `Read v0_memories/team/skills/geist-nuxt/RELEASE`,与上面 tag 比对:
- 一致 → 记忆区已最新,无需同步;
- 不一致 / 无 `RELEASE`(旧 dist 没有戳) → 记忆区落后,执行下面的同步。

## 同步操作(在 v0 会话里执行)

1. **下载**最新 dist(直接 `gh`,不经脚本):
   ```bash
   TAG=$(gh release list -R abel-2333-org/geist-nuxt --limit 20 --json tagName,isLatest \
     -q 'map(select(.isLatest))[0].tagName')
   gh release download "$TAG" -R abel-2333-org/geist-nuxt -p dist-skill.tar.gz -D /tmp/skill-sync
   ```
2. **生成同步计划**(离线脚本,解包 + 输出 manifest):
   ```bash
   node scripts/sync-skill-memory.mjs /tmp/skill-sync/dist-skill.tar.gz
   ```
   它打印解包目录、`RELEASE` 戳、文件清单,并把 `sync-manifest.json`(完整目标态)写到临时目录(路径见输出的 `Manifest :` 一行)。
3. **AI 套用计划,整体覆盖**记忆区 `v0_memories/team/skills/geist-nuxt/`:
   - `Read` manifest → 对每个 `files[]` 条目 `Move(copy)` `<root>/f` → `<memoryRoot>/f`;
   - `Glob` 记忆区,`Delete` 任何**不在** `files[]` 里的文件(旧布局残留必须清);
   - **例外**:绝不碰 `…/skills/**`(独立 skills 系统,不属本 dist)。
   - **顶层 `RELEASE`**:记忆区会含一个 `RELEASE` 戳文件(它在 `files[]` 内,当普通文件照拷),它是新鲜度戳、不是内容文件,**别当杂物删**。
   - **不做逐文件内容比对**——整体覆盖就是流程本身。`RELEASE` 戳随 dist 一起被覆盖,自动更新,无需额外记录。

## 改真源:工作区、push 与审查纪律

维护 skill = 改设计系统真源 `abel-2333-org/geist-nuxt`。下面是"怎么安全地改并推送"的完整纪律。

### 双区心智(改哪、预览看哪)

| 区 | 是什么 | 持久性 | 预览渲染 |
|---|---|---|---|
| 项目根(chat 工作区) | 直连真源仓库本身 | 持久(git) | 是,预览指向 **gallery app** |
| `.v0/*-repo` 临时 clone | 保底手段,非常态 | 非持久,会被清 | 否 |

**目标形态 = chat 工作区就是真源**:改 `packages/**` → gallery HMR 即时可见;git 直连真源,
`.v0` 被清/反复手动 clone 的问题从根上消失。starter 不作废——它是"消费者验收场"
(验证装了 core 的新项目开箱即用),继续留仓库、被 CI 验证、作为新项目模板,只是不再是"盯着改"的那块屏。

### git 连接方式(已定:方案 B)

chat 连接到 GitHub 仓库(v0 设置→Git),改动同步到分支,可用 v0 原生 Git 面板(看活动/拉取/PR);
**push 仍每次经人确认**(见下方 push 前清单),不放弃逐次审。
> 排除:方案 A(手动 clone + 即时 push)是保底但没解决 `.v0` 被清;方案 C(连接 + 自动同步、不逐次确认)与 push 前审查冲突,不采用。连接动作需人在 v0 界面操作,AI 无法代连。

### 改动方向(铁律)

**只在真源仓库改。** 流程:改真源 → push main → CI 出新 release → 按下方「同步操作」同步回记忆区。
记忆区永远是下游;绝不在记忆区改完再"推回"真源(step2 之前的旧模式,已废弃)。
本地 `git commit` 若发生在会被清的 `.v0` 里,一样会丢——**只有 push 才安全**。

紧急文档热修(不动代码、等不及 CI)可用 gh api 直推 main 单文件,但**推完必须让 CI 跑完并按新 release 重新同步**,不得跳过。

### 即时 push + push 前清单(每次推送必做)

- **纪律**:改完一个能独立成立的单元 → **立刻 push**,不攒着过夜;宁可多几个 WIP 提交。
- 推送前走一遍清单:
  1. `git status` 列出全部改动;
  2. 逐个说明"为什么进":产品(kit/core + registry) / gallery 展示 / 文档 / **playground 处置**(见 `method/component-reflow.md`);
  3. 任何说不清"为什么进"的 → 该丢,不提交;
  4. 人审这份清单 → 授权 → push。

## 故障排查

- **CI publish 步骤 401/403**:GitHub secret `NPM_TOKEN` 过期或对 `@geist-nuxt` scope 无 read-write。到 npmjs.com 重新生成 granular token 并更新 secret。
- **starter boot 验证失败**:core 新版本破坏了 starter,禁止发 release;在真源修复后重跑。
- **新会话预览起不来**:核对记忆区 `v0.json` 的 `starter.path` 是否为 `starter`、记忆区是否为最新 tag 的完整覆盖(残留旧 `assets/` 布局会干扰)。
