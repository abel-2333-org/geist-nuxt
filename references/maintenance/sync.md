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

## 同步操作(在 v0 会话里执行)

1. 查最新分发版本:
   ```bash
   gh release list -R abel-2333-org/geist-nuxt --limit 5
   ```
2. 下载并解包(Bash 可访问的临时目录):
   ```bash
   gh release download <skill-v-tag> -R abel-2333-org/geist-nuxt -p dist-skill.tar.gz -D /tmp/skill-sync
   mkdir -p /tmp/skill-sync/dist && tar xzf /tmp/skill-sync/dist-skill.tar.gz -C /tmp/skill-sync/dist
   ```
3. **整体覆盖**记忆区 `v0_memories/team/skills/geist-nuxt/`:
   - Bash 读不到 `v0_memories/`,须用 **Write/Move(copy)/Delete 工具**逐文件落盘;
   - 以 dist 内容为准:dist 有 → 覆盖写入;记忆区有而 dist 无 → 删除(旧布局残留必须清)。
   - **不做逐文件内容比对**——整体覆盖就是流程本身。
4. 同步后在记忆区 SKILL.md 无需记录 tag 之外的任何状态;当前 tag 可在会话开头用第 1 步命令核对是否落后。

## 改动方向(铁律)

**只在真源仓库改。** 流程:v0 会话里 clone 真源 → 修改 → push main → CI 出新 release → 按上面同步回记忆区。
记忆区永远是下游;绝不在记忆区改完再"推回"真源(那是 step2 之前的旧模式,已废弃)。

紧急文档热修(不动代码、等不及 CI)可用 gh api 直推 main 单文件,但**推完必须让 CI 跑完并按新 release 重新同步**,不得跳过。

## 故障排查

- **CI publish 步骤 401/403**:GitHub secret `NPM_TOKEN` 过期或对 `@geist-nuxt` scope 无 read-write。到 npmjs.com 重新生成 granular token 并更新 secret。
- **starter boot 验证失败**:core 新版本破坏了 starter,禁止发 release;在真源修复后重跑。
- **新会话预览起不来**:核对记忆区 `v0.json` 的 `starter.path` 是否为 `starter`、记忆区是否为最新 tag 的完整覆盖(残留旧 `assets/` 布局会干扰)。
