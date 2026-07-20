# Source-first 组件晋升规范

候选组件先在根 app 的 `/playground` 完成设计；只有人工确认值得共享后，才晋升到 `foundation/` 或 `kits/`，进入根 `registry.json` 与正式 gallery。

## 0. Playground 生命周期

| 阶段 | 位置与职责 |
|---|---|
| 开发中 | 候选源码放 `playground/`，由 `app/pages/playground.vue` 以真实示例数据展示；页面固定 `nav: false`，HMR 直接预览 |
| 未采纳 | 留在具体消费项目或删除，不进入 foundation / kit / registry |
| 已采纳 | 移动到正式真源、补 registry 与 gallery；删除或清空对应 playground 草稿 |

候选源码不得先放进 foundation / kit 再等人决定，否则未采纳 API 会被误当作正式资产。

## 1. 采纳决策

人工确认：

- Nuxt UI 或现有 registry item 没有现成能力，也无法简单组合；
- API、状态和 a11y 已达到可复用质量；
- 至少有明确的复用场景；
- 归属明确：跨场景 → foundation，单领域 → 对应 kit。

## 2. 规格与验证

交互 / 状态 / 焦点复杂的组件按 `component-spec-template.md` 完成 anatomy → state → accessibility；纯展示原子轻量过 anatomy 与 a11y。

在 `/playground` 至少验证与组件相关的：

- default、hover、focus-visible、disabled；
- loading、empty、error；
- 长文本、CJK / Latin 宽度、真实密度；
- light / dark；
- 390px、960px、1440px；涉及 `lg` 切换时补 960 / 961px 边界；
- 键盘操作、可访问名、console errors。

只保留有意义的状态，不为纯展示件制造虚假矩阵。

## 3. 晋升到正式真源

### Foundation

- component → `foundation/components/<scene>/<Name>.vue`；跨场景裸名组件可放 `foundation/components/` 根。
- composition → `foundation/compositions/<Name>.vue`。
- composable → `foundation/composables/`。
- util → `foundation/utils/`。
- token / CSS → `foundation/assets/css/`。
- app / UI config → `foundation/config/`。

### Kit

- component → `kits/<kit>/components/<Name>.vue`。
- composable → `kits/<kit>/composables/`。
- util → `kits/<kit>/utils/`。

kit 只能依赖 foundation 或同 kit item；禁止 kit → kit。私有 spec、adapter、fixture、demo 数据和页面 recipe 留在根 `app/` 或消费项目。

### 命名原则

晋升时定名遵循三条原则：

1. **领域词取自上游规范**（协议、标准、成熟 UI 模式词），不自造——规范词自带精确定义与检索性。
2. **命名契约而非内容**：名字描述组件对外承诺的职责与形态，不描述当前恰好装载的内容，避免把组件锁死在单一用途上。
3. **家族用正交矩阵**：同族组件按「语义维度 × 形态档位」组合命名，新成员的名字应能直接推导出来。

名字负责精确，直观性缺口由 spec 的 anatomy 节补足，不为直观牺牲准确。

## 4. 更新根 registry

按 `references/registry.md`：

1. 新建或更新 owning item；
2. `files[]` 列出全部自有 source / target；
3. 共享切片通过 `registryDependencies[]` 传递，不重复列文件；
4. 确认 target 下的 Nuxt 自动导入命名稳定；
5. 运行 `pnpm registry:validate && pnpm test:registry`。

不存在 `coreDeps`、kit 内 registry 或 npm layer 兜底。

## 5. 加正式 gallery

通用组件加入根 `app/components/gallery/<Group>.vue` 的 `<GalleryEntry>`；kit 组件加入 `app/pages/kits/<kit>/` 对应页面。条目只展示真实渲染和关键 facet，Usage 指回 references，不复制 props 表或源码。

页面级 recipe 留在根 app（如 `app/components/demo/api-docs/DocsShell.vue`）。注意「私有 → kit」的边界会随组件解耦而移动：`CodeRail` 曾是 gallery-private recipe，解除页面 chrome 耦合后已提升为 kit 组件 `<ApiDocsCodeRail>` 并进入 registry（见 ADR-010）。

## 6. 完整 gate

```bash
pnpm registry:validate
pnpm test:registry
pnpm typecheck
pnpm build
pnpm test:consumer
```

- root gate 证明真源 gallery 可运行；
- consumer gate 证明选定 registry 切片在独立 Nuxt 项目中可安装并 build；
- 两者都通过后，才算晋升完成。

## 7. 收尾与授权

推送前明确列出：正式源码、registry、gallery / fixture、references、playground 处置及验证结果。人工只需决定是否采纳、是否授权 push；CI 负责构建 Source-first dist-skill release，不再发 npm 或 bump starter。

## API Docs 示例

1. 候选 `FieldItem` 先放 `playground/`，在 `/playground` 摆紧凑、高密度、递归与深链接状态。
2. 采纳后移动到 `kits/api-docs/components/FieldItem.vue`，配套 composable 放 `kits/api-docs/composables/`。
3. 更新根 `registry.json` 的 `field-item` item 与依赖闭包。
4. 将稳定 demo 提升到 `app/pages/kits/api-docs/`；页面私有 fixture / adapter 留在 `app/`。
5. 清理 playground，运行完整 gate，等待 push 授权。
