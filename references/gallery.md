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
  usage-href="https://ui.nuxt.com/components/button"  <!-- 指向权威用法，不复制 -->
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
  可选 `usageHref`（右上角 Usage 链接，指向 references 或 Nuxt UI 文档）+ 可选 `usageLabel`
  （链接文案，默认 "Usage"，可覆盖做本地化）。
- **GalleryExample**：一个带标签的实例块。`label` 是小号大写标签（Variants / Sizes /
  States / With icon…），下面摆该 facet 的**真实组件实例**。`layout` 控制排列：
  `row`（行内换行，按钮/徽标，默认）/ `stack`（竖排，警告/卡片等块级组件）/ `grid`（响应式两列）。
- 两者都在 `apps/gallery/app/components/gallery/`，Nuxt 自动导入，无需 import。

## 往画廊加组件条目

1. 打开示范 section `apps/gallery/app/components/sections/GalleryCatalog.vue`（或按分区新建 section）。
2. 加一个 `<GalleryEntry>`，填 name / description / usageHref。
3. 按 facet（变体、尺寸、状态、带图标…）拆成多个 `<GalleryExample>`，每块摆真实实例；
   块级组件（Alert/Card 等）用 `layout="stack"`。
4. 用真实 token、占位示例值；明暗模式都要成立（别写死颜色）。
5. **不要**在条目里贴源码字符串或手写 props 表——用 usageHref 指出去。

## 边界

- gallery 只增删条目/section，**不改** core、kit 的组件源码。
- core 组件的默认预览展示走 core 里的 `ShowcaseComponents`（轻量一览），
  与 gallery 的 GalleryEntry（可摆更多、带 facet 标签）是同物种、不同繁简度，各司其职。
- 页面组织（分区/导航/路由）目前是单页竖排，待条目变多后再定，不提前抽象。
