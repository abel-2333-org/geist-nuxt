# 整屏装配（Compositions）

把通用组件拼成成品页面的装配指南。只用核心 Nuxt UI 组件 + Geist token，让整页在 Geist 视觉语言下保持一致：大留白、高对比、克制边框。按**抽象层级**分两份，按需读取：

| 想拼… | 读 | 内容 |
|---|---|---|
| **页面内的一块**（区块、卡片网格、表单、空状态、加载/反馈、每屏 a11y 自检） | `patterns.md` | 局部组合 pattern |
| **一整屏外壳**（根组件 `UApp`、粘顶 header、主题切换、容器约束的主体） | `page-shell.md` | 整页骨架，含已验证的完整外壳示例 |

其它去向：
- 想造「新的领域组件」（不是拼页面）→ `method/`
- 想查「单个组件的用法/props/a11y」→ `components/`
- 想要这些组合的**可视版** → 招牌组合见根 gallery 的 `<GalleryShowcaseCompositions>`（`app/components/gallery/showcase/Compositions.vue`）；可分发组合真源在 `foundation/compositions/`，整页活样例就是根 app。
