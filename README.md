# geist-nuxt

Geist 风格设计系统（视觉参考 Vercel Geist，组件基座 Nuxt UI v4 / Vue，方法论参考 Adobe Spectrum）。
本仓库是**唯一真源（single source of truth）**，同一份内容同时服务 **v0 / Claude Code / Codex** 三个入口。

## 目录结构

```
geist-nuxt/
  SKILL.md                 # 契约与路由（三工具共用正文）
  v0.json                  # v0 专用元数据（其他工具忽略，无害）
  AGENTS.md                # Codex 入口（指针，指向 references/**）
  README.md                # 本文件
  references/              # 全部规范正文（三工具共用）
    foundations/           #   基础地基：token/排版/间距/响应式/a11y/约定/文案
    components/            #   通用组件：任务域分组 + 官方名映射
    compositions.md        #   整屏装配（外壳/卡片网格/空态/a11y 清单）
    brand-assets.md        #   logo / favicon / 图标规则
    method/                #   方法论：规格模板 + 落地范例（造新组件时读）
    kits/                  #   领域包：用到才读（含 api-docs）
  assets/
    starter/               # 通用基座项目（provider/全局样式/字体已接好）
    kits/                  # 领域组件源码（api-docs：4 组件 + section）
```

## 分层理念

`foundations`（值）→ `components`（零件）→ `compositions`（整屏装配）→ `method`（造新零件）→ `kits`（领域零件）。
**通用层对所有项目生效；`kits/` 按项目类型可选加载；`method/` 是造新领域组件的模具。**
做新场景时只需新增 `kits/<场景>/`，通用层与基座零改动。

---

## 三个入口怎么接

真源只有一份（本仓库）。三个工具各自用**引用**方式接入，**绝不复制正文**。

### 1. v0
已内置于 v0 记忆系统（Personal + Team 两个范围），本仓库是其可移植镜像。
`v0.json` 与 `SKILL.md` frontmatter 的 `metadata.v0.kind: design-system` 为 v0 专用。

### 2. Claude Code（原生 skill，几乎零适配）
Claude Code 有原生 Agent Skills 机制：只要 `SKILL.md` 在约定目录且 frontmatter 有 `name` + `description`，
它会**自动发现并按需加载**，无需额外适配文件。

- 个人级：`~/.claude/skills/geist-nuxt/`
- 项目级：`<repo>/.claude/skills/geist-nuxt/`

推荐用软链指向本仓库（见下方 submodule 工作流）。`v0.json` / `AGENTS.md` 对 Claude 无害，可保留。

### 3. Codex（无 skill 概念，必须 AGENTS.md）
Codex 只读仓库根的 `AGENTS.md`，不认识 `SKILL.md`。本仓库根已提供 `AGENTS.md`（指针）。
**当本仓库作为 submodule 嵌入其他项目时**，需在**宿主项目根**的 `AGENTS.md` 里加一段指针，
把路径改为 submodule 的相对路径，例如（假设挂在 `design-system/geist-nuxt/`）：

```markdown
构建任何 UI 时，geist-nuxt 是唯一权威设计系统来源。
- 契约：design-system/geist-nuxt/SKILL.md
- 基础/组件/装配：design-system/geist-nuxt/references/{foundations,components}/、compositions.md
- 领域包（用到才读）：design-system/geist-nuxt/references/kits/
硬规则：只用 Nuxt UI (Vue) + 设计 token，不用 React、不硬编码颜色/尺寸。
```

---

## 同步机制：Git submodule（防漂移）

真源只维护本仓库一份；各消费项目通过 submodule 引用，`git pull` 即全同步。

### 在消费项目里引入

```bash
# 把设计系统作为 submodule 拉进来（放在 design-system/geist-nuxt）
git submodule add <本仓库地址> design-system/geist-nuxt
git submodule update --init --recursive

# Claude 入口：软链到 .claude/skills（指向 submodule）
mkdir -p .claude/skills
ln -s ../../design-system/geist-nuxt .claude/skills/geist-nuxt

# Codex 入口：在项目根 AGENTS.md 里加上指向 submodule 的指针（见上方片段）
```

### 更新到最新

```bash
git submodule update --remote design-system/geist-nuxt
git add design-system/geist-nuxt && git commit -m "chore: bump geist-nuxt"
```

### 首次 clone 消费项目

```bash
git clone --recurse-submodules <消费项目地址>
# 或已 clone 后：
git submodule update --init --recursive
```

---

## 同步方向：仓库 → v0 记忆区（单向下游）

本仓库（`abel-2333-org/geist-nuxt`）与 v0 记忆区是**两套物理隔离的存储**，之间**没有自动同步**：

- **GitHub 仓库** = 唯一真源，Claude / Codex 直接读它。
- **v0 记忆区**（`user/skills/geist-nuxt` + `team/skills/geist-nuxt`）= 从仓库**单向同步**下来的下游镜像，只有 v0 能读写。

**铁律：只在仓库改，v0 记忆区永远是下游，方向单一，绝不反向。**

| 谁改的 | 传播路径 |
|---|---|
| Claude / Codex 改 | push 到仓库 → v0 拉取校对 → 写回记忆区 `user` + `team` |
| v0（对话里）改 | 改 `assets/` 镜像 → push 到仓库 → 再同步进记忆区两份 |

### 一次同步怎么做（在 v0 对话里触发）

1. 让 v0「从 `abel-2333-org/geist-nuxt` 同步最新到记忆区」。
2. v0 用 `gh api` 拉全量文件 → 逐个 `sha256` 比对记忆区 → 只写回**有差异**的文件。
3. v0 报告校对结果（哪些变了 / 哪些一致），确保三处（GitHub / user / team）对齐、不漂移。

> 注：拉取含中文的文件请用 `-H "Accept: application/vnd.github.raw+json"`（`--jq '.content'` 对多字节 base64 不稳定）。

---

## 起步

新项目从 `assets/starter/` 起步——provider、全局样式、字体已接好，在其上加路由和组件即可。

```bash
cd assets/starter
pnpm install
pnpm dev
```
