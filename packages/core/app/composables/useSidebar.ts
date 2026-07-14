/**
 * Cookie-persisted collapse state for the sidebar AppShell.
 *
 * Mirrors the `useSplitPane` persistence model: an SSR-safe `useCookie` seeds a
 * shared `useState`, and the cookie follows subsequent changes (no
 * localStorage), so the collapsed/expanded choice survives reloads and renders
 * correctly on the server with no hydration flash.
 *
 * A single shared key means every consumer of the shell reads and writes the
 * same collapse state.
 */
const SIDEBAR_KEY = 'geist-sidebar-collapsed'

export function useSidebar() {
  const cookie = useCookie<boolean | undefined>(SIDEBAR_KEY)
  // useState is the single source of truth; the cookie only seeds the first init.
  const collapsed = useState<boolean>(SIDEBAR_KEY, () =>
    typeof cookie.value === 'boolean' ? cookie.value : false,
  )

  watch(collapsed, (v) => {
    cookie.value = v
  })

  function toggle() {
    collapsed.value = !collapsed.value
  }

  return { collapsed, toggle }
}
