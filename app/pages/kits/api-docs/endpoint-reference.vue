<script setup lang="ts">
import FactList from '../../../../kits/api-docs/internal/FactList.vue'
import FactRow from '../../../../kits/api-docs/internal/FactRow.vue'

definePageMeta({ nav: { label: '端点参考页', icon: 'i-lucide-columns-2', order: 1 } })

// API 文档场景的「整页级端点组合」demo（不是可分发切片，也不是通用组件）——
// 与 Webhook 参考页 /kits/api-docs/webhook-reference 镜像对称：端点问「你怎么
// 调平台」，webhook 问「平台怎么回调你」。此前端点的证据是散的：
//   - 旧 reference.vue 有 linked scenario 与手写 h1，但缺环境联动、独立 error
//     区、facts/relations 扩展区，也没有 full/partial/minimal 三态；
//   - 文档站外壳的端点段（DocsShellReference）有环境联动（OperationTarget +
//     host 派生请求示例），却是出血多域外壳 recipe，且缺 linked scenario。
// 没有任何一处把「identity + 环境联动 + requirements/guide 扩展区 + 请求/响应
// 字段树 + 独立 error response 字段与目录 + relations 扩展区 + 双例码轨道」收在一个可运行
// baseline 里。本页补上这个 baseline：验证现有 kit primitives 已足以支撑整页
// 端点 recipe，并与 webhook-reference.vue 严格对称。
//
// 阅读顺序（= DOM 顺序）——左栏是纯文档流，按端点「调用生命周期」排序（=
// 开发者集成时的思考顺序：往哪调 → 满足前置 → 发什么 → 收什么 → 出错怎么办
// → 相关背景）：
//   identity 头（METHOD 徽章 + path + h1 摘要 + 描述）
//   → 环境联动（<OperationTarget>：host 切换 + 地址 + 复制，紧贴头部）；
//   → REQUIREMENTS / GUIDE：可选前置事实与指南扩展区；
//   → REQUEST / RESPONSE BODY 字段树（整页主角）；
//   → ERROR RESPONSE / ERRORS：独立错误响应字段树 + 错误目录（error code →
//     含义 → 触发条件），字面错误响应体作为「线缆样本」归右栏（与 ACK 的
//     IA 裁决同构），左栏保留字段契约与 facts 目录并指向右栏；
//   → RELATED RESOURCES：可选 relations 扩展区（背景参考殿后）。
// 右栏「线缆样本」= 端点的两个方向，用 <CodeRail> 纵向双栏：
//   Request（你 → 平台，上）/ Response（平台 → 你，下）。Response 的状态维度
//   同时承载成功体与错误样本（400/401/409），与左栏 ERRORS 目录连线。
//
// identity 头手写以取得页面唯一 <h1>（与 webhook-reference.vue 对称）：
// standalone 单 operation 页里端点摘要即页面唯一 h1，而
// <OperationHeader> 的 headingLevel 上限是 2（供「域 h1 下多 operation」
// 的外壳场景，见 DocsShellReference）。两条路径都成立，取决于页面是单
// operation 还是多 operation——这是刻意的分层，不是缺口。
//
// 所有数据由本页内联中性假 ViewModel 注入；kit 组件保持数据无关、locale-ready。

// --- 端点身份（本页唯一 <h1>）---
const endpoint = {
  method: 'POST',
  path: '/v1/deployments',
  summary: '创建部署',
  description:
    '从 Git 仓库或内联文件集为项目触发一次新部署，返回创建的部署对象及其初始构建状态。',
}

// --- 环境联动：选中 host 提升到本页持有——OperationTarget（地址栏 + 复制）
// 与右栏请求示例从同一个 host 派生，切环境时两处同步更新（与
// DocsShellReference 同装配，但此页是 standalone baseline）。---
const hosts = [
  { id: 'production', label: '生产', baseUrl: 'https://api.example.com' },
  { id: 'sandbox', label: '沙箱', baseUrl: 'https://sandbox.example.com' },
]
const selectedHostId = ref(hosts[0]!.id)
const selectedHost = computed(
  () => hosts.find(h => h.id === selectedHostId.value) ?? hosts[0]!,
)

// --- 通用扩展区：由页面/consumer 持有，kit 不定义认证或 relation 业务 shape ---
// full 同时提供 requirements/guide + relations；partial 只保留 requirements；
// minimal 两者都省略，扩展区独立出现/省略时不会留下空壳。
const requirements = [
  { term: '认证', value: 'Bearer token，作用域需含 `deployments:write`。' },
  { term: 'Content-Type', value: 'application/json 或 multipart/form-data。' },
]
const relations = [
  {
    label: '部署对象',
    description: '查看返回的部署对象完整字段。',
    to: '#res_id',
  },
  {
    label: '构建状态',
    description: '了解部署状态机各枚举值的含义。',
    to: '#res_state',
  },
]

// --- 请求示例：两个业务场景，触发工具栏场景 select；host 派生 baseUrl，
// 切环境时地址随之更新。用工厂按 baseUrl 生成，故用 computed 包裹。---
function makeRequestScenarios(baseUrl: string) {
  return [
    {
      id: 'git',
      label: 'Git 部署',
      variants: [
        {
          label: 'cURL',
          language: 'bash',
          code: `curl -X POST ${baseUrl}/v1/deployments \\
  -H "Authorization: Bearer $TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{
    "name": "my-app",
    "type": "git",
    "target": "production",
    "gitSource": { "repoId": "ghr_9f2a", "ref": "main" }
  }'`,
        },
        {
          label: 'JavaScript',
          language: 'js',
          code: `const res = await fetch("${baseUrl}/v1/deployments", {
  method: "POST",
  headers: {
    Authorization: \`Bearer \${token}\`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    name: "my-app",
    type: "git",
    target: "production",
    gitSource: { repoId: "ghr_9f2a", ref: "main" },
  }),
})
const deployment = await res.json()`,
        },
        {
          label: 'Python',
          language: 'python',
          code: `import requests

res = requests.post(
    "${baseUrl}/v1/deployments",
    headers={"Authorization": f"Bearer {token}"},
    json={
        "name": "my-app",
        "type": "git",
        "target": "production",
        "gitSource": {"repoId": "ghr_9f2a", "ref": "main"},
    },
)
deployment = res.json()`,
        },
      ],
    },
    {
      id: 'inline',
      label: '文件部署（仅请求）',
      variants: [
        {
          label: 'cURL',
          language: 'bash',
          code: `curl -X POST ${baseUrl}/v1/deployments \\
  -H "Authorization: Bearer $TOKEN" \\
  -F 'name=my-app' \\
  -F 'type=inline' \\
  -F 'files=@index.html'`,
        },
      ],
    },
  ]
}
const requestScenarios = computed(() => makeRequestScenarios(selectedHost.value.baseUrl))

// --- 响应示例：场景 + 状态双维度切换。状态维度同时承载成功体（200/204）与
// 错误样本（400/401/409）——错误的「字面响应体」是线缆样本，与左栏 ERRORS
// 目录连线：目录讲「有哪些错、为什么」，右栏给「长什么样」。---
const responseScenarios = [
  {
    id: 'git',
    label: 'Git 部署',
    statuses: [
      {
        status: 200,
        statusText: 'OK',
        bodies: [
          {
            id: 'json',
            kind: 'code' as const,
            mediaType: 'application/json',
            variants: [
              {
                language: 'json',
                code: `{
  "id": "dpl_8Kx2fQ",
  "name": "my-app",
  "target": "production",
  "state": "READY",
  "url": "https://my-app.example.app",
  "gitSource": { "repoId": "ghr_9f2a", "ref": "main" },
  "createdAt": 1720000000000
}`,
              },
            ],
          },
          {
            id: 'vendor-json',
            kind: 'code' as const,
            mediaType: 'application/vnd.geist.deployment+json',
            variants: [
              {
                language: 'json',
                code: `{
  "id": "dpl_8Kx2fQ",
  "url": "https://my-app.example.app",
  "state": "READY",
  "createdAt": 1753366800000
}`,
              },
            ],
          },
        ],
      },
      {
        // 有意空正文（区别于「缺示例」），见组件目录页全形态演示。
        status: 204,
        statusText: 'No Content',
        bodies: [{ id: 'empty', kind: 'empty' as const, note: '异步受理，协议约定不返回正文。' }],
      },
      {
        status: 400,
        statusText: 'Bad Request',
        description: '请求体未通过校验，见左栏「错误目录」的 invalid_name。',
        bodies: [
          {
            id: 'json',
            kind: 'code' as const,
            mediaType: 'application/json',
            variants: [
              {
                language: 'json',
                code: `{
  "error": {
    "code": "invalid_name",
    "message": "Project name must be lowercase letters, digits and dashes."
  }
}`,
              },
            ],
          },
        ],
      },
      {
        status: 401,
        statusText: 'Unauthorized',
        bodies: [
          {
            id: 'json',
            kind: 'code' as const,
            mediaType: 'application/json',
            variants: [
              {
                language: 'json',
                code: `{
  "error": { "code": "forbidden", "message": "Missing or invalid token." }
}`,
              },
            ],
          },
        ],
      },
      {
        status: 409,
        statusText: 'Conflict',
        bodies: [
          {
            id: 'json',
            kind: 'code' as const,
            mediaType: 'application/json',
            variants: [
              {
                language: 'json',
                code: `{
  "error": { "code": "name_taken", "message": "A project with this name already exists." }
}`,
              },
            ],
          },
        ],
      },
    ],
  },
  {
    // 响应侧独有场景：选择后 RequestExample 找不到同 id，确定性派生到首项，
    // 但不回写父级；与 request-only inline 场景共同验证双向缺侧 fallback。
    id: 'async',
    label: '异步结果（仅响应）',
    statuses: [
      {
        status: 202,
        statusText: 'Accepted',
        bodies: [
          {
            id: 'json',
            kind: 'code' as const,
            mediaType: 'application/json',
            variants: [
              {
                language: 'json',
                code: `{
  "id": "dpl_8Kx2fQ",
  "url": "https://my-app.example.app/deployments/dpl_8Kx2fQ",
  "state": "QUEUED",
  "createdAt": 1753366800000
}`,
              },
            ],
          },
        ],
      },
    ],
  },
]

// --- 独立 ERRORS 目录：error code → 含义 → 触发条件。是端点侧的「独立 error
// 区」——不把错误折进右栏状态切换器了事，而是左栏成岛陈列，与右栏错误样本
// （400/401/409 状态）连线。用中性 dl，consumer 持有已本地化内容。---
const errors = [
  { code: 'invalid_name', status: 400, when: '`name` 不满足格式或长度约束。' },
  { code: 'forbidden', status: 401, when: 'token 缺失、过期或作用域不含 `deployments:write`。' },
  { code: 'name_taken', status: 409, when: '同名部署已存在于该项目。' },
]

// --- 字段树：递归 schema，驱动左侧文档流（够长以演示滚动 + sticky 右栏） ---
const enumValues = [
  { value: 'production', description: '面向终端用户的线上环境。' },
  { value: 'preview', description: '按分支生成的预览部署，供评审；支持 `?token=` 访问。' },
  { value: 'development', description: '本地或临时环境，**不**对外路由。' },
]

const bodyFields = [
  {
    path: 'req_name',
    name: 'name',
    type: 'string',
    required: true,
    description: '项目唯一名称，会成为默认域名的一部分。',
    examples: ['my-app'],
    notes: [
      { label: '范围', text: '1–52 个字符。' },
      { label: '规则', text: '仅限小写字母、数字与 `-`。' },
    ],
  },
  {
    path: 'req_type',
    name: 'type',
    type: 'enum',
    required: true,
    description: '部署来源类型，决定必填的是 `gitSource` 还是 `files`。',
    enumValues: [
      { value: 'git', description: '从已连接的 Git 仓库构建。' },
      { value: 'inline', description: '直接上传一个或多个文件。' },
    ],
  },
  {
    path: 'req_target',
    name: 'target',
    type: 'enum',
    required: false,
    defaultValue: 'production',
    description: '部署环境。',
    enumValues,
  },
  {
    path: 'req_files',
    name: 'files',
    type: 'array',
    required: 'conditional' as const,
    condition: '`type` 为 `inline` 时必填。',
    description: '内联部署上传的文件。',
    children: [
      {
        path: 'req_files_item',
        name: 'item',
        type: 'string',
        format: 'binary',
        required: true,
        description: '部署包中的一个文件。',
      },
    ],
  },
  {
    path: 'req_gitSource',
    name: 'gitSource',
    type: 'object',
    required: 'conditional' as const,
    condition: '`type` 为 `git` 时必填。',
    lifecycle: { status: 'beta' as const, since: 'v2.4', description: 'Beta 期间结构仍可能变化。' },
    description: '用于部署的 Git 仓库。',
    children: [
      {
        path: 'req_gitSource_repoId',
        name: 'repoId',
        type: 'string',
        required: true,
        description: '已连接仓库的 id。',
        examples: ['ghr_9f2a'],
      },
      {
        path: 'req_gitSource_ref',
        name: 'ref',
        type: 'string',
        required: false,
        defaultValue: 'main',
        description: '要构建的分支、标签或 commit SHA。',
      },
      {
        path: 'req_gitSource_legacyBranch',
        name: 'legacyBranch',
        type: 'string',
        required: false,
        lifecycle: { status: 'deprecated' as const, since: 'v2.4', description: '请改用 `ref`。' },
        description: '旧版分支选择器。',
      },
    ],
  },
  {
    path: 'req_meta',
    name: 'meta',
    type: 'object',
    required: false,
    lifecycle: { status: 'new' as const, since: 'v2.5' },
    description: '附加在部署上的任意键值元数据。',
    notes: [
      { label: '范围', text: '最多 16 个键。' },
      { kind: 'caveat' as const, label: '注意', text: '值以明文存储，不要放入密钥。' },
    ],
    children: [
      { path: 'req_meta_key', name: 'key', type: 'string', required: true, notes: [{ label: '范围', text: '最多 64 个字符。' }] },
      { path: 'req_meta_value', name: 'value', type: 'string', required: true },
    ],
  },
]

const responseFields: FieldNode[] = [
  { path: 'res_id', name: 'id', type: 'string', required: true, description: '部署的唯一 id。', examples: ['dpl_8Kx2fQ'] },
  {
    path: 'res_state',
    name: 'state',
    type: 'enum',
    required: true,
    description: '当前构建状态。',
    enumValues: [
      { value: 'QUEUED', description: '等待构建资源。' },
      { value: 'BUILDING', description: '构建进行中。' },
      { value: 'READY', description: '已部署并对外提供服务。' },
      { value: 'ERROR', description: '构建失败。' },
    ],
  },
  {
    path: 'res_url',
    name: 'url',
    type: 'string',
    // Output presence (issue #127): the key is absent until the build is
    // ready, and `null` when the build failed — two facts, one condition.
    presence: {
      optional: true,
      nullable: true,
      condition: '`state` 为 `QUEUED` 或 `BUILDING` 时不返回；`state` 为 `ERROR` 时为 `null`。',
    },
    description: '部署进入 `READY` 后的公开访问地址。',
    examples: ['https://my-app.example.app'],
  },
  { path: 'res_createdAt', name: 'createdAt', type: 'integer', format: 'unix_ms', required: true, description: '创建时间戳（毫秒）。' },
]

const errorResponseFields = [
  {
    path: 'err_error',
    name: 'error',
    type: 'object',
    required: true,
    description: '非 2xx 响应返回的结构化错误。',
    children: [
      {
        path: 'err_error_code',
        name: 'code',
        type: 'string',
        required: true,
        description: '稳定的机器可读错误码。',
        examples: ['invalid_name'],
      },
      {
        path: 'err_error_message',
        name: 'message',
        type: 'string',
        required: true,
        description: '面向读者的失败说明。',
        examples: ['Project name must be lowercase letters, digits and dashes.'],
      },
    ],
  },
]

// --- 场景联动（linked）：页面级一个 ref 同时绑 Request / Response 的
// v-model:scenario。请求侧缺 async、响应侧缺 inline：任一侧选中独有场景时，
// 另一侧确定性收敛到第一项（fallback 只派生不回写），双向演示缺侧行为。
// scenario 间的 mapping 归本页（consumer）持有，kit 组件零 mapping。
const activeScenario = ref('git')

// --- chrome 本地化：kit 组件的英文默认只是中性兜底，中文页面由页面注入整套文案
// （与 webhook 参考页同口径）。保留为英文的只有领域词汇与标识符：METHOD 徽章、
// Beta / Deprecated / New 状态词、HTTP 状态短语、header 名与字段名等字面量。
// 右栏 Request / Response 示例卡的 chrome 全 gallery 统一沿用英文默认，另行处理。
const targetLabels = {
  copy: '复制完整地址',
  copied: '接口地址已复制',
  copyFailed: '复制失败，请手动复制地址',
  copyHost: '复制环境地址',
  copiedHost: '环境地址已复制',
  copyPath: '复制接口路径',
  copiedPath: '接口路径已复制',
}
const fieldLabels: FieldItemLabels = {
  required: '必填',
  conditional: '条件必填',
  mayBeOmitted: '响应中可能不返回此字段',
  default: '默认值',
  example: '示例',
  constraints: '约束',
  note: '说明',
  caveat: '注意',
  since: '起始版本',
  showChildren: '展开子参数',
  hideChildren: '收起子参数',
  copyLink: name => `复制 ${name} 的链接`,
  copiedLink: name => `${name} 的链接已复制`,
  linkCopied: name => `${name} 的链接已复制到剪贴板`,
  linkCopyFailed: () => '复制失败，请选中地址栏手动复制',
  // 只注入本页会渲染到的键：最大的 enum 只有 4 个值，低于 EnumTable 的筛选阈值（8），
  // 筛选框与 live region 不挂载，对应文案不预置。
  enumLabel: '允许值',
}

// --- 组合级形态变体的 fixture（区别于组件级变体）---
// partial：单 host（无环境 select，只剩地址 + 复制）、保留精简 errors、
//          省略 relations 与 requirements。
const partialHosts = [{ id: 'production', label: '生产', baseUrl: 'https://api.example.com' }]
const partialBodyFields = [
  { path: 'p_name', name: 'name', type: 'string', required: true, description: '项目名。' },
  { path: 'p_target', name: 'target', type: 'enum', required: false, defaultValue: 'production', description: '部署环境。', enumValues },
]
const partialErrors = [
  { code: 'invalid_name', status: 400, when: '`name` 不满足格式约束。' },
]

// minimal：一个「只读」端点——无环境切换、无 errors 目录、无 relations，
//          正文只有 identity + 极简请求/响应字段。整页依然成立。
const minimalBodyFields = [
  { path: 'm_id', name: 'id', type: 'string', required: true, description: '部署 id。' },
]
const minimalResponseFields = [
  { path: 'm_state', name: 'state', type: 'string', required: true, description: '当前构建状态。' },
]

// 深链接：带 `#path` 进入时自动展开 + 滚动定位到对应字段。
const anchor = useFieldAnchor()
onMounted(() => anchor.initFromHash())
</script>

<template>
  <UContainer class="py-10 sm:py-14">
    <!-- 主 baseline：完整端点参考页。招牌两栏：左文档流 / 右双例码轨道。 -->
    <SplitPane
      direction="row"
      mode="fixed"
      fixed-pane="end"
      sticky
      sticky-top="5rem"
      storage-key="geist-api-endpoint-rail"
      :default-size="480"
      :min-size="380"
      :max-size="720"
      :min-opposite="380"
      label="调整文档栏与代码栏的宽度"
    >
      <!-- 左：文档流（端点头 + 环境 + 前置 + 字段树 + 错误目录 + relations） -->
      <template #start>
        <div class="lg:pe-8">
          <!-- identity 头：手写以取得页面唯一 h1（与 webhook-reference.vue 对称）。 -->
          <header class="space-y-4 border-b border-default pb-8">
            <div class="flex flex-wrap items-center gap-2.5">
              <HttpMethodBadge :method="endpoint.method" />
              <code class="min-w-0 truncate font-mono text-sm text-highlighted">{{ endpoint.path }}</code>
            </div>
            <h1 class="text-2xl font-semibold tracking-tight text-highlighted text-balance sm:text-3xl sm:leading-tight">
              {{ endpoint.summary }}
            </h1>
            <p class="max-w-2xl leading-relaxed text-muted text-pretty">
              {{ endpoint.description }}
            </p>
            <!-- 环境联动：host 切换 + 分段地址（host / path 文本本身即复制控件）
                 + 复制完整地址，紧贴头部。选中 host 由本页持有，右栏请求示例从
                 同一 host 派生。 -->
            <OperationTarget
              v-model="selectedHostId"
              :hosts="hosts"
              :path="endpoint.path"
              select-label="选择环境"
              :labels="targetLabels"
            />
          </header>

          <div class="mt-8 space-y-10">
            <!-- 可选 requirements / guide 扩展区：页面只定义位置与语义层级，
                 consumer 自己提供已解析、已本地化的内容。 -->
            <FieldGroup label="前置条件">
              <div class="space-y-4 pt-2">
                <FactList>
                  <!-- rich fact 走 FactRow 的 #value seam（同 WebhookProtocol 的
                       inline-markdown opt-in）：FactRow 默认 value 是纯文本，
                       markdown 记号会字面保留，页面自己决定在哪里开富文本。 -->
                  <FactRow
                    v-for="item in requirements"
                    :key="item.term"
                    :fact="item"
                  >
                    <template #value>
                      <span class="wrap-anywhere text-sm text-highlighted">
                        <InlineMarkdown :text="item.value" />
                      </span>
                    </template>
                  </FactRow>
                </FactList>
              </div>
            </FieldGroup>

            <FieldGroup label="请求体" :count="bodyFields.length">
              <FieldItem v-for="f in bodyFields" :key="f.path ?? f.name" v-bind="f" :labels="fieldLabels" />
            </FieldGroup>

            <!-- Notation legend — owned by the PAGE, not the kit: FieldItem's
                 `?` tooltip never opens on touch, so the one visible sentence
                 that explains the notation lives with the field section. -->
            <!-- One flow item: the legend is the preface of the group below
                 it, not a section of its own in the outer rhythm. -->
            <div class="space-y-4">
              <p class="text-sm leading-relaxed text-muted">
                <code class="font-mono text-code">name?</code> 表示该字段可能不出现在响应中；
                <code class="font-mono text-code">| null</code> 表示该字段存在但值可能为 null。
              </p>
              <FieldGroup label="响应体" :count="responseFields.length">
                <FieldItem v-for="f in responseFields" :key="f.path ?? f.name" v-bind="f" :labels="fieldLabels" />
              </FieldGroup>
            </div>

            <FieldGroup label="错误响应体" :count="errorResponseFields.length">
              <FieldItem
                v-for="f in errorResponseFields"
                :key="f.path ?? f.name"
                v-bind="f"
                :labels="fieldLabels"
              />
            </FieldGroup>

            <!-- 独立 ERRORS 目录：error code → 含义 → 触发条件。字面错误响应体
                 作为线缆样本归右栏（Response 的 4xx 状态），此处只留目录并连线。 -->
            <FieldGroup label="错误目录" :count="errors.length">
              <dl class="divide-y divide-default">
                <div
                  v-for="err in errors"
                  :key="err.code"
                  class="flex flex-col gap-1.5 py-3 sm:flex-row sm:items-baseline sm:gap-4"
                >
                  <dt class="flex shrink-0 items-center gap-2 sm:w-56">
                    <code class="font-mono text-sm text-highlighted">{{ err.code }}</code>
                    <span class="font-mono text-xs text-dimmed">{{ err.status }}</span>
                  </dt>
                  <dd class="text-sm leading-relaxed text-muted">
                    <InlineMarkdown :text="err.when" />
                  </dd>
                </div>
              </dl>
              <p class="mt-2 text-sm text-dimmed">
                各错误的响应体样本见右栏 Response 的对应状态。
              </p>
            </FieldGroup>

            <!-- 可选 relations 扩展区：仅承载通用链接/描述，不把消费项目路由
                 shape 固化进 kit。 -->
            <FieldGroup label="相关资源">
              <ul class="divide-y divide-default">
                <li v-for="relation in relations" :key="relation.to">
                  <ULink
                    :to="relation.to"
                    class="group flex items-start justify-between gap-4 py-3 text-highlighted"
                  >
                    <span class="min-w-0">
                      <span class="block text-sm font-medium group-hover:underline">{{ relation.label }}</span>
                      <span class="mt-1 block text-sm leading-relaxed text-muted">{{ relation.description }}</span>
                    </span>
                    <UIcon
                      name="i-lucide-arrow-right"
                      class="mt-0.5 size-4 shrink-0 text-dimmed transition-transform group-hover:translate-x-0.5"
                      aria-hidden="true"
                    />
                  </ULink>
                </li>
              </ul>
            </FieldGroup>
          </div>
        </div>
      </template>

      <!-- 右：双例码轨道。lg+ 钉成视口高 sticky 长条，Request/Response 纵向分栏 +
           内容优先重分配；<lg 回退为堆叠各卡自滚动。 -->
      <template #end>
        <div class="lg:sticky lg:top-20 lg:h-[calc(100dvh-7rem)]">
          <CodeRail
            storage-key="api-docs-endpoint-rail-split"
            resize-label="调整请求与响应面板的高度"
            class="h-full max-lg:space-y-4"
          >
            <template #top="{ maxHeight }">
              <RequestExample
                v-model:scenario="activeScenario"
                :scenarios="requestScenarios"
                :max-height="maxHeight"
              />
            </template>
            <template #bottom="{ maxHeight }">
              <ResponseExample
                v-model:scenario="activeScenario"
                :scenarios="responseScenarios"
                :max-height="maxHeight"
              />
            </template>
          </CodeRail>
        </div>
      </template>
    </SplitPane>

    <USeparator class="my-14" />

    <!-- 组合级形态变体：整页在「环境/错误/relations 部分缺席」时依然连贯——
         不渲染空壳、不留占位。区别于组件级变体（body 语义全形态、method 五色），
         后者见 /kits/api-docs（组件目录）。 -->
    <section class="space-y-6">
      <div class="space-y-2">
        <h2 class="text-xl font-semibold tracking-tight text-highlighted">组合级形态变体</h2>
        <p class="max-w-2xl leading-relaxed text-muted text-pretty">
          同一套组件在「单环境 / 无错误目录 / 无 relations」时如何收敛。组件级的
          省略规则（body 语义、字段门控）见
          <code class="font-mono text-code">/kits/api-docs</code>。
        </p>
      </div>

      <div class="grid gap-6 lg:grid-cols-2">
        <!-- partial：单 host（无环境 select）、保留精简 errors、省略 relations -->
        <figure class="min-w-0 space-y-4 rounded-lg border border-default p-6">
          <figcaption class="text-sm font-medium text-toned">
            Partial —— 单环境（地址无 select）、保留精简 errors，省略 requirements 与 relations
          </figcaption>
          <header class="space-y-3 border-b border-default pb-5">
            <div class="flex flex-wrap items-center gap-2.5">
              <HttpMethodBadge method="GET" />
              <code class="min-w-0 truncate font-mono text-sm text-highlighted">/v1/deployments/{id}</code>
            </div>
            <h3 class="text-lg font-semibold tracking-tight text-highlighted">获取部署</h3>
            <OperationTarget
              :hosts="partialHosts"
              path="/v1/deployments/{id}"
              :labels="targetLabels"
            />
          </header>
          <FieldGroup label="响应体" :count="partialBodyFields.length" :heading-level="4">
            <FieldItem v-for="f in partialBodyFields" :key="f.path" v-bind="f" :labels="fieldLabels" />
          </FieldGroup>
          <FieldGroup label="错误目录" :count="partialErrors.length" :heading-level="4">
            <dl class="divide-y divide-default">
              <div v-for="err in partialErrors" :key="err.code" class="flex items-baseline gap-3 py-2.5">
                <dt class="flex shrink-0 items-center gap-2">
                  <code class="font-mono text-sm text-highlighted">{{ err.code }}</code>
                  <span class="font-mono text-xs text-dimmed">{{ err.status }}</span>
                </dt>
                <dd class="text-sm leading-relaxed text-muted">
                  <InlineMarkdown :text="err.when" />
                </dd>
              </div>
            </dl>
          </FieldGroup>
        </figure>

        <!-- minimal：只读端点——无环境切换、无 errors、无 relations -->
        <figure class="min-w-0 space-y-4 rounded-lg border border-default p-6">
          <figcaption class="text-sm font-medium text-toned">
            Minimal —— 只读端点：无环境切换、无错误目录，正文只有 identity + 极简字段
          </figcaption>
          <header class="space-y-3 border-b border-default pb-5">
            <div class="flex flex-wrap items-center gap-2.5">
              <HttpMethodBadge method="GET" />
              <code class="min-w-0 truncate font-mono text-sm text-highlighted">/v1/health</code>
            </div>
            <h3 class="text-lg font-semibold tracking-tight text-highlighted">健康检查</h3>
          </header>
          <FieldGroup label="请求参数" :count="minimalBodyFields.length" :heading-level="4">
            <FieldItem v-for="f in minimalBodyFields" :key="f.path" v-bind="f" :labels="fieldLabels" />
          </FieldGroup>
          <FieldGroup label="响应体" :count="minimalResponseFields.length" :heading-level="4">
            <FieldItem v-for="f in minimalResponseFields" :key="f.path" v-bind="f" :labels="fieldLabels" />
          </FieldGroup>
        </figure>
      </div>

      <p class="text-sm text-dimmed">
        所有 fixture 均由本页内联，不写进 kit；组件保持数据无关，整页组合是 gallery 私有 recipe。
      </p>
    </section>
  </UContainer>
</template>
