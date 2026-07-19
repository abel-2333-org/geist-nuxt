<script setup lang="ts">
import type { DocsShellDomainSummary } from '~/utils/demo/api-docs/docs-shell-data'

// 域切换器（UPopover + 域卡片面板）：产品级入口用「卡片网格」而不是下拉
// 列表——每张卡 = tile 图标 + 域名 + 一句话简介。这是 Vercel/Stripe 产品
// 切换器的同构形态；用现成原语组合（UPopover + 原生按钮 radiogroup），
// 不造新组件。
//
// 图标样式遵循 Spectrum 对 workflow icon 的用法：产品级入口的图标不裸露，
// 由圆角容器（tile）承载、与 label 成对出现——对应本系统「色调表面 + 边框
// 优先」的层级语义（tile = bg-elevated + border，当前域转 primary 着色、
// 克制 tint 而非重描边）。
//
// a11y：面板 role=radiogroup、卡片 role=radio + aria-checked，表达「N 选一」
// 语义；当前域同时给打勾图标，不只靠颜色。键盘遵循 APG radiogroup 的
// roving tabindex：Tab 只在组上停一次（落在当前选中项），方向键在卡片间
// 移焦、Home/End 跳两端。因为「选中 = 切域 + 关面板」是重操作，采用 APG
// 允许的「selection 不跟随 focus」变体——方向键只移焦，Enter/Space 才选中，
// 避免第一下方向键就把面板关掉。
//
// 面板宽度按内容定：让最长简介（12 字）恰好单行，避免 CJK 逐字折行把词拆开
// （如「退/款」）。小屏两列每张卡太窄、简介必然折行——降为单列；域只有
// 四个，单列纵向也不长。

const props = defineProps<{
  domains: DocsShellDomainSummary[]
  modelValue: string
  ariaLabel?: string
}>()

const emit = defineEmits<{
  'update:modelValue': [domainId: string]
}>()

const open = shallowRef(false)
const activeDomain = computed(() => props.domains.find(domain => domain.id === props.modelValue))

function selectDomain(domainId: string) {
  open.value = false
  if (domainId === props.modelValue) return
  emit('update:modelValue', domainId)
}

// roving tabindex：组内只有 focusedId 对应的卡片 tabindex=0。面板每次打开
// 重置到当前选中项，Tab 进组即落在选中域上。
const focusedId = shallowRef(props.modelValue)
const radioRefs = new Map<string, HTMLButtonElement>()

watch(open, (isOpen) => {
  if (isOpen) focusedId.value = props.modelValue
})

function setRadioRef(domainId: string, el: unknown) {
  if (el instanceof HTMLButtonElement) radioRefs.set(domainId, el)
  else radioRefs.delete(domainId)
}

function moveFocus(delta: number) {
  const ids = props.domains.map(domain => domain.id)
  const from = ids.indexOf(focusedId.value)
  const to = (from + delta + ids.length) % ids.length
  focusToIndex(ids, to)
}

function focusToIndex(ids: string[], index: number) {
  const id = ids[index]
  if (!id) return
  focusedId.value = id
  radioRefs.get(id)?.focus()
}

function onGroupKeydown(event: KeyboardEvent) {
  const ids = props.domains.map(domain => domain.id)
  switch (event.key) {
    case 'ArrowDown':
    case 'ArrowRight':
      event.preventDefault()
      moveFocus(1)
      break
    case 'ArrowUp':
    case 'ArrowLeft':
      event.preventDefault()
      moveFocus(-1)
      break
    case 'Home':
      event.preventDefault()
      focusToIndex(ids, 0)
      break
    case 'End':
      event.preventDefault()
      focusToIndex(ids, ids.length - 1)
      break
  }
}
</script>

<template>
  <UPopover v-model:open="open" :content="{ align: 'start', sideOffset: 8 }">
    <UButton
      variant="ghost"
      color="neutral"
      size="sm"
      trailing-icon="i-lucide-chevrons-up-down"
      :aria-label="props.ariaLabel ?? `切换文档域，当前：${activeDomain?.label ?? ''}`"
      class="min-w-0"
    >
      <span class="flex min-w-0 items-center gap-2">
        <span class="flex size-5 shrink-0 items-center justify-center rounded border border-default bg-elevated">
          <UIcon v-if="activeDomain" :name="activeDomain.icon" class="size-3 text-muted" />
        </span>
        <span class="truncate text-highlighted">{{ activeDomain?.label }}</span>
      </span>
    </UButton>

    <template #content>
      <div
        class="w-[460px] max-w-[calc(100vw-2rem)] p-2"
        role="radiogroup"
        aria-label="文档域"
        @keydown="onGroupKeydown"
      >
        <p class="px-2 pb-2 pt-1 text-xs font-medium text-dimmed">切换文档域</p>
        <div class="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
          <button
            v-for="domain in props.domains"
            :key="domain.id"
            :ref="el => setRadioRef(domain.id, el)"
            type="button"
            role="radio"
            :aria-checked="domain.id === props.modelValue"
            :tabindex="domain.id === focusedId ? 0 : -1"
            @focus="focusedId = domain.id"
            class="group flex items-start gap-3 rounded-md border p-3 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            :class="domain.id === props.modelValue
              ? 'border-primary/25 bg-primary/5'
              : 'border-transparent hover:border-default hover:bg-elevated/60'"
            @click="selectDomain(domain.id)"
          >
            <span
              class="flex size-8 shrink-0 items-center justify-center rounded-md border transition-colors"
              :class="domain.id === props.modelValue
                ? 'border-primary/25 bg-primary/10 text-primary'
                : 'border-default bg-elevated text-muted group-hover:text-toned'"
            >
              <UIcon :name="domain.icon" class="size-4" />
            </span>
            <span class="flex min-w-0 flex-col gap-0.5">
              <span class="flex items-center gap-1.5 text-sm/5 font-medium text-highlighted">
                {{ domain.label }}
                <UIcon
                  v-if="domain.id === props.modelValue"
                  name="i-lucide-check"
                  class="size-3.5 shrink-0 text-primary"
                  aria-hidden="true"
                />
              </span>
              <span class="text-xs leading-relaxed text-muted">{{ domain.description }}</span>
            </span>
          </button>
        </div>
      </div>
    </template>
  </UPopover>
</template>
