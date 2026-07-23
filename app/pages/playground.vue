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

    <PlaygroundStage
      title="Composition schema 候选"
      description="OpenAPI / JSON Schema composition 呈现:oneOf 用 tabs、anyOf 用可折叠分区、allOf 全展开,discriminator 作为每个 variant 的首行真实字段,deep link 自动揭示隐藏 variant。spec 见 playground/composition.spec.md。"
    >
      <PlaygroundCompositionDemo />
    </PlaygroundStage>
  </div>
</template>
