# #147 阶段 1 源码与状态矩阵

> 本文件为先行只读调查；末尾初筛不等于最终候选。已完成的隔离候选与真实测量以 README.md、summary.json 和 extra-consumers.md 为准。

只读源码核对：HEAD `19a107527d1226585611f4547619320b430fab2a`；冻结安装 Nuxt UI 4.9.0。以下相对路径均基于 `/Users/abel.wang/.codex/worktrees/c52f/geist-nuxt`。T 代表 `node_modules/@nuxt/ui/dist/shared/ui.BfHSFiIO.mjs`。本报告没有浏览器通过结论；历史 F1–F9 比率不可改标本轮结果。

## 共用角色与背景

六角色 primary/secondary/success/info/warning/error 的映射位于 `foundation/config/app.ts:8-15`，真实 ramp 在 `foundation/assets/css/main.css:99-181`，light 默认500（196-203）、dark默认400（230-239）。四个支持中性背景 light 白/FAFAFA/F2F2F2/EBEBEB（211-214）；dark 0A0A0A/1A1A1A/1F1F1F/292929（246-249）。

`text-inverted` 没有被项目 CSS 覆盖：installed `node_modules/@nuxt/ui/dist/runtime/index.css:1` light=#fff；dark=`--ui-color-neutral-900`，必须浏览器解析真实值，不得误用项目 `--ui-bg` #0a0a0a。下列通用有色组件矩阵每行展开六角色 × light/dark × 四中性父背景；soft/subtle 另叠角色10%背景；solid自身不透明背景，但 hover/active 的75%让父背景重新参与。

## 基础组件真实 slot / 变体 / 状态

| 消费 | 源码 | 前景 / 背景 | 实际状态 |
|---|---|---|---|
| Button solid base（文字 label 继承） | T:879-884,961-964 | text-inverted / bg-role | idle；hover和CSS :active背景 role/75；focus-visible outline-role/25 + outline-3，文字/底不因focus改变；hover+focus、active+focus仍有75%底 |
| Button link base | T:981-984 | text-role / 透明 | idle；hover和CSS :active文字 role/75；focus-visible outline-role/25 + outline-3；组合状态仍有文字75% |
| Badge solid base | T:581-584 | text-inverted / bg-role | 静态，没有内置 hover/active/focus/selected色变 |
| Badge outline base | T:585-588 | text-role / 透明；ring-role/50 | 静态，没有上述状态 |
| Badge soft base | T:589-592 | text-role / bg-role/10 | 静态，没有上述状态 |
| Badge subtle base | T:593-596 | text-role / bg-role/10；ring-role/25 | 静态，没有上述状态 |
| Alert solid root/title + description | T:272-277,311-316 | text-inverted / bg-role | 静态；description自身opacity90，需分离测量标题/root文本与description |
| Alert outline root/title + description | T:317-322 | text-role / 透明；ring-role/25 | 静态；description opacity90 |
| Alert soft root/title + description | T:323-328 | text-role / bg-role/10 | 静态；description opacity90 |
| Alert subtle root/title + description | T:329-334 | text-role / bg-role/10；ring-role/25 | 静态；description opacity90 |
| FormField error | T:3114-3124 | text-error / 透明 | 有错误时可见；无内置文字状态变体，只展开error角色 |
| FormField required marker | T:3134-3136 | label ::after `*` 的 text-error / 透明 | required=true时可见；标签正文不是error，必须采集::after，不可用label色冒充 |

Button disabled/aria-disabled有base opacity75（T:881），solid背景退回100%，link文字退回100%（T:964,984）。真正不可操作disabled单列，不冒充普通状态。Button `active` prop/route active 与 CSS :active不同：theme active variant空（T:952-958）；runtime `Button.vue:131-132` 只在传入activeColor/activeVariant时切换配置，不能机械生成固定selected色变。

注意：`references/foundations/focus-a11y.md` 的实底2px+offset2叙述与 installed4.9.0 Button主题的outline3/25并不一致；本轮矩阵应按实际生产主题，不把文字契约当当前实现。

## F1–F9 实际链路

| ID | 真实源码与消费 | 背景/状态 |
|---|---|---|
| F1 | `kits/api-docs/components/FieldItem.vue:371-376` Required text-error | 行透明；无requiredness自身hover/focus色变；行高亮flash为独立绝对叠层（264），需记录实际绘制关系 |
| F2 | 同上 Conditional text-warning | 同F1 |
| F3 | `kits/api-docs/utils/method-preset.ts:31` GET info/subtle → `HttpMethodBadge.vue:29-35` → `foundation/components/SemanticBadge.vue:39-44` → Badge base T:596 | info/10叠实际宿主，静态徽章 |
| F4 | method-preset.ts:32 POST success/subtle；`kits/api-docs/utils/lifecycle-preset.ts:50,54` new/active success/subtle | success/10叠实际宿主，静态徽章 |
| F5 | method-preset.ts:33 PUT warning/subtle；lifecycle-preset.ts:52,55 beta/maintenance warning/subtle；FieldItem.vue:503-512 caveat lead-in text-warning | warning/10叠实际宿主；caveat body是text-toned，不能混为warning文本 |
| F6 | method-preset.ts:34 PATCH secondary/subtle | secondary/10叠实际宿主 |
| F7 | method-preset.ts:35 DELETE error/subtle | error/10叠实际宿主 |
| F8 | lifecycle-preset.ts:58 sunset error/solid → LifecycleBadge.vue → SemanticBadge | text-inverted / error；静态 |
| F9 | `ResponseExample.vue:409-417,466-477` UBadge subtle，状态数字及可见statusText继承 | `CodeBlock.vue:167` bg-elevated → toolbar `:172` bg-muted/60 → role/10；200=success，3xx=info，4xx=warning，5xx=error，default/其他=neutral。切换响应后重新测实际可见徽章；不是Badge自身selected状态 |

F3–F7另有宿主状态：`SidebarNav.vue:566-578` active链路bg-primary/10，inactive hover:bg-elevated；徽章在:583-584中。`SiteSearch.vue:317-331` modal内UCommandPalette #item-leading渲染HttpMethodBadge。T:2109 active:true给item ::before bg-elevated；T:2113 inactive item 在data-highlighted时::before bg-elevated/50。runtime `CommandPalette.vue:250-260` active来自ULink/ item.active，与listbox selected不能混同。伪元素背景若测量工具拒绝解析，保留unresolved并定向验证，不能删除伪元素得到pass。

## 额外独立验收点

- `FieldAnnotation.vue:135-144` requiredness text-error/text-warning；`AnnotationPopover.vue:210` UPopover；installed `Popover.vue:22,73` 默认portal=true；T:5058-5060 content bg-default。portal在body下，不继承触发器所在带色表面。requiredness没有自身交互色变。trigger自身AnnotationPopover:215 hover:bg-elevated、focus-visible:outline-primary、disabled opacity50；FieldAnnotation:119只改下划线primary/50→hover primary，非requiredness文本。
- `kits/api-docs/internal/FieldValueRequirements.vue:76-85` value caveat warning/10底、text-warning lead-in、text-toned正文。独立于FieldItem caveat，须真实展开值结构命中节点。没有自身hover/active/selected。
- `LifecycleNotice.vue:38-43` UAlert subtle，根据共享lifecyclePreset获得success/warning/neutral/error；description继承opacity90。title与description不可共用一个ratio。
- `FieldItem.vue:339` optional '?' focus使用bg-primary/text-inverted、hover:bg-elevated、transition-none；每次角色映射变化会影响其focus配对。继续保住此前双向状态与Escape/legend/复制回归。
- `FieldItem.vue:637` 与 `FieldValueStructure.vue:206` 展开文字为text-primary，hover只underline，无75%文字alpha；不要错误复制Button link状态。

## 候选集中式覆盖的冲突与初筛

1. 单改 `--ui-role` 同时改变文字、solid填充、10%浅底、focus环、Sidebar active底及FieldItem flash。不能仅凭白底文字过4.5就宣称全矩阵过。
2. 现有ramp存在700→800巨大跳变（secondary067a6e→073c34，success297a3a→1b311e，info0068d6→00254d，errorcb2a2f→391417）；info600比700更暗，不能假设档数严格对应亮度。统一推600/700不能满足四中性父背景上soft/subtle与Alert opacity90。
3. 复用项目 `parseColor/composite/contrastRatio` 做有限静态初筛（仅sRGB、accented表面，不是浏览器）：保留link75时light最浅可用既有档位为primary800、secondary800、success800、info800、warning900、error800；dark为primary300、secondary400、success400、info300、warning400、error300。视觉代价很大，尤其light多色趋于近黑。需完整四表面、solid/75、Alert90浏览器验证，不能作为最终推荐。
4. 数值例证（静态）：dark primary400对accented正文4.406978643406044，soft/10底3.8616090019145095；light warning800的link75/accented为3.87536399736606，warning900为4.567765854608901。dark info400的Alert soft description90/accented约4.490776739494444；四舍五入不能放行。
5. 可检查备选：保持六个role API，以集中式Button compoundVariants最小覆盖hover/active /75、Alert description slot审视opacity90，降低为alpha补偿而整体大改品牌色的压力；即便减少alpha损耗，上述700→800间隙仍需候选实测。另一实质备选是保持明亮warning填充并对warning solid采用深色文字，正文/浅底继续用既有text-warning语义映射；最终隔离备选直接对三个solid组件复用既有warning原始色阶，无需新增角色token或迁移text-warning消费者，并覆盖F8/其他solid，不能只改Badge shallow。

此先行调查未实现候选、未修改正式文件；后续隔离候选已由主任务采集。正式阶段2前应由主任务提供真实浏览器全矩阵、隔离候选明暗截图、未覆盖/unresolved清单及维护者选择。
