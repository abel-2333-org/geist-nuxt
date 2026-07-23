<script setup lang="ts">
definePageMeta({ nav: false })
</script>

<template>
  <div>
    <PlaygroundStage
      title="Annotation 家族候选"
      description="叙事 markdown 行内注释:概念解释 / API 字段关联 / 站内文档预览。壳 + 三形态,hover 增强、click 兜底。spec 见 playground/annotation.spec.md。"
    >
      <PlaygroundAnnotationDemo />
    </PlaygroundStage>
  </div>
</template>
