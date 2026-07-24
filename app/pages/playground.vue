<script setup lang="ts">
definePageMeta({ nav: false })
</script>

<template>
  <div>
    <PlaygroundStage
      title="Playground"
      description="未采纳组件候选的暂存区。用真实状态数据验证 HMR 后，按 references/method/component-reflow.md 决定归属（foundation / kit）或删除。当前无进行中的候选。"
    >
      <p class="text-sm text-muted">
        暂无候选。新增候选组件放
        <code class="font-mono text-[0.8125rem]">playground/components/</code>
        并在此挂载预览。
      </p>
    </PlaygroundStage>
  </div>
</template>
