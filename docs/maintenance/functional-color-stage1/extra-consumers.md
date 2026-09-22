# #147 独立真实消费者补采

源码、候选和测量器未修改；复用 tests/browser/measure.ts。route-active 和 selected 不混同；只有真实DOM状态入账。

| Mode | Theme | Pass | Fail | Unresolved | Unverified |
|---|---|---:|---:|---:|---:|
| baseline | light | 0 | 35 | 8 | 0 |
| baseline | dark | 35 | 0 | 8 | 0 |
| recommended | light | 35 | 0 | 7 | 1 |
| recommended | dark | 35 | 0 | 7 | 1 |

每组合35个可解析结果：Sidebar idle 7；SiteSearch portal visible 7、route-active + keyboard highlighted 7、route-active 7、inactive route + keyboard highlighted 7。同个节点在多个真实状态出现，不能把行数当唯一组件数。

范围：支付域现有POST/GET/PATCH/DELETE，共7条方法项；不存在PUT项，不制造。Sidebar hover的7个真实背景均被checker识别为unmodeled overlapping sibling A，保留unresolved。baseline侧栏active另有1个同类unresolved；recommended两主题恢复候选query后未得到aria-current方法行，保留unverified，不声明通过。

两套搜索入口：/kits/api-docs/docs-shell/payments（方法结果route-active）以及 /kits/api-docs/docs-shell/payments/quickstart（方法结果inactive，ArrowDown触发data-highlighted，::before背景elevated/50）。保留class、attributes、before背景、完整paint以及未舍入ratio。

字体：font-evidence.json 通过 CDP CSS.getPlatformFontsForNode 证明POST的4个glyph实际使用GeistMono-Medium。引擎Chrome/153.0.8010.12 revision @971a7443b0c9b0a9b2860529b33331b76077ec62。

脚本：/tmp/geist147-extra.mts、/tmp/geist147-search-inactive.mts、/tmp/geist147-fonts.mts；每组JSON保留build source.json和采集脚本SHA256。首轮场景标签popover遮挡导致未完成的baseline证据另存attempt1，仅完整重试结果进入本表。截图与原始JSON在同目录。
