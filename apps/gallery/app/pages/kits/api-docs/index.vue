<script setup lang="ts">
definePageMeta({ nav: { label: 'API Docs', icon: 'i-lucide-file-code', order: 0 } })

// API 文档场景的组合演示（demo/story）——按 geist-nuxt「demo 归 gallery、kit 只 ship
// 数据无关积木」的分层，这里用内联假 ViewModel 驱动 kit 的数据无关组件：代码块 /
// 请求 / 响应（ApiDocsCodeBlock、ApiDocsResponseExample）+ method / lifecycle 徽章
// + enum 值表（ApiDocsMethodBadge、ApiDocsLifecycleBadge、ApiDocsEnumTable）。
const requestSamples = [
  {
    label: 'cURL',
    language: 'bash',
    code: `curl -X POST https://api.example.com/v1/deployments \\
  -H "Authorization: Bearer $TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{ "name": "my-app", "target": "production" }'`,
  },
  {
    label: 'JavaScript',
    language: 'js',
    code: `const res = await fetch("https://api.example.com/v1/deployments", {
  method: "POST",
  headers: {
    Authorization: \`Bearer \${token}\`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ name: "my-app", target: "production" }),
})
const deployment = await res.json()`,
  },
  {
    label: 'Python',
    language: 'python',
    code: `import requests

res = requests.post(
    "https://api.example.com/v1/deployments",
    headers={"Authorization": f"Bearer {token}"},
    json={"name": "my-app", "target": "production"},
)
deployment = res.json()`,
  },
]

const responseScenarios = [
  {
    id: 'created',
    label: '创建部署',
    statuses: [
      {
        status: 200,
        statusText: '部署已创建。',
        variants: [
          {
            language: 'json',
            code: `{
  "id": "dpl_8Kx2fQ",
  "name": "my-app",
  "target": "production",
  "state": "READY",
  "url": "https://my-app.example.app",
  "createdAt": 1720000000000
}`,
          },
        ],
      },
    ],
  },
]

// Domain badges + enum table — preset wrappers over core's SemanticBadge, plus
// the allowed-values table. Data-agnostic, driven here by inline sample data.
const methods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']
const lifecycles = ['new', 'beta', 'active', 'maintenance', 'deprecated', 'sunset'] as const
const enumValues = [
  { value: 'production', description: 'Live environment served to end users.' },
  { value: 'preview', description: 'Per-branch deploy for review. Supports `?token=` access.' },
  { value: 'development', description: 'Local or ephemeral environment. **Not** publicly routed.' },
]
</script>

<template>
  <UContainer class="py-16 sm:py-24">
    <section id="api-docs" class="scroll-mt-20 space-y-10">
      <div class="space-y-2">
        <h2 class="text-2xl font-semibold tracking-tight text-highlighted">API 文档场景</h2>
        <p class="text-muted max-w-2xl">
          API 文档场景的领域组件：代码块
          <code class="font-mono text-[0.8125rem]">ApiDocsCodeBlock</code>、
          请求 / 响应示例
          <code class="font-mono text-[0.8125rem]">ApiDocsRequestExample</code> /
          <code class="font-mono text-[0.8125rem]">ApiDocsResponseExample</code>，
          以及 method / lifecycle 徽章
          <code class="font-mono text-[0.8125rem]">ApiDocsMethodBadge</code> /
          <code class="font-mono text-[0.8125rem]">ApiDocsLifecycleBadge</code>
          与 enum 值表
          <code class="font-mono text-[0.8125rem]">ApiDocsEnumTable</code>。
          全部基于 Nuxt UI 原语与 Geist token；徽章在 core 的
          <code class="font-mono text-[0.8125rem]">SemanticBadge</code> 之上包一层域词汇。
        </p>
      </div>

      <div class="space-y-8">
        <div>
          <h3 class="mb-3 text-sm font-semibold text-highlighted">请求示例</h3>
          <ApiDocsCodeBlock :variants="requestSamples" />
        </div>

        <div>
          <h3 class="mb-3 text-sm font-semibold text-highlighted">响应</h3>
          <ApiDocsResponseExample :scenarios="responseScenarios" />
        </div>

        <div>
          <h3 class="mb-3 text-sm font-semibold text-highlighted">Method 徽章</h3>
          <div class="flex flex-wrap items-center gap-2">
            <ApiDocsMethodBadge v-for="m in methods" :key="m" :method="m" />
          </div>
        </div>

        <div>
          <h3 class="mb-3 text-sm font-semibold text-highlighted">Lifecycle 徽章</h3>
          <div class="flex flex-wrap items-center gap-2">
            <ApiDocsLifecycleBadge v-for="s in lifecycles" :key="s" :status="s" />
          </div>
        </div>

        <div>
          <h3 class="mb-3 text-sm font-semibold text-highlighted">Enum 值表</h3>
          <ApiDocsEnumTable :values="enumValues" />
        </div>
      </div>
    </section>
  </UContainer>
</template>
