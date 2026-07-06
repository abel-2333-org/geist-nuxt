# 组件规格模板（设计评审标准）

这是 geist-nuxt 的核心方法论产物，采纳自 Adobe Spectrum。**新增或评审任何组件（尤其是组合出的领域组件）时，逐项填写并检查这份清单。** `references/components/*.md` 都按这个结构书写。

## 1. Anatomy（解剖）

逐项说明组件用到哪些解剖部位，以及各自映射到哪个 Nuxt UI slot / 元素 / prop：

| 部位 | 是否使用 | 映射到 |
|---|---|---|
| container（容器） | | 根元素 / `UCard` / `UForm` … |
| label（标签） | | `UFormField` label / `<label>` |
| description（描述） | | `UFormField` description slot |
| value（值 / 内容） | | 输入值 / 主内容 slot |
| icon（图标） | | `leading-icon` / `i-lucide-*` |
| action（动作） | | `UButton` / `#trailing` |
| helper text（辅助文本） | | description / hint |
| error text（错误文本） | | `UFormField` error |
| affordance（可操作提示） | | chevron / caret / handle |
| focus target（焦点目标） | | 实际可聚焦元素 |

未使用的部位标注"—"，不要臆造。

## 2. State model（状态模型）

逐个说明每种状态的视觉与 token 表现（Nuxt UI 组件大多内置，需确认而非重造）：

| 状态 | 表现（token / class） |
|---|---|
| default | 基础样式 |
| hover | `bg-elevated` / hover 变体 |
| active / pressed | 按下反馈 |
| focus-visible | `--ui-primary` 聚焦环（勿移除） |
| selected | primary 高亮 |
| disabled | 降透明度 + `cursor-not-allowed`，不可聚焦 |
| loading | `:loading` prop / spinner，禁用交互 |
| invalid | error 色 + error text |
| readonly | 可聚焦可选中但不可改（区别于 disabled） |
| drag / drop | 拖拽反馈（如适用） |
| emphasized / quiet | `variant`（solid/soft/ghost）表达强弱 |

## 3. Accessibility（无障碍）

- **键盘导航**：Tab 顺序、方向键（列表/菜单/tab）、Enter/Space 激活、Esc 关闭。
- **焦点管理**：覆盖层打开时聚焦移入、关闭后归还；焦点陷阱（dialog）。
- **ARIA role / state**：正确的 role、`aria-expanded`/`aria-selected`/`aria-invalid` 等（Nuxt UI 基于 Reka UI，多数已处理——确认而非重写）。
- **屏幕阅读器标签**：图标按钮必须有 `aria-label` 或 sr-only 文本；装饰性图标 `aria-hidden`。
- **错误播报**：表单错误用 `aria-live` / `UFormField` 的 error 关联。
- **disabled vs readonly**：disabled 不可聚焦、语义"不可用"；readonly 可聚焦、语义"当前不可改"。按场景选对。
- **tooltip / popover / dialog 行为边界**：tooltip 仅辅助提示不承载交互；popover 可含交互但非模态；dialog 模态、需焦点陷阱与 Esc 关闭。
- **form field 的 label / description / error 关系**：统一用 `UFormField` 包裹，自动建立 `for`/`aria-describedby`/`aria-invalid` 关联，不要手工拆散。

## 落地示例

见 `references/method/spec-example.md`——把这套模板应用到一个新的领域组件。
