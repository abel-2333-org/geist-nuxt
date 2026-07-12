# Gallery 展示规范

> gallery（`apps/gallery`，部署 https://geist-nuxt-gallery.vercel.app）是常驻画廊：
> 通过 `workspace:*` 引 core + kits，改完即时生效，无需发版。
> 它的消费者是**人眼**（你/评审），不是 AI —— AI 学用法读的是本 `references/`，不是画廊。

## 瘦身原则（为什么不放源码/props 表）

gallery 条目**只放真实渲染**，刻意**不复制**源码片段和 props 表。理由：

- 源码、props 的权威在**组件源码**和**本 references**。在 gallery 再誊一份 = 第三处副本，
  必然随时间漂移，违背单一真源。
- gallery 不可替代的价值是**真实渲染**：明暗两种模式下组件实际的长相、间距、hover——
  这是文字文档永远表达不了的。其余信息用一个 **Usage 链接**指向权威来源即可，不复制内容。

## 条目结构：GalleryEntry + GalleryExample

一个组件 = 一个 `<GalleryEntry>`，内含若干 `<GalleryExample>`：

```vue
<GalleryEntry
  name="UButton"
  description="一句话说明这个组件是干什么的。"
  usage-href="https://github.com/abel-2333-org/geist-nuxt/blob/main/references/components/buttons.md#ubutton"  <!-- 指回自家 references 锚点，不复制 -->
>
  <GalleryExample label="Variants">
    <UButton>Primary</UButton>
    <UButton variant="outline">Outline</UButton>
  </GalleryExample>
  <GalleryExample label="Colors" layout="stack">  <!-- 块级组件用 stack -->
    <UAlert title="..." description="..." />
  </GalleryExample>
</GalleryEntry>
```

- **GalleryEntry**：卡片外壳。`name`（等宽字体，如组件名）+ `description`（一句话）+
  可选 `usageHref`（右上角 Usage 链接，指回自家 `references/components/<组>.md` 的锚点）+ 可选 `usageLabel`
  （链接文案，默认 "Usage"，可覆盖做本地化）。
- **GalleryExample**：一个带标签的实例块。`label` 是小号大写标签（Variants / Sizes /
  States / With icon…），下面摆该 facet 的**真实组件实例**。`layout` 控制排列：
  `row`（行内换行，按钮/徽标，默认）/ `stack`（竖排，警告/卡片等块级组件）/ `grid`（响应式两列）。
- 两者都在 `apps/gallery/app/components/gallery/`，Nuxt 自动导入，无需 import。

## 往画廊加组件条目

catalog 按 `references/components/` 的六个任务分组拆成六个 section 组件，都在
`apps/gallery/app/components/gallery/`：`Buttons`/`Forms`/`Feedback`/`Navigation`/
`Overlays`/`DataDisplay`（`<GalleryButtons>` 等），由 `Catalog.vue`（`<GalleryCatalog>`）
纯容器组织。**Entry 粒度对齐文档标题**（一个 `## 标题` = 一个 `<GalleryEntry>`），
不是一组件一条——保持与 references 结构同构。

1. 找到组件所属分组，打开对应 `gallery/<Group>.vue`（新分组才新建 section 并加进 `Catalog.vue`）。
2. 加一个 `<GalleryEntry>`，`usage-href` 指回该组 `references/components/<组>.md` 的标题锚点。
3. 按 facet（变体、尺寸、状态、带图标…）拆成多个 `<GalleryExample>`，每块摆真实实例；
   块级组件（Alert/Card 等）用 `layout="stack"`。
4. 用真实 token、占位示例值；明暗模式都要成立（别写死颜色）。
5. **不要**在条目里贴源码字符串或手写 props 表——用 usageHref 指出去。

## 边界

- gallery 只增删条目/section，**不改** core、kit 的组件源码。
- **分工**：core 的 `<ShowcaseCompositions>` 只展示招牌**组合**（Sign-up form 等），
  gallery 的 catalog 才是**逐组件目录**（带 facet 标签）。单组件陈列归 catalog，
  不进 showcase；两者不再重叠。
- 页面组织走**多路由 + 自动导航**（见下节），gallery 不手写导航项、不手写移动端抽屉。

## 页面组织：多路由 + 自动导航

gallery 用 **Nuxt 文件路由**组织，一个逻辑分组 = 一个路由。粒度不再是"该堆哪"的结构分类，
路由树本身就是唯一的一维结构。

**路由结构：**

```plaintext
apps/gallery/app/pages/
  index.vue                → Overview（Hero + Foundations + 招牌组合）
  components/index.vue     → 原子组件 catalog（六组 <GalleryEntry>）
  compositions/index.vue   → core 组合陈列（SignupForm 等）
  kits/
    api-docs/
      index.vue            → 该 kit 零件总览（原子 + 组合，小 demo）
      reference.vue        → 页面级完整形态（整屏 chrome，SplitPane 分栏）
```

**三条规则（定死）：**

1. **一个 kit 一个子树**：kit 是"一个领域的整套零件"，占一个目录子树，内部再按粒度分——尊重 kit 内聚。
2. **按需毕业**：一个 kit 默认只有 `index.vue`（零件总览）。只有出现"页面级形态"
   （需整屏布局/chrome 的成品，如 SplitPane API reference）时，才为那个形态毕业出兄弟路由（如 `reference.vue`）。
   没有页面级形态的小 kit 一页搞定，不强行分。
3. **kit 的原子/组合留在自己子树**：不在全局 `components/`、`compositions/` 路由里重复露出。
   全局那两个路由只放 core 的原子/组合；跨 kit 横向对比不作为目标。

**导航自动从路由树派生（不手写导航项）：**

- gallery 本地 composable `useGalleryNav()`：用 `useRouter().getRoutes()` 拿全部路由记录，
  过滤掉动态路由（含 `:`）与显式 `nav: false` 的隐藏页，按 `path` 段折叠成
  `components/` `compositions/` `kits/<name>/` 的嵌套结构。**加一个页面文件 = 自动多一个导航项**，
  删文件则自动消失（隐藏的 playground 用 `nav: false`）。
- 每页可选 `definePageMeta({ nav: { label, icon, order } })` 覆写显示；**排序用 `meta.nav.order`**
  （`getRoutes()` 顺序不保证），缺省从 path 兜底派生 label。不依赖 @nuxt/content。
- 渲染用 `UNavigationMenu`（items 为 `NavigationMenuItem[]`，支持 `type`/`icon`/`badge`/`children`），
  目录层级天然映射为 kit 子树的 `children`。

**移动端用 `UHeader` 内建抽屉（不手写）：**

- 采用 Nuxt UI v4 的 `UHeader`（Pro 已合入公共包）。它按 `lg` 断点内建响应式：桌面导航放 `center` slot
  （`hidden lg:flex`），汉堡 `toggle`（`lg:hidden`）自动切 menu/close 图标，移动浮层 `lg:hidden`。
- `mode="slideover"` 即 USlideover 抽屉（另有 `drawer`/`modal`）；`autoClose` 默认开，路由变化自动收起。
- **一份数据源两处渲染**：桌面把 `useGalleryNav()` items 放进 `center` slot 的 `UNavigationMenu`；
  移动端把同一份 items 以 `orientation="vertical"` 放进 `#body` slot。符合硬规则「响应式用 Nuxt UI 的方式」。

## Story 数据分层（按路由层级分，不是二选一）

铁律先行：**kit 组件只认 ViewModel（`domain.ts` 形状），永不认识私有 spec**——像「文案无关」一样做到「数据格式无关」。
`spec.ts`、`adaptSpec`、fixture **全住 gallery app**（对齐分包纪律：数据/helper 不进 kit）。在这条之上按路由层级分两层：

| 层级 | 数据形态 | 为什么 |
|---|---|---|
| **原子/组件级 story**（`kits/<kit>/index.vue` 逐个 `<GalleryEntry>`） | **内联假 ViewModel** | 自包含、截图稳定；且恰好证明组件只靠 ViewModel 就能跑（不牵扯 adapter） |
| **页面级毕业形态**（`reference.vue` 整屏成品） | **fixture `spec.json` + gallery 本地 adapter** | 整页要真实丰富数据；且这正是消费项目真实要做的端到端链路（spec → 自己的 adapter → ViewModel → 组件），拿真链路演示最诚实 |

两层不矛盾——它们精确对应上面 §「页面组织」的两层路由。无论哪层，**kit 组件始终只见 ViewModel，复用性零损伤**。
