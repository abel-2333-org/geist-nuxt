# 组件总览

geist-nuxt 的组件全部来自 Nuxt UI v4（公共包 `@nuxt/ui`，共 122 个组件）。它们由 Nuxt **自动导入**，直接以 `U` 前缀在模板中使用，无需手写 import。

所有组件都用语义 token 主题化（见 `foundations/tokens.md`）。文档按任务分组，每个文件按规格模板（anatomy → states → a11y）书写。

| 分组 | 文件 | 主要组件 |
|---|---|---|
| 按钮 / 动作 | `buttons.md` | UButton, UButtonGroup |
| 表单 | `forms.md` | UForm, UFormField, UInput, UTextarea, USelect, UCheckbox, USwitch, URadioGroup |
| 反馈 | `feedback.md` | UAlert, UToast (useToast), UProgress, USkeleton |
| 数据展示 | `data-display.md` | UCard, UTable, UBadge, UKbd, USeparator, UAvatar |
| 导航 | `navigation.md` | UNavigationMenu, UTabs, UBreadcrumb, ULink, UPagination |
| 覆盖层 | `overlays.md` | UModal, USlideover, UPopover, UTooltip, UDropdownMenu |

> 上表是**任何项目都可用的通用组件**（Nuxt UI 原语）。领域专属组件（如 API 文档场景的 CodeBlock / RequestExample / ResponseExample）不在此处，见 `kits/`（用到才加载）。「主要组件」列即官方组件名映射，`U` 前缀为 Nuxt UI 自动导入名。

## 该用哪个组件（决策）

按需求快速定位，避免选错近似组件：

### 覆盖层（临时浮层）
| 需求 | 用 | 不要用 |
|---|---|---|
| 阻断式确认/表单弹窗 | `UModal` | `UPopover`（非阻断） |
| 侧边滑出面板（详情/筛选） | `USlideover` | `UModal` |
| 锚定小浮层（选择器/迷你表单） | `UPopover` | `UTooltip`（仅提示） |
| 悬停/聚焦纯文字提示 | `UTooltip` | `UPopover` |
| 点击触发的动作菜单 | `UDropdownMenu` | `USelect`（表单取值用） |

### 输入 / 取值
| 需求 | 用 |
|---|---|
| 单行文本 | `UInput` ｜ 多行 `UTextarea` |
| 少量互斥选项，需全部可见 | `URadioGroup` |
| 多选项下拉取值 | `USelect` ｜ 可搜索/远程 `USelectMenu` |
| 布尔开关（即时生效） | `USwitch` ｜ 表单勾选 `UCheckbox` |
| 任意字段 | 一律用 `UFormField` 包裹以获得 label/error 关联 |

### 导航
| 需求 | 用 | 不要用 |
|---|---|---|
| 同页切换视图 | `UTabs` | 路由跳转 |
| 站点/区块导航 | `UNavigationMenu` | `UTabs` |
| 层级位置指示 | `UBreadcrumb` | — |
| 单个链接 | `ULink`（内部路由/外链自动处理） | 裸 `<a>` |
| 长列表翻页 | `UPagination` | — |

### 反馈
| 需求 | 用 | 不要用 |
|---|---|---|
| 瞬时操作结果 | toast（`useToast()`） | `UAlert`（常驻） |
| 常驻上下文提示 | `UAlert` | toast |
| 确定进度 | `UProgress` | `USkeleton` |
| 内容加载占位 | `USkeleton` | spinner |

### 动作（交互，见 `buttons.md`）
| 需求 | 用 |
|---|---|
| 主/次操作按钮 | `UButton`（`variant` 表强弱） |
| 一组相关按钮 | `UButtonGroup` |

### 展示原子 / 容器（无交互，见 `data-display.md`）
| 需求 | 用 |
|---|---|
| 状态/分类标记 | `UBadge` |
| 键盘快捷键 | `UKbd` |
| 内容容器 | `UCard` ｜ 表格 `UTable` ｜ 分隔 `USeparator` ｜ 头像 `UAvatar` |

> 需求不在上表时，先查官方组件目录（https://ui.nuxt.com/components）再自建——122 个组件覆盖面很广，优先复用。

## 通用惯例

- **变体（variant）**表达强弱：`solid`（强调）、`soft`/`subtle`、`outline`、`ghost`（安静）、`link`。
- **颜色（color）**用语义别名：`primary` `secondary` `success` `info` `warning` `error` `neutral`。
- **尺寸（size）**：`xs` `sm` `md`（默认）`lg` `xl`。
- **图标**：`icon` / `leading-icon` / `trailing-icon` 接 `i-lucide-*` 或 `i-simple-icons-*`。
- 表单控件统一用 `UFormField` 包裹以获得 label/description/error 关联。

## 源码参考

- 组件源码：`src/runtime/components/`（reference workspace: nuxt/ui@v4，122 个 `.vue`）
- 组件主题：`src/theme/`（117 个 token 文件）
- 官方文档：https://ui.nuxt.com/
