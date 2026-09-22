# Issue #147 阶段 2 验证计划（阶段 1 只读产物，尚未执行）

事实源：当前 checkout HEAD `19a107527d1226585611f4547619320b430fab2a`，读取时工作区 clean；`AGENTS.md`、`SKILL.md`、`references/registry.md`、`tests/browser/README.md`、四个 browser spec、`tests/browser/measure.ts`、`scripts/lib/text-contrast.mjs`、`scripts/check-registry-consumer.mjs` 和 CI workflow。此文件只定义下一阶段验收；不授权正式实现、部署、发布、合并或关闭 Issue。

## 基本判定与证据

- #147 功能色 F1–F9 与 #148 中性文字修复分开归属；保留原正向、反例和 motion 全套回归，不通过缩小选择器、删状态、豁免 readonly/placeholder/未选中/可见 aria-hidden 来使其变绿。
- Node `checkTextContrast(css,{from})` 返回 `pairs/failures/minimumRatio`；`assertTextContrast` 对 failure 抛错。`parseColor` 只接受有限 hex / numeric rgb(a) 子集；`composite` 做 sRGB source-over；`contrastRatio` 只接受已合成不透明颜色。不要扩大既有 normalTextTokens 来把功能色塞入中性契约；功能色另以 owner、用途、背景和状态建矩阵，普通文字原始 ratio >= 4.5。
- 浏览器 `measure(locator, pseudo='::placeholder'|null)` 使用 computed style/祖先 opacity/实际层叠与几何，未知绘制必须 unresolved。禁止对截图抗锯齿边缘取色、8-bit 量化或 rounded ratio 判定。
- 每轮新构建绑定 source.json 的 HEAD+digest；源码、fixture、测量器、browser spec/config、计算依赖变化均重建。保留 raw foreground/background、effective 合成颜色、opacity 层、excludedPaint/rejection、字体 readback、主题/路由/状态、截图、trace、命令退出码。
- 环境基准为现有锁定 Chromium；F-02 几何证明要求 CDP Chrome/153.0.8010.12 @971a7443b0c9b0a9b2860529b33331b76077ec62、DPR 1、viewport scale 1。引擎不匹配是阻断/需重新证明，不能调整 allowlist 直接放行。

## 必须保住的 #148 正向覆盖

| 验证面 | 明暗主题均执行的验收 |
| --- | --- |
| 中性 token | `--ui-text-dimmed/muted/toned`、`--ui-text`、`--ui-text-highlighted` × `--ui-bg`、`--ui-bg-muted/elevated/accented`；每主题 20 唯一非空节点，共 40 配对；Node source 和 browser computed 两层全部 >=4.5。 |
| placeholder/表单 | Input/Textarea/InputMenu 的 outline/soft/subtle/ghost/none × idle/真实 hover/focus，读取真实 ::placeholder；Input/Textarea readonly；Select/SelectMenu placeholder、打开 portal 的 option/search；FormField props/slots description/hint/help；neutral Alert 保留 opacity-90 的实际合成。原生 disabled 单列例外，不能当正常文字通过。 |
| count alpha | FieldItem 与 EnumTable 各自 `(2)` 样本；独立恢复 `/70` 反例，确认 alpha 真是 .7 且 ratio<4.5；恢复后再次通过。 |
| 展开 hover | FieldItem 与 FieldValueStructure 各自展开动词 idle/真实 hover/expanded-hover；独立恢复 `/75` 反例，确认 alpha .75 且 ratio<4.5；恢复后通过。 |
| 中性 solid | Card/Empty/PageCTA/PageCard description；PricingPlan description/discount/billingCycle/billingPeriod/featureTitle/tagline/terms；所有现有真实 variants、默认省略 variant、Card 具名 slot；solid 维持 inverted 语义，非 solid 对应 muted/toned/default；PageCard hover/link focus。 |
| 其余现有覆盖 | Tabs 两个选中项+focus 与 indicator 层叠；真实 goTo arrival 在 computed progress 的 opacity 峰值；Modal/Slideover/Popover/Tooltip/DropdownMenu 实际 portal；三个 API Docs 路由可见 metadata、legend、optional notation；Webhook 先展开 payload_data，390px/1440px截图。 |

四个 alpha 负向测试外层绿仅证明检测器，不能写成正向 suite 已红。若阶段 2 改动中性 token/count/hover 或测量逻辑，另在已提交 clean exact HEAD 运行 `node scripts/verify-contrast-mutations.mjs --artifacts <external-dir>`，保留 A 正向→旧 token→两个 count→两个 hover→恢复 A；每步重建并完整 test:browser，只有指定 owner/state 的 ratio 失败算有效红，启动/超时/零节点/unresolved 不算。

## F-01 / F-02 / F-03 反例和正常对照

- F-01：保留 text-contrast.spec 的兄弟子树绘制反例，包括透明/零尺寸包装中的后代、宿主不重叠但伪元素伸出、DOM 前置但更高层绘制、display:contents、top layer、overflow 裁切/脱离流保守路径。每个反例明确 unresolved；无遮挡/可证明不透明覆盖且更低绘制顺序/移除恢复应通过并有 excludedPaint 依据，不能把 DOM 顺序作为证据。
- F-02：有色 border、远处外阴影、零尺寸 spread、多片 inline border、隐藏父层滤镜、变换/分数平移路径全部保留；无绘制、分离、薄边框、移除恢复为正常对照。保留 glyph-bounds.spec 实际 Tooltip 的 shadow/outline 覆盖与分離、嵌套 fractional translate、individual translate、font-feature guard/fallback 与恢复；必须保守 fallback 原 Range 或 unresolved，不能删真实焦点/Tooltip 来避开遮挡。
- F-03：pseudo-outline.spec 在明暗下分别覆盖透明 ::before 的空绘制早退、有背景而盒子分离 ::after 的几何早退；普通可见 outline 与 auto 均须 unresolved；无 outline、普通透明 outline、普通零宽、移除恢复须通过；auto 不获透明/零宽豁免。宿主 outline 检查不能替代 pseudo 检查。
- 反例必须保留实际几何、computed paint、拒绝原因、截图；反例 suite 成功与产品正向对比度成功在报告中分开。

## FieldItem optional trigger motion

直接保留并全跑 optional-trigger-motion.spec.ts。主题 light/dark × motion no-preference/reduce；不要仅测 reduced-motion。

1. 在任何键盘输入前安装观察：computed transition 配置、transitionrun/start/cancel/end、运行或 pending 动画、每个 native input 的 focused/focusVisible/hovered。
2. 指针移出后通过真实 Tab 顺序到达，验证 trusted Tab/Shift+Tab 与 :focus-visible；不得 programmatic focus、插入 tabindex 或 click 替代。本次顺序到达滚动可使 Tooltip 关闭，保持该 arrival 证据，再 Shift+Tab/Tab 重入并要求真实 Tooltip 打开。
3. 无 hover 的进入→退出→重入→退出；hover-only→hover+keyboard-focus→blur 回 hover→pointer leave；每个恢复端点文字/背景/ratio 回到原 idle。
4. 快速 Tab/Shift+Tab 往返及 hover/focus 混合反转；输入之间不得等待稳定端点。记录事件和声明以证明无前景/背景插值，不能用少量中间帧声称不存在瞬时低对比。
5. 验收没有 duration>0 的颜色 transition 声明、没有运行/pending 的相关 animation、没有 color/background-color transitionrun/start；真实 focus 保留可见填充和反色文字，hover+focus 等于 focus，blur-to-hover 等于 hover。
6. Tooltip 正常入场动画保留；稳定端点先确认实际 open/closed 状态与对应 Tooltip 可见、动画结束，再由原 measure 要求 resolved 且 ratio>=4.5。readiness sidecar 只证明采样状态，不等于对比度验收。

## 阶段 2 执行顺序（获得授权后）

1. 保存 before exact HEAD、git status 与 live base/remote SHA；记录环境/Node/pnpm/浏览器身份。先跑现有 gate 建 baseline，再实现获准 owner 范围。
2. `pnpm test:agent`、`pnpm registry:validate`、`pnpm test:registry`、`pnpm test:component`、`pnpm typecheck`、`pnpm build`。
3. `pnpm build:contrast` → `GEIST_CONTRAST_ARTIFACTS=<external-dir> pnpm test:browser`。完整 suite 不以 focused rerun 取代最终门禁；focused spec 只用于定位。
4. 真源提交后重跑绑定 exact HEAD 的最终受影响检查；执行下列 consumer fresh/upgrade。若推送/改写 head，再回读 exact remote SHA 和 CI；任何部署/合并仍遵从本轮授权界线。
5. 输出已验证/失败/unresolved/未验证；owner 视觉验收独立于计算、browser、CI，不宣称整页 WCAG 合规，不据此关闭 #140。

## 临时 consumer fresh / upgrade

两种测试均临时目录，禁止动现有消费项目，禁止手抄受管资产。公开 CLI `--to` 必须是正在执行命令的 checkout HEAD 的完整 40 位 SHA，不会替你 checkout。foundation/kits/registry 未提交时公开 copy/update 拒绝生成 lock；不能使用 test-only dirty 环境绕过后称作可复现交付。

### Fresh

- 全量门禁：`pnpm test:consumer -- --to <HEAD40>`；也可按现有 CI 分组 `--group runtime` 和 `--group isolated`，完整覆盖两组才等价。前期定向 `--scenario api-docs-field-item` / `--scenario all-items` 不能取代全量。
- 脚本建立临时 consumer、dry-run JSON、核对 fully-attributed create/tag/requirements、按 planDigest guarded apply、验证 protected entrypoint 未覆写、lock/CSS/组件解析/typecheck，以及带 build 场景的实际构建；再次 dry-run 收敛。
- `--keep-temp` 可保留 fresh consumer 供额外浏览器验收。consumer test 现有实现本身不提供完整 #148 browser/motion 证明，若要证明分发端交互，必须在保留的临时 consumer 使用复制的 FieldItem 与 consumer-owned 测试页面重放上述 light/dark focus/hover 矩阵并保存独立证据，不把根 gallery 截图冒充消费端截图。
- 手动 fresh 的等价公开序列：`pnpm geist:copy -- geist-foundation api-docs-field-item --target <temp-consumer> --to <HEAD40> --json`；审阅 plan；相同命令加 `--write --expect-plan <digest>`；`pnpm geist:check -- --target <temp-consumer>`；消费端安装 lock requirements、typecheck/build、真实页面验证。只在 consumer-owned 入口合并 config/UApp，不修改受管文件。

### Upgrade

- `pnpm test:consumer:upgrade -- --upgrade-from <BASE40> --to <HEAD40>`；base 必须是 head 祖先。脚本从 base Git tree materialize 来源并安装全量旧 lock，再用当前 head dry-run/guarded update，检查 digest、protected 文件未变、head lock、复制 CSS 的中性 40 配对、requirements、组件解析、typecheck/build。`--skip-install` 只在依赖已满足且来源明确时使用。
- 本地 head 升级证据与 CI 的 PR merge tree 分开记录；CI 实际执行 `--upgrade-from "$BASE_SHA" --to "$MERGE_SHA" --skip-install`，不得把 merge SHA 写成 branch head。修改之后重新绑定两个 SHA。
- 脚本会清理 upgrade 临时 consumer，不依赖 `--keep-temp` 保留它；若要追加消费端 browser 证据，另建持久于 /tmp 的受控 upgrade fixture，用 base checkout 的公开 copy --to BASE 安装，再从 head checkout 的 update --to HEAD 应用。分别保存 plan/apply/lock 和 protected file hashes；再 `geist:check`、consumer typecheck/build、light/dark browser。
- dry-run 的 create/update/delete/tags 决定额外验证面；config migration 由消费端入口显式接线，CLI 不替改。失败或本地漂移应零写入，不能覆盖本地修改继续。

阶段 1 只交付此计划；以上命令本轮未执行，所有阶段 2 数值、browser、consumer 和视觉结论尚未获得。
