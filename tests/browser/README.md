# 浏览器回归

两套回归共用锁定的 `playwright-core` 与 Chromium，分别验证文字对比度和 API Docs 层级行为。

- [文字对比度回归](#文字对比度回归)：`pnpm test:browser`，使用独立 contrast 构建。
- [API Docs 层级浏览器回归](#api-docs-层级浏览器回归)：`pnpm test:browser:hierarchy`，使用正常 gallery 生产构建。

## 文字对比度回归

这些用例保留 #144 的中性文字契约与 #148 的绘制、focus/motion 回归，并加入 #147 功能色 F1–F9、真实消费者与动态状态证据。各自的来源、数值、反例和验收边界独立记录；浏览器通过不代替视觉或 owner 验收，本套测试不是整页 WCAG 合规声明。

### 构建与执行

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

`build:contrast` 使用根 Nuxt 配置、真实 foundation CSS/config 和 kit 组件，单独添加 `/__contrast` 与 `/__functional-contrast` 测试路由及 fixture 扫描入口。fixture 在 `tests/fixtures/contrast/`，通过 `tests/nuxt/contrast-fixture.ts` 接入已有类型检查；不进入 registry，也不注册到正常 gallery 构建。正常页面的实际回归仍使用三个已有 API Docs 路由。

按 [源码快照与 runtime 边界](../../references/maintenance/sync.md#源码快照与-runtime-边界)，release / v0 完整根源码 snapshot 保留测试和 fixture 源文件，供接收方复现验证；上述隔离约束正常 gallery 的运行时注册与 registry copy-in。测试截图、trace 和日志保存在被排除的构建产物目录或仓库外部证据目录，不进入源码快照。

CI 保留原有三个 required check 名称，浏览器步骤位于 `Verify Source-first root` 的正常 build 之后。结果、原始颜色、合成层、状态、源码 SHA/digest、实际字体、截图和 trace 写入 `.output/contrast-artifacts/` 并上传 artifact；`.output` 不进入 Source-first 发布包。可用 `GEIST_CONTRAST_ARTIFACTS` 指定独立证据目录。

### 场景与归属

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

### 计算边界与负向证据

Node checker 只解释生产 token 所需的明确 CSS 子集，读取真实 CSS 变量依赖；条件覆盖、未知选择器、缺失或循环变量、fallback、非法/超范围颜色及非 CSS 空白明确拒绝。它不是通用 CSS cascade 引擎。整合层级样式后，仅额外识别 `@utility subtree` 的已知结构声明及其具名容器步进；不会泛化放行未知 utility、嵌套 token 覆盖或文字颜色/透明度声明。消费者验证同样读取实际复制到 consumer 的 CSS。

浏览器使用 computed style，并由 Chromium 的相对颜色序列化转为浮点 sRGB；不对截图抗锯齿边缘取色，也不先量化为 8-bit 像素。测量合成背景和祖先 opacity，针对已验证结构处理 Tabs indicator、arrival cue、portal item 的 `::before`，核对几何与层叠。零偏移/零模糊的 inset ring 只有完全位于文字区域之外才可排除；未知渐变、滤镜、mask、混合模式、伪元素或重叠层不默认通过。判定直接使用未舍入 ratio >= 4.5。

F-01 回归递归检查兄弟子树，透明或零尺寸包装不能遮蔽其中的绘制节点；在宿主几何跳过之前检查伪元素，宿主不重叠也不能证明生成内容无影响。DOM 靠前不能作为遮挡排除依据：只有可比较的 positioned / isolation stacking context、其中完全覆盖文字的不透明表面及明确更低的绘制顺序共同成立，才记录 `excludedPaint` 并排除该层。`display:contents` 不能被当作有盒子的层叠上下文；原生 modal/popover top layer 暂未建模，出现时显式 `unresolved`。文字 Range 按可证明的矩形 overflow 裁切求交，不以像素容差忽略重叠；无法证明包含关系的脱离文档流或变换路径保留较大的保守范围。反例及正常对照保留实际几何、颜色、层叠和拒绝原因；它们证明检测器拒绝未知绘制，不代替完整正向命令的源码变异红→绿证据。

F-02 将普通有色边框作为独立绘制检查：只在已证明边条和圆角保守区域不接触文字时排除；多片 inline 边框或变换下无法确认的几何明确拒绝。外扩绘制在宿主零尺寸/不相交判断之前检查；文字完全处于单片投影宿主的边框形状内部时可排除外阴影；其他外阴影只在以下已核验引擎和几何前提内使用保守绘制范围。未知引擎、变换阴影、outline、border-image、border-shape 与滤镜不靠宿主矩形猜测范围；不能证明安全时返回 `unresolved`。`visibility:hidden` 不豁免父层作用于可见子层的滤镜。明暗反例覆盖边框、远处投影、零尺寸 spread、多片边框和隐藏父层滤镜，并保留无遮挡、分离、薄边框、移除及恢复对照。

外阴影范围当前绑定 CDP `Browser.getVersion` 的 `Chrome/153.0.8010.12` / `@971a7443b0c9b0a9b2860529b33331b76077ec62`，并要求 DPR 1、visual viewport scale 1、单片盒子、普通 border shape 及祖先无 zoom / scale / rotate / perspective；transform 仅接受 Typed OM 的实际矩阵可证明线性部分为单位矩阵且 e/f 为安全整数的二维平移。individual translate 不从 CSS 字符串推断整数对齐。非零轴默认未知；只有整个祖先链均为静态普通 HTML、opacity 1、normal blend、无 filter/backdrop/mask/clip/overflow 裁切/contain/will-change、无动画或活动 view transition、坐标绝对值小于 `2^18` 时，才用已含真实位移的 DOMRect 加 `2*n+1` 像素外包围（n 为整条祖先链长度）：每层保留一像素 enclosing/AA 和一像素 bilinear，末尾再留一像素最终 quad；记录 `translationOutset`。这包住多层分数平移，不声称每个平移都是整数。缺少这些证明的非零轴仍标为无限；两轴均未知或非零 z 位移时拒绝。整数 transform 平移在 DPR 1 下保持像素相位，DOMRect 已含该平移，不重复加到阴影偏移；computed matrix 字符串的舍入不能作为单位矩阵证明。平移造成的层叠上下文仍按原规则判断，不能因为几何排除而忽略。zoom 使用每层 `currentCSSZoom === 1` 的数值证明，不能只信可能舍入为 `1` 的 CSS 字符串。实际身份随测量记录保留；引擎升级必须重新核验，未匹配时不会沿用旧证明。该 revision 的 [ShadowData](https://github.com/chromium/chromium/blob/971a7443b0c9b0a9b2860529b33331b76077ec62/third_party/blink/renderer/core/style/shadow_data.h) 使用 `sigma = blur / 2`，[绘制外扩](https://github.com/chromium/chromium/blob/971a7443b0c9b0a9b2860529b33331b76077ec62/third_party/blink/renderer/core/style/shadow_data.cc)为 `ceil(3 * sigma) + spread`。测量器先包住 computed CSS 六位有效数字的序列化误差，再按 float 运算求外扩；负 spread 保守取零，范围保留一像素的宿主对齐余量并 floor/ceil。只有某轴的宿主两边、单片祖先原点、滚动与已证整数矩阵位移全在整数像素上且绝对值小于 `2^18` 时，该轴宿主对齐是恒等，可省去这一个余量；参数精度区间和最终向外 floor/ceil 均保留。记录同时包含该轴的实际 snap margin。此处只扩大可能绘制区域，不用容差忽略重叠，也不由截图猜测模糊截止。只在该范围与文字不相交时排除，并记录 `excludedPaint` 的原因、阴影及范围。源码链和定向边界证据随本轮 F-02 补证保存。

普通 `filter` 仍按可能扩展到子层的绘制处理；`backdrop-filter` 则按 [Filter Effects 2 的处理顺序](https://drafts.csswg.org/filter-effects-2/#backdrop-filter-operation)裁切在元素 border box 内。在同一有限几何模型中，仅当向外包围后的边框范围不接触文字时排除背景滤镜，继续检查子树；后续 `filter` 不因该裁切获得豁免。

外阴影内部裁切依据 [CSS Backgrounds and Borders](https://www.w3.org/TR/css-backgrounds-3/#shadow-shape)；outline 的形状可能受后代影响，按 [CSS UI](https://www.w3.org/TR/css-ui-4/#outline-props) 保持未建模拒绝，不能把宿主矩形当作其完整绘制边界。

常规 CI 的四个 alpha 负向样本在独立场景恢复旧声明，证明检测器捕获失败，然后恢复并重新验证。外层测试绿色仅表示检测器工作；不能称为正向命令已经跑红。

首次实施另在已提交且 clean 的 HEAD 执行：

```sh
node scripts/verify-contrast-mutations.mjs --artifacts /absolute/external/evidence-directory
```

该脚本保留独立源码副本，依次执行 A 正向、旧 token、两个独立 count `/70`、两个独立 hover `/75`、恢复 A。每次重新构建，运行同一完整 `pnpm test:browser`；旧 token 另执行同一 Node 测试。必须是指定 owner/状态的实际对比度断言失败才能认定有效红；启动、零节点、超时或 unresolved 均不算。输出保留 diff/hash、功能 SHA、每步命令/退出码、原始测量和截图；变异副本不冒称 clean SHA。

截图使用浏览器实际渲染的字体；报告同时保留 FontFace 状态与 Chromium `CSS.getPlatformFontsForNode` 的字体 readback。维护者视觉验收独立于数值门禁。

文字区域默认保留 DOM Range 的字体高度。为避免把字体留白当作字形，只对同一已核验 Chromium、DPR 1、无变换、独立 inline-block/flow-root 中的单个普通 ASCII 字符启用字形上边界证明：单文本节点、单片 Range、normal 字体特性、Typed OM 数值字号/400 字重/100% 字宽、已加载且唯一匹配字符的普通首选 FontFace，并拒绝 metric overrides、variation/variant、非默认 baseline/text-fit/text-box、首行/首字形字体差异、装饰、强调、描边和 text shadow。Canvas 与 DOM 使用相同字体链，并显式对齐目标的已声明语言与 ltr 方向；未知语言、xml:lang 或 font-language-override 回退原 Range。此 revision 的 [DOM 绘制 baseline](https://github.com/chromium/chromium/blob/971a7443b0c9b0a9b2860529b33331b76077ec62/third_party/blink/renderer/core/paint/text_fragment_painter.cc#L529) 使用整数 ascent，而 [Canvas TextMetrics](https://github.com/chromium/chromium/blob/971a7443b0c9b0a9b2860529b33331b76077ec62/third_party/blink/renderer/core/html/canvas/text_metrics.cc#L132) 使用 float ascent。因此上边界为 `floor(range.top + fontBoundingBoxAscent - actualBoundingBoxAscent - 0.5 - 1)`，其中 0.5 包围 ascent 舍入、1 包围字形栅格化；只在不超过原 Range 时提高 top，不收紧左右或 bottom。任何条件无法证明都回退到原 Range，重叠仍 `unresolved`。每条记录保存原 Range、实际使用范围及字形度量。此路径不改变阴影范围、对比度计算或 Tooltip 的真实开关状态；字形源码链与定向反例随 F-02 证据保存。

普通非 auto outline 仅在同一引擎、DPR 与有限变换前提下，对显式非 inline 的单片 HTML 盒子使用宿主范围加 `widthUpper + max(0, offsetUpper)` 的外扩，再保留宿主对齐及 floor/ceil 余量。该 revision 的普通轮廓不纳入 block 后代 ink；auto 轮廓、inline、多片或未知几何仍阻断。负 offset 不用来缩小范围。实际远处焦点轮廓可据此排除，移到字形上的轮廓必须 unresolved；不关闭已有焦点状态。

F-03 单独检查 `::before` / `::after` 的 computed outline；宿主的 outline 检查不能覆盖生成内容。伪元素缺少可直接读取的 DOMRect，outline 又可伸出其盒子，因此普通可见 outline 与 `auto` outline 在空绘制和盒子不相交两条早退之前显式 `unresolved`，不沿用宿主几何排除。普通透明、零宽或未生成的 outline 仍按无绘制处理；`auto` 不获得透明/零宽豁免。明暗测试分别以透明 `::before` 和有背景但盒子分离的 `::after` 复现两条路径，保存无遮挡、透明、零宽、覆盖与移除恢复的几何、测量和截图。

gallery 的 `?` hover/focus 样本等待实际 trigger 打开、对应 Tooltip 可见、入场动画及按钮自身颜色过渡结束，再测稳定态文字；不以固定延迟假定 Tooltip 已打开，也不关闭真实浮层或捕获 `unresolved` 重试。就绪 sidecar 保存两侧动画计数、浮层 opacity / transform 与状态，它只证明采样状态，随后仍由原始测量与完整命令判断对比度。

`optional-trigger-motion.spec.ts` 在真实键盘输入前开始观察 `?`，独立覆盖明暗主题、普通与 reduced motion、无 hover 的 Tab 进入/退出、hover 与 focus 交叠及快速反向切换。它记录 computed transition 配置、实际颜色 transition 事件、运行中的相关动画和每个恢复端点的颜色合成；不会等 `optionalTooltipReady()` 返回才开始观察，也不以少量中间帧代替无颜色插值的证明。Tooltip 自身入场动画继续运行，稳定端点仍须通过原测量器。此处承接 #148 的具体 trigger 过渡问题，#147 其余功能色及 owner 未决范围保持独立。

## API Docs 层级浏览器回归

从当前 checkout 构建并启动 gallery，然后在另一终端执行：

```sh
pnpm install --frozen-lockfile
pnpm exec playwright-core install --no-shell chromium
pnpm build
PORT=3015 HOST=127.0.0.1 node .output/server/index.mjs
```

```sh
BASE_URL=http://127.0.0.1:3015 pnpm test:browser:hierarchy
```

`BASE_URL` 必须指向同一 checkout 的运行实例。脚本记录的是执行目录 Git HEAD；它不能从任意远程 URL 证明部署来源。开发模式可用于调试，最终验收使用生产构建。CI 在 build 后运行并上传 `hierarchy-browser-<SHA>` artifact（保留 30 天）；PR 事件的 SHA 为 synthetic merge SHA，应结合该次 run 的 PR head 阅读。

输出在 `output/playwright/pr153/`：独立 PNG 截图与 `report.json`（HEAD、Chromium 版本、ARIA 生命周期、测量与断言结果）。运行失败也写报告；先确认 `status`，不要把已有截图当作成功结果。输出默认不入 Git，可用 `EVIDENCE_DIR` 指定独立目录，避免覆盖上一次结果。

覆盖范围以脚本断言和报告为准：真实 Tab / Enter / Space、焦点环、折叠目标显隐、重复深链接、浏览器 arrival cue、明暗 × 1024/375/320 布局，以及 compact 长记号压力样例。长记号通过明确的 DOM 替换构造，仅证明当前样式的换行能力，不等于作者 fixture 的渲染测试。

SSR 通过禁用 JavaScript 的独立浏览器 context 读取；客户端阶段另等 Nuxt hydration 完成。`aria-controls` 初始空值只作观测，不固化为必须保持的行为。隐藏属性、焦点行为与辅助技术树不是同一层证据。本脚本不代表 VoiceOver/NVDA 实测、不代替人工视觉采纳，也不验证真实消费项目安装。历史截图和旧 agent 的通过记录不是本次输出。

### PR #153 补验：稳态、真实 fixture 与成对基线

`hierarchy-evidence.mjs` 等字体就绪和正常有限动画结束后，再量选中 tab、可见 panel 与 indicator 的最终几何；未关闭生产动画。焦点截图在按钮周围留出空间，不能用按钮裁剪图证明外侧 outline 未被遮挡。

```sh
pnpm test:browser:hierarchy-pair
```

该命令创建临时 detached worktree，默认基线为整合 main `19a107527d1226585611f4547619320b430fab2a`（可用 `BASELINE_SHA` 指定），把同一测试 harness 覆盖到基线，分别构建两侧真实生产组件与隔离 `/__hierarchy` 路由。它不改两侧生产源码，结束后清理临时 worktree/服务。两侧必须有各自锁定依赖；Nuxt 字体 URL 缓存可复用。固定历史基线的 CI 步骤仅用于 PR #153，不加入未来所有 PR/main 的永久构建成本。

默认输出 `output/playwright/pr153/supplement/`，可用 `EVIDENCE_DIR` 指定绝对输出目录：

- `head-fixture/`、`base-fixture/`：同一 fixture 的 light/dark × 1440/375/320 截图、content-box 与 padding；桌面同时覆盖 383/384/385px 的 field 容器，字段与页面 composition 两入口，以及 anyOf 内部嵌套 composition。长 notation 通过真实 FieldValueNode props 渲染。
- `head-focus/`、`base-focus/`：正常动画下逐帧/键盘事件、焦点与祖先裁剪几何、前后视口图。快速 Tab 必须实测落在关闭动画内，否则报告 coverage-gap 并失败。祖先关闭使用原生 `HTMLButtonElement.click()` 激活现有 handler，保留内部焦点；它是程序化激活，不代表界面存在祖先关闭快捷键。
- `focus-comparison.json`：配对分类。基线继承的问题记录为 `inherited-finding-not-fixed`；新增不可见焦点及新增稳态隐藏焦点失败。`verified-with-inherited-findings` 不等于焦点验收通过，也不授权实现 PR B。
- `paired/`：refunds、extra、txn、composition 的同数据/主题/视口/展开状态前后图。实际渲染文字摘要必须一致；差异代表布局变化，不能混入不同 fixture。
- `head-source.json`、`base-source.json`：生产 SHA 与包含测试 harness 的源码 digest。基线是主线生产源码加同一测试 harness，不能把 harness 说成历史主线自带的文件。

单独调试可先 `pnpm build:hierarchy`，运行 `.output/hierarchy/server/index.mjs`，再通过 `BASE_URL` 执行 `test:browser:hierarchy-fixture`。基线 fixture 的 `REPORT_ONLY=1` 仅记录已预期的旧样式差异；head 使用严格断言。正式证据应使用未改动的最终 HEAD 重新构建，不复用调试期报告。

### PR153 V2 正向焦点门禁

`HEAD_STRICT=1 BASE_URL=http://127.0.0.1:3017 pnpm test:browser:hierarchy-focus` 保留六个历史归因场景，并增加三入口 × 正常/减少动画 × 快速 Tab、内部焦点关闭、外部焦点关闭、快速重开。`verify-hierarchy-pair.sh` 强制 HEAD 严格通过；基线仍记录原始失败。JSON 包含逐帧/事件焦点与裁剪、动画状态，严格场景另存截图。复制锚点自身的淡入仅在可见几何、focus-visible outline、真实 opacity 向 1 的 CSS transition 同时成立时单独记录；关闭区域、BODY 和完全裁剪始终失败，稳态仍须可见。

`BASE_URL=http://127.0.0.1:3017 node tests/browser/hierarchy-discovery.mjs` 验证真实片段 `beforematch`、区域根焦点及嵌套同时关闭；`DISCOVERY_ONLY=1` 只跑基线可发现性对照。`window.find` 是单列观察结果，不替代 Chrome 查找界面验收，也不以脚本总体 passed 宣称 Find 通过。

快速反向场景由真实 Space 关闭、浏览器内下一帧程序化 `HTMLButtonElement.click()` 重开，记录当时退出动画确实 running，避免驱动往返耗尽窗口。之后立即真实 Tab，整个展开过程仍断言无完全裁剪/隐藏/退出内容焦点或 BODY；动画稳态后再验证后代可 Tab。展开时的几何限制是维护者补充授权的行为修复，不以等待代替即时探针。

## #147 生成内容绘制测量

#147 的 required marker 通过 `measure(label, '::after')` 单独测量。只有出现可见单星号或下述多行文本候选，并且同步读取明确缺少几何证据时，外层才进入 Chromium [`DOMSnapshot.captureSnapshot`](https://chromedevtools.github.io/devtools-protocol/tot/DOMSnapshot/#method-captureSnapshot)；其他普通文字不做全页快照，不缓存动态绘制。证据必须指向实际伪元素的唯一 generated textBox，文字确为 `*`，并保留 backendNodeId、computed style、宿主位置与 `CSS.getPlatformFontsForNode` readback。快照前安装 document subtree MutationObserver，并持续监听滚动、resize、资源、字体和动画事件；CSS CDP session 保持到同步测量后，捕获 stylesheet/CSSOM 与 fontsUpdated 变化。最终同步读取前检查未消费的 mutation records，以及 viewport、各元素几何/滚动、图片尺寸和字体集合状态；立即断开页面观察，避免将测量器自己的隐藏颜色解析节点计入变化。结束后第二次快照须完全一致，且 CDP 变化计数为零；第二次快照仅作补充，不能代替拒绝“修改后恢复”的事件计数。缺失、多片、不稳定或任何变化均 unresolved，不重试恢复成通过。同步读取仍逐项核对伪元素样式、宿主几何、字体/动画状态。仅支持同一已核验引擎与 DPR 下、无变换和外扩绘制的普通 inline 星号。保留整个真实 textBox，并用相同字体 Canvas ink metrics 向外扩展可能的 overhang；Canvas.lang 必须与最近声明的 DOM lang 及实际 `-webkit-locale` 一致，未知语言、xml:lang 和 font-language-override 拒绝，不以相同 advance/行高推断字形相同。保留 baseline 0.5px 与 raster 1px 余量；不以 label 正文 Range 代替星号。轮廓继续先执行 F-03 拒绝；`-webkit-text-fill-color` 必须等于实际 color，其他文字填充与 text-security、shadow、描边、装饰、斜体、字体特性等未支持路径仍 unresolved。required+error 只在星号的保守绘制范围不碰 error 文字时排除星号。

SidebarNav 的 stretched link 背景仅在实际结构满足受限 CSS 绘制顺序时参与合成：同一 relative 的 block/list-item/flow-root 容器内，直接 absolute `<a>` 仅含注释、严格零长度 Text 或无子节点，位于具有真实单盒的 relative 内容分支之前；任何非空 Text（包括空白）及元素子节点、flex/grid 共同父布局和 display:contents 内容分支均拒绝。二者 z-index auto、opacity 1，被测文字到共同父节点之间不产生独立 stacking context，且无额外 transform、isolation、contain、will-change 等层叠条件。链接背景必须完整覆盖被测文字、圆角透明区不触及文字，并继续经过原有伪元素、border、shadow、outline、filter 检查。组件名、class 或 aria-current 均不构成放行条件。记录 `absolute-link-underlay` 的实际颜色、透明度与几何；顺序、层级、覆盖或内容变化必须重新证明。


多行正文与前缀之间的文本冲突保留原 Range union 作为默认拒绝范围。唯一新增排除路径限于同父、单 Text 节点的普通静态 inline、horizontal LTR、单空格分词 ASCII；目标须真实多行。复用上述 CDP freshness guard，读取实际 `layout.text`（含浏览器完成的 uppercase/locale 转换）、textBox start/length/bounds 和唯一实际 custom platform font。每个 textBox 必须与完整 Range 的对应片段及该源子串的单片 Range 精确相等；只允许折行处省略一个 ASCII 空格，而且其 live Range 必须是位于相邻行端点的一个或两个零宽 caret 框。不能 trim、猜测断行或把普通 fragment 当成全部墨迹。唯一匹配的已加载 FontFace 须完整覆盖渲染串、字重/字宽匹配且无 metric/feature/variation overrides，CDP glyphCount 须等于渲染片段总字符数；系统字体、fallback、多字体、连字等不明路径拒绝。Canvas 明确同步并回读语言、字体、字距、kerning、stretch、direction 等属性，advance/字体高度须匹配；每行保留完整原框，再向四边扩到实际 ink，并加 baseline 0.5px/raster 1px。双方全部墨迹包络确实分离才排除 sibling text，记录 `outside verified CDP text ink fragments`。未知 spacing、justify、字体特性、装饰、first-line/first-letter 或文字填充等回退拒绝。背景、伪元素、边框、阴影、outline 等仍检查原 union，不使用该排除证明。

`generated-paint.spec.ts` 独立执行明暗控制：真实生成星号的正常、低对比数值、文字填充色、外扩绘制、斜体、多字符、正文/error重叠、未知/xml语言、移除恢复；以及绝对背景的正常、前置高层、后置顺序、flex/grid重排、无盒分支、纯注释/严格零长度Text对照、空白/非空Text与空元素拒绝、局部覆盖、圆角、变换、附加内容与移除恢复。最小自制 [locale 字体](../fixtures/contrast/generated-paint-locale/README.md) 保留相同 advance/垂直 metrics 的语言相关越界字形：英语分离通过、土耳其语真实覆盖拒绝，再移除/恢复；字体与生成源均进入源码摘要，不用于生产。多行控制另保留同父普通 inline 的英文正控、土耳其语双方 ink 越 advance 的真实覆盖反例、移除恢复、首/次行覆盖、union 空隙中的背景/outline/shadow、未知 font/shaping/spacing/空白与 DOM/CSSOM 改后恢复。快照竞争控制在真实 DOMSnapshot 返回后修改真实页面：newline 移动星号、DOM 改后恢复、CSSOM 改后恢复、FontFaceSet 改后恢复都必须拒绝；普通非竞争、fresh overlap 与恢复另记。每次保存 computed style、几何、测量/拒绝、截图与 trace。F-01/F-02/F-03 原有用例继续完整保留；该控制 spec 通过只证明测量边界，不替代真实组件正向矩阵或视觉验收。
