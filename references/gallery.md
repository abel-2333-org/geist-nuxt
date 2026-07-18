# 根 Gallery 与 Playground

> 根 `app/` 是 Source-first 真源的常驻 gallery，也是 v0 preview。部署地址：
> https://geist-nuxt-gallery.vercel.app

它直接读取 `foundation/`、`kits/` 和 `playground/`，没有 workspace symlink、npm 版本或 layer 发布延迟。gallery 给人和 browser 看真实渲染；AI 的规则真源仍是 `references/` 与 `registry.json`。

## 页面分工

```text
app/pages/
  index.vue                         Overview / Foundations
  components.vue                    foundation 组件 catalog
  compositions.vue                  foundation 组合
  playground.vue                    隐藏的候选设计面
  kits/api-docs/
    index.vue                       API Docs 组件目录
    reference.vue                   页面级完整参考页
    sidebar-nav.vue                 SidebarNav 专项响应式样例
```

- 正式路由只展示已采纳 foundation / kit 资产。
- `/playground` 固定 `definePageMeta({ nav: false })`，只消费 `playground/` 候选。
- 增删正式路由后，导航从 Nuxt route tree 自动派生；不要手写第二份导航表。
- kit 默认一个 `index.vue`；只有出现需要整屏 chrome 的成熟形态才增加兄弟路由。

## Catalog：GalleryEntry + GalleryExample

一个文档标题对应一个 `<GalleryEntry>`，内部按 facet 分 `<GalleryExample>`：

```vue
<GalleryEntry
  name="UButton"
  description="触发一个即时动作。"
  usage-href="https://github.com/abel-2333-org/geist-nuxt/blob/main/references/components/buttons.md#ubutton"
>
  <GalleryExample label="Variants">
    <UButton>Primary</UButton>
    <UButton variant="outline">Outline</UButton>
  </GalleryExample>
</GalleryEntry>
```

- `GalleryEntry`：名称、简述、可选 Usage 链接。
- `GalleryExample`：一个真实 facet；`row` 适合按钮 / badge，`stack` 适合 alert / card，`grid` 适合响应式对照。
- 源码在 `app/components/gallery/`，由根 app 自动导入。
- 不贴源码字符串或手写 props 表；源码与 references 已是权威，gallery 只补真实视觉。

## Story 数据分层

foundation / kit 只认通用 props 或 ViewModel，不认识私有 spec。展示数据按页面粒度分层：

| 层级 | 数据形态 | 位置 |
|---|---|---|
| 原子 / 组件 story | 内联假 ViewModel，稳定、自包含 | 对应正式 page |
| 页面级组合 | fixture + 根 app 私有 adapter | `app/` 内的 demo / fixture / adapter |
| 候选设计 | 针对本轮状态矩阵的草稿数据 | `playground/` |

私有 DSL、adapter、fixture 不进入 `foundation/`、`kits/` 或 `registry.json`。

## Gallery-private recipe

只服务一个 gallery 页面、又不该分发的组件放 `app/components/demo/<kit>/`。例如：

```text
app/components/demo/api-docs/CodeRail.vue
```

`<DemoApiDocsCodeRail>` 负责 API reference 页 Request / Response 的纵向分配与内容优先重分配。它是数据无关的页面 recipe 范例，但只有 gallery 一个真实消费者，因此：

- 不进入 `foundation/`；
- 不进入 `kits/api-docs/`；
- 不进入根 `registry.json`；
- 下游需要时在自己的页面层 copy & adapt，不把它误升为系统组件。

## 自动导航与移动端

根 app 的 `useGalleryNav()` 从 `useRouter().getRoutes()` 取路由：

- 过滤动态路由与 `nav: false`；
- 顶层页面直接显示；
- `kits/<name>/**` 折成 kit 子树；
- `meta.nav.order` 决定稳定排序。

`UHeader mode="slideover"` 使用同一 items 数据渲染桌面 `UNavigationMenu` 与移动端纵向菜单；不要另写移动抽屉或 media query。

## Playground 验证矩阵

候选默认放 `playground/`，由 `/playground` 展示。根据组件实际能力覆盖：

- default / hover / focus-visible / disabled；
- loading / empty / error；
- 长文本、中英文宽度、真实高密度数据；
- light / dark；
- 390×844、960×900、1440×1000；涉及 `lg` 切换时检查 960 / 961px；
- 键盘、可访问名、console errors。

浏览器验证应交付本地 URL、关键截图、已验证状态和残余风险。HMR 只证明刷新链路，不能替代状态与响应式检查。

## 明暗与响应式

- ThemeToggle 只通过 `useColorMode()` 切换；story 使用语义 token。
- 移动优先，使用系统断点和 Nuxt UI primitive。
- 连续、内容相关的溢出不要硬猜断点；使用 `ResizeObserver` + 隐藏测量层，规则见 `foundations/responsiveness.md`。

## 晋升收尾

采纳一个候选时同时完成：

1. 移动到 `foundation/` 或 `kits/`；
2. 更新根 `registry.json`；
3. 加正式 gallery；
4. 更新对应 references；
5. 删除或清空 playground 草稿；
6. 运行 root + registry + consumer gate。

完整 checklist 见 `method/component-reflow.md`。
