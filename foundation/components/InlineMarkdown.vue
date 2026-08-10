<script lang="ts">
import { defineComponent, h, resolveComponent, type VNodeChild } from 'vue'
import InlineCode from './InlineCode.vue'
import { parse, type Node } from './inline-markdown/parse'

/**
 * Inline rich-text renderer for authored copy (descriptions, conditions, notes).
 * A small, synchronous renderer for an inline markdown subset:
 *
 *   `code`   → InlineCode (→ Nuxt UI ProseCode, tonal surface)
 *   [x](url) → ProseA (→ ULink: internal hrefs get client-side routing,
 *              external hrefs render <a> with rel auto-managed)
 *   **bold** / __bold__ → ProseStrong
 *   *em* / _em_ → ProseEm
 *   ***both*** / ___both___ → combined ProseStrong + ProseEm
 *   ~~del~~  → native <del> (Nuxt UI ships no Prose component for strikethrough)
 *
 * Marked handles CommonMark delimiter semantics; a narrow adapter accepts only
 * the nodes above, preserves unsupported syntax as text, and maps the result
 * onto design-system components. Intraword `*em*` is also kept literal because
 * API copy commonly contains multiplication and identifiers such as `2*3*4`.
 * Raw HTML is never rendered.
 *
 * Backslash escapes are preserved verbatim. Authored API copy routinely carries
 * regex and glob text (`^\d{3}\*$`, `C:\*.txt`), so the adapter emits an escape
 * token's raw source instead of silently swallowing its backslash.
 *
 * Why not <MDC>: this is inline copy only, and synchronous token-to-VNode
 * rendering is lighter and SSR-stable. If block markdown becomes a requirement,
 * use a block renderer rather than widening this component.
 */
export default defineComponent({
  name: 'InlineMarkdown',
  props: {
    text: { type: String, required: true },
  },
  setup(props) {
    const ProseStrong = resolveComponent('ProseStrong')
    const ProseEm = resolveComponent('ProseEm')
    const ProseA = resolveComponent('ProseA')

    function render(nodes: Node[]): VNodeChild[] {
      return nodes.map((node) => {
        if (node.type === 'text') return node.value
        if (node.type === 'code') return h(InlineCode, { translate: 'no' }, () => node.value)
        if (node.type === 'strong') return h(ProseStrong, () => render(node.children))
        if (node.type === 'em') return h(ProseEm, () => render(node.children))
        if (node.type === 'del') return h('del', render(node.children))
        return h(
          ProseA,
          { href: node.href, target: node.external ? '_blank' : undefined },
          () => render(node.children),
        )
      })
    }

    return () => h('span', { class: 'inline-markdown' }, render(parse(props.text)))
  },
})
</script>
