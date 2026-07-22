# Annotation 形态组件(playground 候选 spec)

> 私有 spec:随候选组件留在 `playground/`,晋升时按 component-reflow 处置(采纳 → 精华并入 references,删除对应章节)。
>
> **交互壳 `AnnotationPopover` 已晋升 foundation**(registry item `foundation-annotation-popover`),其正式契约在 `references/components/overlays.md#annotationpopover`,本文件不再重复壳的行为——只覆盖仍在候选中的三个薄形态。

## 目标

narrative markdown(@nuxt/content / MDC,或 spec 描述字段经 InlineMarkdown)中的行内注释:解释概念、关联 API 字段、预览站内文档。写作侧统一用 MDC 行内组件语法;渲染侧是"一个交互壳(已晋升)+ 三个薄形态(本文件)"。

## 命名(正交矩阵:语义维度 × Annotation)

| 组件 | 归属目标 | 职责 |
|---|---|---|
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

## 形态层关键决策

- **数据来源**:概念 = 页面 provide glossary map,标记只引 id;字段 = 复用 `FieldNode`(类型从 FieldItem 导入,编译期防漂移);md 预览 = 打开时 lazy `load()`,按需 loading / error,结果缓存,error 兜底动作是直接打开链接(永不死路)。
- **浮层内必有"跳转正文"动作**,这是不能用 Tooltip 的根因(壳只提供 `#actions` 槽位,动作由形态提供)。
- 形态组件的导航动作(Term 的 learnMore、Doc 的 open、Field 的跨页链接)导航前先调用 slot 的 `close`,动态页面复用实例时浮层不跨页残留。
- 同页字段跳转 `goTo(path, { focus: true })` 把焦点落到目标行;`initFromHash` 同样落焦,并 watch `route.fullPath` 覆盖动态路由 / query-only 复用实例的跨页到达;空 hash 清空 active 并失效在途定位(navigation token)。

## 晋升注意事项(形态层)

- **必做**:晋升 FieldAnnotation 前把 `FieldNode` 类型抽到 `kits/api-docs/utils/field.ts`,FieldItem re-export 保持兼容,composable / 组件从 util 导入。相对路径 `../components/FieldItem.vue` 在 registry copy-in 后不成立——consumer 侧 composables 落 `app/composables/`、组件落 `app/components/api-docs/`,两侧相对拓扑不同;utils 经 Nuxt 自动导入(`#imports`)在 source 与 target 拓扑下均可解析。
- 形态组件对壳的类型导入当前为相对路径 `../../foundation/components/AnnotationPopover.vue`;晋升进 foundation / kit 时改为各自归属下的正确相对路径。registry 依赖闭包:Term/Doc → `foundation-annotation-popover`;FieldAnnotation → `foundation-annotation-popover` + useFieldSource + useFieldAnchor(kit 内)。

## Playground 验证清单(component-reflow §2)

default / hover / focus-visible / disabled;loading / error(含 retry);长文本 + CJK;light / dark;390 / 960 / 1440;键盘走通开→内部动作→Esc;console 无错误。
