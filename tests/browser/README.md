# 文字对比度回归

这些用例验证 #144 的中性文字契约与有限伴随修复。#147 的功能色 F1–F9 仍独立跟踪并阻止 #140 关闭；本套测试不是整页 WCAG 合规声明。

## 构建与执行

```sh
pnpm install --frozen-lockfile
pnpm exec playwright-core install --no-shell chromium
pnpm test:registry
pnpm typecheck
pnpm build
pnpm build:contrast
pnpm test:browser
```

`vitest.browser.config.ts` 是独立 Node 配置，不继承 Nuxt runtime 组件配置，不调用 `mountSuspended`。`@nuxt/test-utils/e2e` 启动本地生产 Nitro 和锁定的 Chromium；`build:false` 显式指向 `.output/contrast`。空测试集、缺构建、源码摘要或 HEAD 不匹配、启动失败均阻断。摘要同时覆盖生产源码、fixture、`tests/browser/`、浏览器配置和颜色计算依赖；测量器变化也必须重新构建，不能沿用旧检测器的来源标记。

`build:contrast` 使用根 Nuxt 配置、真实 foundation CSS/config 和 kit 组件，单独添加 `/__contrast` 路由及 fixture 扫描入口。fixture 在 `tests/fixtures/contrast/`，通过 `tests/nuxt/contrast-fixture.ts` 接入已有类型检查；不进入 registry，也不注册到正常 gallery 构建。正常页面的实际回归仍使用三个已有 API Docs 路由。

上述隔离指运行时注册与 registry copy-in。现行 Source-first 完整根源码 snapshot 仍包含测试和 fixture 源文件；截图、trace 和日志位于被排除的构建产物目录。若要求 release/v0 snapshot 也移除 fixture，需要单独决定分发边界，不能仅删除 fixture 而留下失效的测试命令和类型入口。

CI 保留原有三个 required check 名称，浏览器步骤位于 `Verify Source-first root` 的正常 build 之后。结果、原始颜色、合成层、状态、源码 SHA/digest、实际字体、截图和 trace 写入 `.output/contrast-artifacts/` 并上传 artifact；`.output` 不进入 Source-first 发布包。可用 `GEIST_CONTRAST_ARTIFACTS` 指定独立证据目录。

## 场景与归属

| 场景 | 源码/路由 | 必测节点与触发 |
| --- | --- | --- |
| 40 个完整配对 | foundation CSS；`/__contrast` | 每主题五种 `[data-token]` × 四种 `[data-surface]`，20 个唯一非空组合 |
| 五类 solid / 非 solid | foundation app config；ContainerVariants fixture | Card、Empty、PageCTA、PageCard 的 description；PricingPlan 的 description、discount、billingCycle、billingPeriod、featureTitle、tagline、terms。所有真实 variant、默认省略 variant，以及 Card 具名 slot；PageCard 卡片 hover 与链接 focus |
| 表单 | FormVariants fixture | Input/Textarea/InputMenu 的真实 `::placeholder`，五种 variant 的 idle/hover/focus；Input/Textarea readonly 值；Select/SelectMenu placeholder 与 open portal 选项及搜索；FormField props/slots 的 description/hint/help；neutral Alert opacity-90 |
| 计数与展开 | FieldItem、EnumTable、internal/FieldValueStructure；DocumentationStates fixture | `field-count`、`enum-count` 的 `(2)`；`field-expand`、`value-expand` 的展开动词 idle、真 hover、展开后 hover |
| 选择与到达高亮 | Nuxt UI Tabs、FieldItem/useFieldAnchor；`/__contrast` | 两个 tab 分别选中并 focus；记录 indicator 几何、颜色和层叠。真实 `goTo` 触发 arrival，通过浏览器 computed progress 定位原动画的 opacity 峰值，不替换 easing |
| 浮层 | OverlayDescriptions fixture | 打开 Modal、Slideover、Popover、Tooltip、DropdownMenu，读取 portal 中非空 description |
| API Docs 回归 | `/kits/api-docs`、`/kits/api-docs/endpoint-reference`、`/kits/api-docs/webhook-reference` | 可见 type/shape wire type、FieldGroup count、Constraint/Since；参考页 legend；Webhook 先展开 `payload_data` 再测 `?` hover/focus；390px 与1440px截图 |

所有以上场景均执行 light/dark。零节点、隐藏/空文字、状态未触发、未知绘制层均失败。真正 disabled 不是这些正常文字样本；readonly、placeholder、未选中和可见 `aria-hidden` 信息没有自动豁免。

## 计算边界与负向证据

Node checker 只解释生产 token 所需的明确 CSS 子集，读取真实 CSS 变量依赖；条件覆盖、未知选择器、缺失或循环变量、fallback、非法/超范围颜色及非 CSS 空白明确拒绝。它不是通用 CSS cascade 引擎。消费者验证同样读取实际复制到 consumer 的 CSS。

浏览器使用 computed style，并由 Chromium 的相对颜色序列化转为浮点 sRGB；不对截图抗锯齿边缘取色，也不先量化为 8-bit 像素。测量合成背景和祖先 opacity，针对已验证结构处理 Tabs indicator、arrival cue、portal item 的 `::before`，核对几何与层叠。零偏移/零模糊的 inset ring 只有完全位于文字区域之外才可排除；未知渐变、滤镜、mask、混合模式、伪元素或重叠层不默认通过。判定直接使用未舍入 ratio >= 4.5。

F-01 回归递归检查兄弟子树，透明或零尺寸包装不能遮蔽其中的绘制节点。DOM 靠前不能作为遮挡排除依据：只有可比较的 positioned stacking context、其中完全覆盖文字的不透明表面及明确更低的绘制顺序共同成立，才记录 `excludedPaint` 并排除该层。`display:contents` 不能被当作有盒子的层叠上下文；原生 modal/popover top layer 暂未建模，出现时显式 `unresolved`。反例及正常对照保留实际几何、颜色、层叠和拒绝原因；它们证明检测器拒绝未知绘制，不代替完整正向命令的源码变异红→绿证据。

常规 CI 的四个 alpha 负向样本在独立场景恢复旧声明，证明检测器捕获失败，然后恢复并重新验证。外层测试绿色仅表示检测器工作；不能称为正向命令已经跑红。

首次实施另在已提交且 clean 的 HEAD 执行：

```sh
node scripts/verify-contrast-mutations.mjs --artifacts /absolute/external/evidence-directory
```

该脚本保留独立源码副本，依次执行 A 正向、旧 token、两个独立 count `/70`、两个独立 hover `/75`、恢复 A。每次重新构建，运行同一完整 `pnpm test:browser`；旧 token 另执行同一 Node 测试。必须是指定 owner/状态的实际对比度断言失败才能认定有效红；启动、零节点、超时或 unresolved 均不算。输出保留 diff/hash、功能 SHA、每步命令/退出码、原始测量和截图；变异副本不冒称 clean SHA。

截图使用浏览器实际渲染的字体；报告同时保留 FontFace 状态与 Chromium `CSS.getPlatformFontsForNode` 的字体 readback。维护者视觉验收独立于数值门禁。
