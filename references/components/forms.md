# 表单

表单控件统一用 **`UFormField`** 包裹以获得 label / description / error 的无障碍关联，用 **`UForm`** 做校验。

## UFormField

**Anatomy**：label · description · value(默认 slot 里的控件) · error text · helper(hint)。

**关键 props**：`label` `description` `hint` `help` `error`(字符串或布尔) `required` `name`(配合 UForm 校验)。

自动建立 `for` / `aria-describedby` / `aria-invalid` 关联——**不要手工拆散**。

```vue
<UFormField label="邮箱" description="用于登录" required name="email">
  <UInput v-model="email" type="email" placeholder="you@example.com" />
</UFormField>
```

## UForm

**关键 props**：`state`(响应式数据对象) `schema`(Zod/Valibot 等) `@submit`。校验错误自动分发到对应 `name` 的 `UFormField`。

```vue
<script setup lang="ts">
import { z } from 'zod'
const schema = z.object({ email: z.string().email() })
const state = reactive({ email: '' })
function onSubmit() { /* 校验通过后 */ }
</script>
<template>
  <UForm :schema="schema" :state="state" @submit="onSubmit" class="space-y-4">
    <UFormField label="邮箱" name="email">
      <UInput v-model="state.email" />
    </UFormField>
    <UButton type="submit">提交</UButton>
  </UForm>
</template>
```

## 控件

- **UInput**：`v-model` `type` `placeholder` `icon`(leading) `size` `color` `variant` `disabled` `loading`。
- **UTextarea**：`v-model` `rows` `autoresize`。
- **USelect**：`v-model` `:items`（`{label,value}[]` 或字符串数组）`placeholder` `multiple`。
- **USelectMenu**：可搜索的高级 select。
- **UCheckbox**：`v-model`(布尔) `label`。
- **USwitch**：`v-model`(布尔) `label`；开关语义（即时生效）。
- **URadioGroup**：`v-model` `:items`。
- **UInputNumber** / **UInputMenu** / **UPinInput** 等按需。

## State model（控件通用）

default/hover/focus-visible(紫色环)/`disabled`(不可聚焦)/`loading`/`invalid`(error 色，由 UFormField 的 error 触发)。readonly 场景用控件的 `readonly`（可聚焦不可改，区别于 disabled）。

## Accessibility

- 每个控件都在 `UFormField` 内，label 自动关联。
- 错误文本通过 `UFormField error` 呈现并 `aria-live` 播报。
- `USwitch` 用于"即时切换"，表单里需"确认后提交"的布尔项用 `UCheckbox`。

## 源码参考

 - `src/runtime/components/{Form,FormField,Input,Select,Checkbox,Switch}.vue`（reference workspace: nuxt/ui@v4）
 - starter 用法：`packages/core/app/components/showcase/ShowcaseComponents.vue`
