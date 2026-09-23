<script setup lang="ts">
defineOptions({ inheritAttrs: false })
</script>

<template>
  <!-- Browser preference must resolve before the button's localized name renders.
       Forward caller attrs to the button, keeping the tap-target touch contract. -->
  <ClientOnly>
    <UColorModeButton v-bind="$attrs" class="touch-manipulation" />
  </ClientOnly>
</template>
