# 工程惯例（Nuxt + Nuxt UI）

geist-nuxt 根目录是 Nuxt 4 gallery / v0 preview；可分发 UI 真源在 `foundation/` 和 `kits/`，通过根 registry copy-in 到消费项目。

## 目录与自动导入

```text
app/                             根 gallery 页面、布局、demo、fixture、adapter
foundation/components/          通用组件
foundation/compositions/        可复用页面组合
foundation/composables/         通用 composables
foundation/utils/               通用 utils
foundation/assets/css/          token / 全局样式
foundation/config/              app / Nuxt UI 配置
kits/<kit>/components/          领域组件
kits/<kit>/composables/         领域 composables
kits/<kit>/utils/               领域 utils
playground/                      未采纳候选
```

根 `nuxt.config.ts` 显式扫描 foundation、kit 与 playground 源目录。消费项目不复制这套扫描配置；`geist:copy` 会按 registry target 将文件放到标准 `app/components`、`app/composables`、`app/utils` 等目录。

根 preview 显式把 `foundation/compositions/SignupForm.vue` 注册为 `<CompositionSignupForm>`；`kits/api-docs/components/FieldItem.vue` 注册为 `<ApiDocsFieldItem>`。copy-in 后的组件名由 registry target（如 `app/components/api-docs/FieldItem.vue`）决定，根目录通用件保持裸名。

## 组件写法

- 一律 `<script setup lang="ts">`，SFC 顺序为 script → template。
- Props 用类型化 `defineProps`；事件用 `defineEmits`；双向绑定优先 `defineModel`。
- Nuxt UI、Vue API 与 Nuxt composables 使用自动导入；类型和第三方库显式 import。
- 用户内容通过 props / slots；结构 chrome 提供合理默认并暴露 label 覆盖。
- i18n module、locale 和 `$t` key 属消费项目；foundation / kit 不绑定具体 i18n 库。

## Foundation 与 kit 边界

- 通用 token、配置、组件和 composable 进入 foundation。
- 只服务一个领域的能力进入对应 kit。
- kit 可依赖 foundation 或同 kit registry item；禁止 kit → kit。
- demo、fixture、adapter、私有 spec 和页面 recipe 留根 `app/` 或消费项目。
- 所有安装 / 更新走根 `registry.json` 与 `geist:*` 工具，不手抄文件。基础 item 名为 `geist-foundation`；copy / update 默认 dry-run，实际修改必须显式传 `--write`。

## 主题与颜色

- 语义别名真源：`foundation/config/`。
- token 真源：`foundation/assets/css/geist.css`。
- 覆盖 token 不放 `@layer`，避免被 Nuxt UI theme layer 覆盖。
- 明暗切换 UI 优先用 `UColorModeButton`；只有读取或编排主题状态时才用 `useColorMode()`。组件使用语义 token，不写死 neutral 数字阶。

## 常见坑

- 组件找不到：检查 registry target 是否保留预期目录前缀，以及 root `nuxt.config.ts` 的 source scan。
- copy-in 后漏依赖：修 owning item 的 `files` / `registryDependencies`，不要在消费项目临时补文件。
- token 不生效：检查 foundation CSS 是否由基础切片安装并接入消费项目。
- 图标不显示：确认 Iconify 名称与对应 collection 依赖。
- 受管文件被业务修改：`geist:check` 会报 drift，`geist:update` 也会在写入或删除前停止整个 batch；在外层组合或先决定是否回流真源。

## 脚本

- 根开发：`pnpm dev`、`pnpm typecheck`、`pnpm build`。
- registry：`pnpm registry:validate`、`pnpm test:registry`、`pnpm geist:copy`、`pnpm geist:update`、`pnpm geist:check`。
- consumer：`pnpm test:consumer`。

版本组合以根 `package.json` / lockfile 为准；改依赖前确认 Nuxt、Nuxt UI、Vue Router 与 VueUse 兼容。
