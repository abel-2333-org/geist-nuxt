# 资源

## Logo / Favicon

- **`public/favicon.svg`** — geist-nuxt 的品牌标记，随根 gallery / v0 snapshot 分发。
  - 在头部/导航用它作为 logo：`<img src="/favicon.svg" alt="" class="size-6" />`（配文字 wordmark `geist-nuxt`）。
  - 也在 `app/app.vue` 的 `useHead({ link: [{ rel: 'icon', ... }] })` 里作为浏览器 favicon 引用。
- 没有其他 logo 变体时，用文字 wordmark（`font-mono font-semibold`）而不是臆造图形。

## 图标

图标通过 Iconify 名称字符串使用，格式 `i-<collection>-<name>`。根项目已装两个集合：

- **UI 图标 → Lucide**：`i-lucide-<name>`（如 `i-lucide-plus`、`i-lucide-settings`、`i-lucide-arrow-right`）。集合：`@iconify-json/lucide`。**默认首选。**
- **品牌图标 → Simple Icons**：`i-simple-icons-<name>`（如 `i-simple-icons-github`、`i-simple-icons-vercel`）。集合：`@iconify-json/simple-icons`。
- 需要新集合时：`pnpm add @iconify-json/<collection>`，再用 `i-<collection>-<name>`。

### 两种用法

**1. 组件的 icon prop**（首选，Nuxt UI 组件普遍支持）：

```vue
<UButton icon="i-lucide-plus">新建</UButton>
<UButton trailing-icon="i-lucide-arrow-right">继续</UButton>
<UInput icon="i-lucide-search" placeholder="搜索" />
<UAlert icon="i-lucide-info" title="提示" />
```

**2. 独立 `UIcon` 组件**（自定义位置）：

```vue
<UIcon name="i-lucide-inbox" class="size-5 text-muted" />
```

- **尺寸**：用 Tailwind `size-*`（如 `size-4`=16px、`size-5`=20px、`size-6`=24px），不要写死 `width`。
- **颜色**：图标默认 `currentColor`，用文本颜色类（`text-muted`、`text-primary`…）着色，不要硬编码。
- **装饰性图标**加 `aria-hidden`；**纯图标按钮**必须有可访问名称（`ThemeToggle` 由 `UColorModeButton` 从根 `UApp` locale 提供）。

### 常见坑

- **动态图标名要用完整字符串**：`:icon="condition ? 'i-lucide-check' : 'i-lucide-x'"`，不能拼接片段（`i-lucide-${x}`），否则 Iconify 静态扫描抓不到、图标不打包。若确需动态集合，参考 Nuxt UI 文档配置 `ui.icons` 或客户端加载。
- **图标不显示**：多半是名字拼错或集合没装。先确认集合在 `package.json`，再核对 Iconify 上的准确名称。

## 规则

- 不要用占位图 / 随机 stock 图；需要图片时用真实资源或 `/placeholder.svg?height=&width=`。
- 品牌色统一走 token，不要在资源里硬编码颜色。
