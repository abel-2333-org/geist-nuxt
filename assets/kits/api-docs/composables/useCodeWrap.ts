/**
 * Shared, persisted line-wrap state for API code blocks.
 *
 * Every ApiCodeSample on a page shares ONE value (same `useState` key), so
 * toggling wrap on any block flips them all together. The choice is remembered
 * across visits via a cookie (SSR-safe — no localStorage). `defaultWrap` only
 * seeds the very first initialization; later callers inherit the shared value.
 */
export function useCodeWrap(defaultWrap = false) {
  // Read-only cookie access with NO per-caller default: passing different
  // defaults (e.g. one block wants `true`, another `false`) for the same cookie
  // name makes Nuxt warn about an override. `useState` is the single source of
  // truth and owns the seed — falling back to `defaultWrap` only when the
  // cookie is absent (very first visit).
  const cookie = useCookie<boolean | undefined>('geist-api-code-wrap')
  const wrap = useState<boolean>('geist-api-code-wrap', () =>
    typeof cookie.value === 'boolean' ? cookie.value : defaultWrap,
  )
  watch(wrap, (v) => {
    cookie.value = v
  })
  return wrap
}
