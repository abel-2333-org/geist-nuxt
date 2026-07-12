<script lang="ts">
import { defineComponent, h, resolveComponent, type VNode } from 'vue'
import InlineCode from './InlineCode.vue'

/**
 * Inline rich-text renderer for authored copy (descriptions, conditions, notes).
 * A small, synchronous, zero-dependency tokenizer for the INLINE subset of
 * markdown:
 *
 *   `code`   → InlineCode (→ Nuxt UI ProseCode, tonal surface)
 *   [x](url) → ProseA (→ ULink: internal hrefs get client-side routing,
 *              external hrefs render <a> with rel auto-managed)
 *   **bold** → ProseStrong
 *   *em* / _em_ → ProseEm
 *   ~~del~~  → native <del> (Nuxt UI ships no Prose component for strikethrough)
 *
 * Everything maps onto the design system's Prose components rather than raw
 * HTML. Parsing is recursive, so markers nest (e.g. **bold with `code`**).
 * `code` spans are raw — their contents are never re-parsed.
 *
 * Why not <MDC> / a full markdown engine: this is for inline copy only (no block
 * quotes, lists, or headings), and <MDC> is async (useAsyncData per instance)
 * and causes SSR→client hydration mismatches when rendered many times on one
 * page. A synchronous tokenizer is both lighter and SSR-stable. If block-level
 * markdown ever becomes a real requirement, revisit MDC instead of extending this.
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

    const isExternal = (href: string) => /^(https?:)?\/\//.test(href)

    // Each rule: a matcher and a builder. Order matters — at any position the
    // earliest match wins, and ties resolve by array order, so `**` (bold) is
    // listed before the single-`*` (em) rule to claim `**…**` first.
    type Rule = { re: RegExp, build: (m: RegExpExecArray) => VNode }
    const rules: Rule[] = [
      // Raw: inner text is NOT re-parsed.
      { re: /`([^`]+)`/, build: (m) => h(InlineCode, () => m[1] ?? '') },
      // Link: label IS parsed; url is a bare attribute.
      {
        re: /\[([^\]]+)\]\(([^)]+)\)/,
        build: (m) => {
          const href = m[2] ?? ''
          return h(
            ProseA,
            { href, target: isExternal(href) ? '_blank' : undefined },
            () => tokenize(m[1] ?? ''),
          )
        },
      },
      { re: /\*\*([\s\S]+?)\*\*/, build: (m) => h(ProseStrong, () => tokenize(m[1] ?? '')) },
      { re: /~~([\s\S]+?)~~/, build: (m) => h('del', tokenize(m[1] ?? '')) },
      // Em with `*`: require non-space at the inner edges so a stray/lone `*`
      // (e.g. `func(a, b) with * star`, maths) doesn't open an italic run.
      { re: /\*(\S(?:[\s\S]*?\S)?)\*/, build: (m) => h(ProseEm, () => tokenize(m[1] ?? '')) },
      // Em with `_`: additionally require word boundaries on the OUTSIDE so
      // intra-word underscores (`snake_case_name`, identifiers, URLs) are left
      // alone — only `_word_` flanked by non-alphanumerics italicises. The
      // lookbehind/lookahead are zero-width, so slicing by m.index still works.
      {
        re: /(?<![A-Za-z0-9])_(\S(?:[\s\S]*?\S)?)_(?![A-Za-z0-9])/,
        build: (m) => h(ProseEm, () => tokenize(m[1] ?? '')),
      },
    ]

    function tokenize(input: string): Array<VNode | string> {
      if (!input) return []
      let best: { rule: Rule, m: RegExpExecArray } | null = null
      for (const rule of rules) {
        const m = rule.re.exec(input)
        if (m && (best === null || m.index < best.m.index)) best = { rule, m }
      }
      if (!best) return [input]
      const { rule, m } = best
      const out: Array<VNode | string> = []
      if (m.index > 0) out.push(input.slice(0, m.index))
      out.push(rule.build(m))
      out.push(...tokenize(input.slice(m.index + m[0].length)))
      return out
    }

    return () => h('span', { class: 'inline-markdown' }, tokenize(props.text))
  },
})
</script>
