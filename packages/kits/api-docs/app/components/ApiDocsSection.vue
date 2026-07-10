<script setup lang="ts">
// API 文档场景演示：用规格模板设计的领域组件组合而成，
// 全部基于 Nuxt UI 原语，无 @nuxt/content / SQLite 依赖，可靠且自包含。
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
</script>

<template>
  <section id="api-docs" class="scroll-mt-20 space-y-10">
    <div class="space-y-2">
      <h2 class="text-2xl font-semibold tracking-tight text-highlighted">API 文档场景</h2>
      <p class="text-muted max-w-2xl">
        用「组件规格模板」（anatomy → states → accessibility）设计的领域组件：
        <code class="font-mono text-[0.8125rem]">CodeBlock</code>、
        <code class="font-mono text-[0.8125rem]">RequestExample</code>、
        <code class="font-mono text-[0.8125rem]">ResponseExample</code>，
        全部基于 Nuxt UI 原语与 Geist token，自包含、无内容管线依赖。
      </p>
    </div>

    <div class="space-y-8">
      <div>
        <h3 class="mb-3 text-sm font-semibold text-highlighted">请求示例</h3>
        <CodeBlock :variants="requestSamples" />
      </div>

      <div>
        <h3 class="mb-3 text-sm font-semibold text-highlighted">响应</h3>
        <ResponseExample :scenarios="responseScenarios" />
      </div>
    </div>
  </section>
</template>
