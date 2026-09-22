# #147 阶段 1：功能色基线与候选方案

状态：阶段 1 已完成并交付，等待维护者确认方案；不进入正式实现。

本轮来自 `19a107527d1226585611f4547619320b430fab2a`，独立分支 `abel/147-functional-color-stage1`。初始工作区干净且 origin/main 无前进。冻结安装、环境和文件摘要见 [environment.json](environment.json)。package.json 未声明 packageManager；实际 pnpm 10.34.5、Node 22.23.1，与现有 CI 的 pnpm 10 / Node 22 主版本一致。没有修改 lockfile。

## 证据层级

- [源码消费矩阵](source-matrix.md)：实际 installed Nuxt UI 4.9.0 与仓库消费者，描述 slot、背景、状态和来源行号。
- [纯色配对结果](static-pairs.json)：由 [calculate.mjs](calculate.mjs) 调用既有 `parseColor/composite/contrastRatio` 计算；不是浏览器通过证明。
- 浏览器：`playground/functional-colors/audit.spec.ts` 复用 `tests/browser/measure.ts`。完整原始记录在 `.output/functional-artifacts/`，包括最终前景/背景、背景链、opacity、geometry、实际状态、FontFace加载信息、ratio、源码 SHA/digest、截图与 trace。
- 视觉：截图只用于观察，不以截图抗锯齿像素替代计算；本轮尚未获得维护者视觉采纳。
- [阶段 2 验证计划](stage2-plan.md)：未执行的正式实现、完整回归与临时 fresh/upgrade consumer 计划。

## 本轮真实浏览器结果

全部六组使用相同样本键和顺序，每组774条记录；每主题Button矩阵为6角色×4表面×2变体×6真实状态=288条。下表pass/fail仅按未舍入ratio判定；unresolved/未验证不进入pass。没有基础设施异常或pageerror。

| 方案 | 主题 | pass | fail | unresolved | 原始unverified | resolved最低未舍入ratio |
|---|---|---:|---:|---:|---:|---:|
| baseline | light | 73 | 692 | 4 | 5 | 1.64322359194803 |
| baseline | dark | 664 | 101 | 4 | 5 | 3.09583458269204 |
| recommended | light | 765 | 0 | 4 | 5 | 4.651883902576909 |
| recommended | dark | 765 | 0 | 4 | 5 | 4.551121906832344 |
| amber-solid | light | 765 | 0 | 4 | 5 | 4.651883902576909 |
| amber-solid | dark | 765 | 0 | 4 | 5 | 4.551121906832344 |

主矩阵当前共793条失败样本；不等于793个独立缺陷。推荐与备选各1530条resolved样本通过，但每组仍保留上述限制，**不能称全部组件、全部消费者或整站通过**。dark最低4.551121906832344来自accented上的caveat正文，而light最低4.651883902576909来自error soft/accented，额外透明度与新背景不能据此外推。

完整每条记录见 [browser-matrix.csv](browser-matrix.csv)，原始6份JSON位于本地证据包 `functional-artifacts/`，保留完整前景/背景合成链。聚合规则见 [summarize.py](summarize.py)，不改写任何ratio或状态；[summary.json](summary.json) 可直接机器读取。

### F1–F9：仅三个真实API Docs页面的可解析样本

下面不混入四背景fixture。每单元是该ID真实页面已采样节点的最低未舍入值；场景路径/具体节点/层叠在CSV及原始JSON。Webhook不存在F9组件的零节点记录另外保留并说明，不用它冒充有效测量。

| ID | baseline light | baseline dark | 推荐 light | 推荐 dark |
|---|---:|---:|---:|---:|
| F1 | 3.913739873944556 | 7.216980674443314 | 6.487119947951175 | 8.449594779719497 |
| F2 | 2.290963597687398 | 11.024783690770832 | 8.001378676368077 | 11.024783690770832 |
| F3 | 3.883132249349551 | 7.385846572542687 | 5.740959326668835 | 7.385846572542687 |
| F4 | 2.8053050668193693 | 9.663333524293087 | 5.6988948297528665 | 9.663333524293087 |
| F5 | 2.1157693687024035 | 9.48682753567006 | 6.828971228184585 | 9.48682753567006 |
| F6 | 2.765026299210927 | 10.108178889571581 | 5.666809152561764 | 10.108178889571581 |
| F7 | 3.4400331348716318 | 6.4826706645512076 | 5.503473649450167 | 7.475920865733439 |
| F8 | 3.913739873944556 | 6.529928466029159 | 6.487119947951175 | 7.645198451741413 |
| F9 | 2.6261666632783154 | 7.9054395961421475 | 5.328570108307233 | 7.9054395961421475 |

### 六角色 solid / subtle 配对（真实Badge，四表面最低值）

Button的透明hover/active与Alert description不借此表外推；完整独立slot/state结果均在CSV。

| 主题 | 角色 | baseline solid | baseline subtle | 推荐 solid | 推荐 subtle |
|---|---|---:|---:|---:|---:|
| light | primary | 5.878968459850046 | 4.290503244723411 | 7.121203584676938 | 5.131635806016833 |
| light | secondary | 3.072241707809382 | 2.3461792726084236 | 6.583058146676685 | 4.794325338025732 |
| light | success | 3.100673742889534 | 2.381079584889289 | 6.598209505797759 | 4.8224578533887295 |
| light | info | 4.444029662122568 | 3.2886236830310924 | 6.70773789005006 | 4.855291432565066 |
| light | warning | 2.290963597687398 | 1.7982167790244699 | 8.001378676368077 | 5.774227725939664 |
| light | error | 3.913739873944556 | 2.914503500662066 | 6.487119947951175 | 4.651883902576909 |
| dark | primary | 5.426370197465054 | 3.861616767179577 | 7.087039252728687 | 4.864057685586142 |
| dark | secondary | 10.669366559133293 | 6.979252580237736 | 10.669366559133293 | 6.979252580237736 |
| dark | success | 10.170583825139756 | 6.670867594290186 | 10.170583825139756 | 6.670867594290186 |
| dark | info | 7.555341088832712 | 5.162312272573353 | 7.555341088832712 | 5.162312272573353 |
| dark | warning | 9.975230931282981 | 6.547852437480224 | 9.975230931282981 | 6.547852437480224 |
| dark | error | 6.529928466029159 | 4.572187817715733 | 7.645198451741413 | 5.228967043872988 |

warning明色实底备选的真实Badge比率为 7.825457958425116；浅底/文字与推荐相同，暗色与推荐相同。完整备选Button状态和Alert description另有独立记录，不只静态计算。

## 推荐方案（待维护者确认）

保留六角色、组件 API、中性 A 值与完整原始 ramp；仅校准功能角色语义别名，并在集中式主题配置约束 Button 状态和有色 Alert description。

| 角色 | light 候选 | dark 候选 |
|---|---|---|
| primary | #6b30cf（现有600） | #bb8cff |
| secondary | #06695e | #45dec5（保留400） |
| success | #246a32 | #6cda75（保留400） |
| info | #0058bd | #52aeff（保留400） |
| warning | #7b4207（现有800） | #f4b740（保留400） |
| error | #b52329 | #ff8588 |

新语义值在既有角色上校准，不新增一套无人消费的颜色名。保留原 ramp 的原因是 700→800 跳跃过大，尤其 blue600 比700更暗，不能把“阶数更高”当成亮度保证。

Button solid hover/active 使用角色色与 light黑/dark白分别混合10%/20%的不透明背景，避免背景透明度使父表面参与；link hover/active 保持完整角色色并加下划线；彩色 Alert description 去掉opacity90，neutral Alert保持原行为。阶段1只以隔离CSS模拟这些slot覆盖，阶段2应转为 `foundation/config/app.ts` 的精确 compoundVariants 覆盖，而非把预览选择器照搬正式运行时。

warning 实质备选：正文和浅底仍用可读深琥珀色，仅 light solid Button/Badge/Alert 保留现有 #e99b18 填充并配中性 #171717 文字；hover/active 用既有400/300。纯色配对 #e99b18/白字=2.2909619612053143；#e99b18/深字=7.825463956457599；深琥珀#7b4207/白字=8.001387907787864。这些是计算值，实际组件结果单列。备选更保留醒目的黄色，但同一warning角色文字/浅底/实底的配色职责分开，需明确维护三个solid组件覆盖，不能全局改 text-inverted。

## 测量边界

FormField required 是真实 label ::after。原检测器不支持该生成文字的字形几何；同页首轮组合fixture使大量其他节点也被保守拒绝。首轮诊断完整保存在 `.output/functional-diagnostic-combined/`。最终矩阵将 required+error 作为独立场景继续采集并保留 unresolved，普通 error-only 场景测其实际error slot。没有删除正式节点、改检测器或把星号改标通过。

## 补充覆盖与未验证

[额外消费者报告](extra-consumers.md) 与 `.output/functional-extra/` 单独保存 SidebarNav / SiteSearch 的真实交互。每个模式/主题35个可解析结果：Sidebar idle 7；搜索可见、route-active+键盘highlighted、route-active、inactive+highlighted各7。baseline light为35fail，dark为35pass；推荐方案明暗各35pass。Sidebar hover的7项绝对定位链接背景仍unresolved；baseline active另1项unresolved；推荐active因恢复候选query后未得到aria-current方法行仍unverified。

其余边界：

- 每份主矩阵原始5条unverified中，4条是required marker；另1条是通用采集器在Webhook页强求F9而得到零节点。源码核实该页面没有ResponseExample，`HTTP状态码=200`属于不同文档组件，所以该条在范围解释中为不适用，原始JSON不改写，也不使用静态200替代F9。F9在实际存在的API Docs目录页和endpoint页均有独立实测。
- ResponseExample 的200/302/400/500分别用真实单状态组件采集；本轮没有证明原页面的下拉切换全过程、窄屏compact选择器交互或所有业务scenario。
- 主矩阵数值在1440px采集，390px仅有截图；不是窄屏全部节点的对比度或键盘验收。Button采集稳定idle/hover/active+hover/keyboard-focus/keyboard-active+focus/focus+hover，颜色过渡的所有中间帧没有完整证明；disabled不是普通文字通过样本。
- `font-evidence.json` 通过CDP证明实际POST四个glyph使用GeistMono-Medium；其余主矩阵记录是FontFace加载状态，不外推成所有CJK/Latin字形都用同一字体。
- #148四个浏览器spec、完整consumer、CI和owner视觉尚未在候选上执行；阶段2按计划完整重跑。中性A源码、原检测器及其控制未修改，中性色13个Node测试通过。
- 必要非文字边界与focus 3:1未完整审计；此结果不构成整站WCAG或正式功能色修复验收。

## 阶段 2 影响文件（未改）

- `foundation/assets/css/main.css`：六角色的light/dark语义映射；不改中性A、背景或整个ramp。
- `foundation/config/app.ts`：六角色Button solid/link状态、有色Alert description；若选备选，再加warning solid Button/Badge/Alert精确文字/填充覆盖。
- `references/foundations/tokens.md`、`references/foundations/focus-a11y.md`：记录真实配对与适用条件，修正文档与installed Button focus样式的差异；不能宣称所有状态自动通过。
- `tests/fixtures/contrast/`、`tests/browser/` 及必要的颜色契约测试：采纳后的功能色矩阵和完整回归；既有F-01/F-02/F-03逻辑与对照保留。
- `references/kits/api-docs/` 若需要补充精确配对说明；当前无需修改 FieldItem/FieldAnnotation/ResponseExample 等runtime。
- `registry.json` 通常无需新增item；现有foundation配置/CSS分发闭包需检查。消费者自身app config合并覆盖是升级验证重点。

不重录ledger、不清除七个deferred owner、不混入#152、不合并/发布/部署、不关闭Issue、不更新外部consumer或v0 memory。

## 视觉比较与取舍

本地 [对照页](http://127.0.0.1:4124/functional-review/) 展示真实明暗截图；[推荐交互预览](http://127.0.0.1:4123/__functional-colors?candidate=recommended)、[warning备选](http://127.0.0.1:4123/__functional-colors?candidate=amber-solid)、[基线](http://127.0.0.1:4123/__functional-colors?candidate=baseline) 均仅本机服务。

推荐的light实底更深、更稳重，success/secondary仍可区分但亮度接近；warning从亮橙变为深琥珀/棕色，这是最明显的品牌观感代价。dark primary/error稍亮，实底用原Nuxt UI反色深字。link hover保留颜色并加下划线，solid hover/active仍有真实深浅反馈。有色Alert描述不再淡化，层级依靠字重和位置；中性Alert不变。

推荐单角色方案的理由是让已有text/bg消费继续一致，避免warning的实底成为专用例外；若维护者认为亮warning填充是必须保留的视觉识别，采用已经测过的备选，仅增加三个solid组件的集中覆盖。此处是待采纳的设计取舍，不要求用户代写模板代码。

## 实际命令与退出码

完整日志在证据包 `functional-evidence/logs/`；[commands.json](commands.json) 为机器索引。

| 命令 | 退出码 | 解释 |
|---|---:|---|
| `pnpm install --frozen-lockfile` | 0 | 锁定安装；lock hash未变 |
| `node playground/functional-colors/build.mjs`（首次及最终） | 0 / 0 | 正式CSS+隔离路由；最终digest以environment为准 |
| `GEIST_FUNCTIONAL_MODES=baseline pnpm exec vitest run --config playground/functional-colors/vitest.config.ts`（诊断） | 1 | 组合fixture的required伪元素保守拒绝；初版include合并误触4个无对应build的旧suite。日志完整保留，不作为最终矩阵 |
| `pnpm exec vitest run --config playground/functional-colors/vitest.config.ts`（最终） | 1 | 六组全程采完；保留baseline对比度失败、required unresolved及未验证，严格断言没有被改绿。无基础设施异常 |
| `pnpm typecheck` | 0 | Vue/项目类型检查 |
| `node --test tests/text-contrast.test.mjs` | 0 | 13个中性配对/解析器检查通过 |
| `node docs/maintenance/functional-color-stage1/calculate.mjs` | 0 | 576个纯色诊断配对 |
| `node docs/maintenance/functional-color-stage1/capture-visual.mjs` | 0 | 明暗截图；不作为颜色取样器 |
| `python3 docs/maintenance/functional-color-stage1/summarize.py` | 0 | 原始数据导出CSV和聚合，不改判定 |

重放：从本报告baseline SHA checkout，保留本任务playground目录，冻结安装；先运行build，再运行独立vitest配置。`source.json`同时校验Git SHA与包括未提交fixture在内的内容digest；后续本地文档提交不会将本轮浏览器来源改标为新提交SHA。正式生产文件与baseline逐字节一致。浏览器反例控制与正式CI没有重跑为本阶段“全绿”证明。

## 待维护者确认与停止点

1. 是否采纳推荐映射与集中式Button/Alert覆盖；warning选择推荐深琥珀，还是亮实底+深字备选。
2. 若进入阶段2，按stage2-plan完整实施/验证，并先补齐required生成文字、Sidebar叠层、Response动态切换等剩余证明；未经验证不得给它们pass。

本阶段只提交本地候选/报告并更新#147当前摘要，不推送分支、不创建PR、不合并、不发布。方案和视觉尚未获维护者采纳，保持阶段2停止点。
