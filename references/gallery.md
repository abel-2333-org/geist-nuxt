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
- 页面组织（分区/导航/路由）目前是单页竖排，待条目变多后再定，不提前抽象。
