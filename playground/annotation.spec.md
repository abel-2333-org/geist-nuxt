# Annotation 家族(playground 候选 spec)

> 私有 spec:随候选组件留在 `playground/`,晋升时按 component-reflow 处置(采纳 → 精华并入 references,删除本文件)。

## 目标

narrative markdown(@nuxt/content / MDC,或 spec 描述字段经 InlineMarkdown)中的行内注释:解释概念、关联 API 字段、预览站内文档。写作侧统一用 MDC 行内组件语法;渲染侧是"一个交互壳 + 三个薄形态"。

## 命名(正交矩阵:语义维度 × Annotation)

| 组件 | 归属目标 | 职责 |
|---|---|---|
| `AnnotationPopover`(壳) | foundation | 行内触发器 + 锚定非模态浮层 + hover 增强 / click 兜底 + loading / error 铬件 |
| `TermAnnotation` | foundation | 概念形态:查页面注入的 glossary map |
| `FieldAnnotation` | kits/api-docs(→ `ApiDocsFieldAnnotation`) | 字段形态:渲染 `FieldNode` 摘要,跳转接 `useFieldAnchor` |
| `DocAnnotation` | foundation | 站内 md 预览形态:打开时经调用方传入的 async `load` 取标题 + 摘要 |

`useGlossary` composable(provide/inject)随 `TermAnnotation` 走。

## 写作语法(MDC,消费项目接入层)

```md
创建支付前会先做 :term[幂等键]{id="idempotency-key"} 校验;
:field[amount]{field-ref="create-payment.amount"} 必须为整数,
:field[repoId]{field-ref="create-deployment.gitSource.repoId"} 在另一页面(跨页同写法)。
完整流程见 :doc[退款指南]{to="/docs/guides/refunds"}。
```

消费项目在 MDC components 映射中把 `term` / `field` / `doc` 指向对应组件;`load` 之类函数 prop 无法从 MDC 传入,由消费项目包一层薄 adapter(如 `doc` → 内部封装 `queryCollection` 的本地组件)。根 gallery 无 @nuxt/content,故 `DocAnnotation` 只接收 `load` 函数,不感知内容管线。

**字段源(useFieldSource,随 FieldAnnotation 走)**:仿 glossary,页面 provide 一张 id → `{ field, page? }` 表,markdown 只引 id。同页条目省略 `page` → `useFieldAnchor` 锚点跳转;跨页条目声明 `page` → 注释自动渲染 `{page}#{path}` 链接,目标页已有的 `initFromHash()` 负责到达后展开+滚动+高亮,无需额外接线。未命中 id 降级为纯文本(同 TermAnnotation 策略)。

## 关键决策

- **hover 优先、click 为骨架**:`UPopover mode="hover"`(HoverCard)触摸端与键盘用户拿不到浮层内交互,故壳用 `mode="click"` 受控 `v-model:open`,鼠标 `pointerenter/leave`(pointerType === 'mouse')加定时器实现 hover 提前开合;tap / 点击 / Enter 三端行为一致(见 references/components/overlays.md 行为边界)。
- **数据来源**:概念 = 页面 provide glossary map,标记只引 id;字段 = 复用 `FieldNode`(类型从 FieldItem 导入,编译期防漂移);md 预览 = 打开时 lazy `load()`,按需 loading / error,结果缓存,error 兜底动作是直接打开链接(永不死路)。
- **浮层内必有"跳转正文"动作**,这是不能用 Tooltip 的根因。

## Anatomy(壳)

| 部位 | 是否使用 | 映射到 |
|---|---|---|
| container | 是 | `UPopover mode="click"` + `#content` 包装 div(`w-80` 上限) |
| label | 可选 | 浮层 eyebrow(icon + 小写标签),标识注释类别 |
| value | 是 | `#content` 默认 slot(形态组件填充) |
| icon | 可选 | eyebrow 前导 `i-lucide-*`,装饰性 `aria-hidden` |
| action | 可选 | `#actions` slot(跳转 / 重试按钮) |
| helper text | — | |
| error text | 是 | error 态文案 + Retry 按钮(壳铬件,labels 可覆盖) |
| affordance | 是 | 触发器 dashed underline(形态各自定色);hover 时下划线转实线 + `bg-elevated` 轻底色 |
| focus target | 是 | 真实 `<button type="button">` 触发器,`focus-visible` 环 |

## State model

| 状态 | 表现 |
|---|---|
| default | 行内 dashed underline 触发器,颜色随形态 |
| hover(鼠标) | 150ms 后打开,离开触发器/浮层 250ms 后关闭,浮层可进入 |
| active/pressed | reka PopoverTrigger 原生 toggle |
| focus-visible | `outline-primary` 环(勿移除);Enter/Space 开合 |
| open | `aria-expanded=true`(reka 内置) |
| disabled | 降透明度,不可聚焦触发 |
| loading | 浮层内 `USkeleton` 三行 + `aria-busy` + sr-only 文案 |
| error | 错误文案 + Retry(emit)+ 兜底链接(形态提供) |
| 长内容 | 描述 `line-clamp-4`,完整内容永远可经跳转动作到达 |

## Accessibility

- 触发器为真实 button:Tab 可达、Enter/Space 开合、Esc 关闭(reka 内置)、点外部关闭。
- hover 仅为鼠标增强,不是任何内容的唯一入口。
- `aria-expanded` 由 reka Popover 内置——确认而非重写;focus 自动聚焦/归还经 `onOpenAutoFocus` / `onCloseAutoFocus` 钩子按打开来源接管(见下)。
- **焦点按打开来源(OpenSource)管理**:`:focus-visible` 无法区分"Tab 聚焦后再 hover",故触发器的 keydown(Enter/Space)/ pointerdown / hover 定时器显式记录本次打开来源。keyboard 打开 → 焦点移到面板首个动作(无动作则面板本体,`tabindex="-1"`),Esc 显式归还触发器;pointer/hover 打开 → 完全阻止自动聚焦,保持 focus-neutral;关闭时统一阻止 reka 默认归还,仅当焦点仍在面板内,或 keyboard 关闭时焦点随 portaled panel 脱落,才由壳在 nextTick 归还触发器;外部点击已落到可聚焦目标时不抢回。hover 已打开且触发器仍持焦时,forward Tab 被引导进面板并把交互所有权切为 keyboard、清理 hover timer,此后 pointerleave 不再关闭持焦面板(Shift+Tab 保持自然后退)。
- 同页字段跳转 `goTo(path, { focus: true })` 把焦点落到目标行;`initFromHash` 同样落焦,并 watch `route.fullPath` 覆盖动态路由 / query-only 复用实例的跨页到达;空 hash 清空 active 并失效在途定位(navigation token)。
- 形态组件的导航动作(Term 的 learnMore、Doc 的 open、Field 的跨页链接)导航前先调用 slot 的 `close`,动态页面复用实例时浮层不跨页残留。
- 装饰图标 `aria-hidden`;loading 态 sr-only 播报;chrome 文案经 `labels` prop 本地化(对齐 FieldItem 惯例,默认英文)。
- FieldAnnotation 跳转复用 `useFieldAnchor().goTo(path)`(滚动 + 高亮 + reduced-motion 已内置)。

## 晋升注意事项

- **必做**:晋升前把 `FieldNode` 类型抽到 `kits/api-docs/utils/field.ts`,FieldItem re-export 保持兼容,composable / 组件从 util 导入。相对路径 `../components/FieldItem.vue` 在 registry copy-in 后不成立——consumer 侧 composables 落 `app/composables/`、组件落 `app/components/api-docs/`,两侧相对拓扑不同;utils 经 Nuxt 自动导入(`#imports`)在 source 与 target 拓扑下均可解析。
- 壳与 Term/Doc 进 foundation 后,FieldAnnotation 对壳的引用从 `Playground*` 前缀改为 foundation 组件名;registry 依赖闭包:FieldAnnotation → AnnotationPopover + useFieldSource + useFieldAnchor(kit 内)。

## Playground 验证清单(component-reflow §2)

default / hover / focus-visible / disabled;loading / error(含 retry);长文本 + CJK;light / dark;390 / 960 / 1440;键盘走通开→内部动作→Esc;console 无错误。
