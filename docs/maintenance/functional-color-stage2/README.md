# #147 阶段 2：实现与复现说明

采用维护者明确确认的推荐方案，warning 使用深琥珀实底。本文件记录实现范围、复现要求和初轮发现；最终命令结果、原始记录和视觉确认状态另附于绑定 clean SHA 的阶段 2 证据包，不由本文件或旧阶段 1 数据推定通过。

## 来源与范围

- main 基线：`19a107527d1226585611f4547619320b430fab2a`；阶段 2 开始 fetch 后未前进。
- 承接阶段 1 本地提交：`556b4f0a4f1d730fa533bb9041c6ed1064c18da6`；独立分支 `abel/147-functional-color-stage2`。
- 原阶段 1 工作区、报告和证据包保留；ZIP SHA256 为 `e1a0effdf0b534e773b14f23f3454b2ad0f7ea3aa217b2d42c402b7020b5a3fe`。阶段 1 的数据仍绑定其原始 SHA / digest，不能改标成本轮结果。
- [方案采纳及实施开始记录](https://github.com/abel-2333-org/geist-nuxt/issues/147#issuecomment-5770433146)。
- 正式改动集中于 foundation CSS 语义映射及 app config 的 Button solid/link、彩色 Alert description。原始 ramp、中性 A、组件 API、neutral 主题行为不变。

## 验证要求与证据分类

沿用 [阶段 2 验证计划](../functional-color-stage1/stage2-plan.md)。正式结果须记录命令退出码、实际 SHA / digest、原始前景与背景、叠层、几何、未舍入 ratio、状态、字体、截图和 trace。未解析、零节点、状态未触发及基础设施失败不得计入 pass。

| 验证面 | 必须取得的证据 |
| --- | --- |
| 修改前既有门禁 | 独立工作区、冻结环境、真实基线结果；环境失败保留日志 |
| 正式六角色与真实组件状态 | 两主题、四背景、1440/390 宽度；实际 slots 和原生交互 |
| required `::after` 与 required + error | 真实 generated textBox、字体与绘制一致性；独立反例/恢复 |
| Sidebar hover / active 叠层 | 受限绘制顺序证明、真实状态、布局反例与恢复 |
| ResponseExample 原页面切换、窄屏 compact | 原页面实际 scenario/status/media 切换及非零样本 |
| Button 过渡及窄屏数值 | 输入前开始的声明/事件/动画观察、快速反转、真实键盘状态 |
| #148 中性、F-01/F-02/F-03、optional trigger motion | 完整既有回归与独立源码变异红→绿，不以历史数量作上限 |
| fresh / upgrade 临时 consumer | 已提交源码的公开 copy/update、精确 SHA 与计划摘要、实际消费端构建和浏览器 |
| 独立复审 | 实现、测量扩展、反例及最终 exact SHA |
| 维护者最终视觉确认 | 独立停止点；计算和浏览器结果不能代替维护者采纳 |

## 初轮实测与复审发现（尚非最终结果）

初轮隔离构建来自 `556b4f0a4f1d730fa533bb9041c6ed1064c18da6` 加未提交实现，digest `8b51db46959b503c4ffd8096f993f2def4ea663be0f85fc7d623d395c1c06289`。不能将其标为后续正式提交。

- 原 Button 颜色 transition 的真实中间帧出现超出 sRGB 的数值：light info 的红通道为 `-0.00000308037` / `-0.00000616074`，dark primary 的蓝通道为 `1.00006` / `1.00002`。测量器返回 unresolved；这不是 ratio < 4.5 的失败，也不允许通过截断通道改成 pass。正式主题仅对六角色 solid 取消颜色插值，保留已采纳的状态端点；验证声明、真实事件、快速反转及恢复端点。
- 独立复审复现 absolute 背景证明在 flex/grid `order` 重排及 display:contents 下错误放行；支持范围收窄至可证明的普通父布局与真实内容盒，补反例/恢复。
- 独立复审复现 required `::after` 的 `-webkit-text-fill-color` 与 `color` 不同时错误放行，以及不同语言的字体 `locl` 字形越界。测试包含自制极小字体、真实填色和恢复对照；字体由仓库所附源生成，无第三方字体许可依赖。
- 独立复审复现快照取回后宿主正文换行、宿主尺寸不变时，旧星号位置被误用的竞态。生成内容须额外证明快照与测量一致，不能仅核对宿主矩形及伪元素样式。
- 独立复审复现 `dark:hover` 背景分支压过普通实例 hover 覆盖。正式实现以按钮内部变量切换混色方向，并保留普通 hover / active 修饰符；同时验证 `ui.base` 与 `class` 的明暗真实绘制结果，不能只检查 class 字符串。
- 部分窄屏节点被真实 sticky header 遮挡、Popover 尚在离场，检测器保留 unresolved。测试应在正常交互形成的可见稳定状态测量，不删除 header、浮层或失败节点。
- `audit:verify` 当前失败：共享主题改动使 `api-docs-enum-table`、`api-docs-field-item`、`foundation-annotation-popover`、`foundation-inline-code`、`foundation-split-pane-handle`、`foundation-theme-toggle` 的 scope 摘要失效。按本轮限制不重录 ledger；七个 deferred owner 保留。这一失败与浏览器数值验证分别报告。

历史 Webhook 页 F9 零节点源于该页没有 ResponseExample。阶段 1 原始记录保持不变，本轮按实际组件存在性列为不适用；不得以静态 HTTP `200` 文本冒充 F9。

## 复现与产物

先按仓库运行时要求冻结安装，执行阶段 1 验证计划中的全部本地门禁；`pnpm build:contrast` 后以外部目录设置 `GEIST_CONTRAST_ARTIFACTS`，执行完整 `pnpm test:browser`。修改测量器后另从完全 clean、已提交 HEAD 执行 `scripts/verify-contrast-mutations.mjs`，每个变异重建并执行同一完整 suite。

功能色红→绿使用最终测量器与测试源码，仅在独立源码副本恢复基线的 foundation CSS/config；它是明确标注的旧主题变异实验，不冒充历史 checkout。consumer fresh/upgrade 使用临时目录和公开 CLI；构建与浏览器结果分别绑定消费者受管文件、源码 SHA 和内容摘要。

证据包应同时保留最初失败、后续修复、最终检查、截图、trace、独立复审与环境来源。根 gallery、临时消费者和历史基线各自使用独立目录，不相互替代。阶段 2 最终进展回写 #147，维护者视觉确认仍待单独记录。

## 交付边界

本轮不推送或创建 PR、不合并、不发布部署、不关闭 Issue、不清除七个 deferred owner、不重录 ledger、不更新外部 consumer 或 v0 memory。CI 与维护者视觉确认是独立证据，不由本地门禁替代；本报告不声明整站 WCAG 合规。
