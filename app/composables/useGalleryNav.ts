import type { NavigationMenuItem } from '@nuxt/ui'
import type { RouteRecordNormalized } from 'vue-router'

// Augment Nuxt's PageMeta so `definePageMeta({ nav })` is type-safe.
declare module '#app' {
  interface PageMeta {
    nav?: false | { label?: string; icon?: string; order?: number }
  }
}

type NavMeta = { label?: string; icon?: string; order?: number }

// Kit entries sit after top-level pages. Kept well clear of page orders (default 99).
const KIT_ORDER = 1000

// kebab / path segment → Title Case fallback (e.g. "api-docs" → "Api Docs").
function titleCase(seg: string): string {
  return seg
    .split('-')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

// order asc, then label asc — getRoutes() order is not guaranteed, so always tie-break.
function byOrderThenLabel(a: { order: number; label: string }, b: { order: number; label: string }) {
  return a.order - b.order || a.label.localeCompare(b.label)
}

function isWithin(path: string, base: string): boolean {
  return path === base || path.startsWith(`${base}/`)
}

interface Sortable {
  label: string
  icon?: string
  to: string
  order: number
}

function findActiveTo(pages: Sortable[], path: string): string | undefined {
  let match: string | undefined

  for (const page of pages) {
    if (isWithin(path, page.to) && (!match || page.to.length > match.length)) {
      match = page.to
    }
  }

  return match
}

/**
 * Derive the gallery navigation from the Nuxt route tree.
 * Adding a `pages/**` file = one more nav item automatically.
 * Hide a page with `definePageMeta({ nav: false })`.
 *
 * Structure: top-level pages ("/", "/components", ...) render inline; every
 * `kits/<name>/**` page folds into one top-level entry per kit
 * (single-page kit → a link; multi-page kit → a dropdown / accordion).
 * Kept to two levels max: horizontal UNavigationMenu only renders one
 * dropdown layer, so deeper nesting would be invisible in the header.
 */
export function buildGalleryNav(
  routes: readonly Pick<RouteRecordNormalized, 'path' | 'meta'>[],
  currentPath: string,
): NavigationMenuItem[] {
  const topLevel: Sortable[] = []
  const kitPages = new Map<string, Sortable[]>()

  for (const route of routes) {
    // Skip dynamic routes and explicitly hidden pages.
    if (route.path.includes(':')) continue
    const meta = route.meta?.nav as false | NavMeta | undefined
    if (meta === false) continue

    const segs = route.path.replace(/^\/|\/$/g, '').split('/').filter(Boolean)
    const icon = meta?.icon
    const order = meta?.order ?? 99

    if (segs[0] === 'kits' && segs.length >= 2) {
      // Page inside a kit sub-tree. Kit root (`/kits/<name>`) defaults to "Overview".
      const kitName = segs[1]!
      const label = meta?.label ?? (segs.length === 2 ? 'Overview' : titleCase(segs[segs.length - 1]!))
      const pages = kitPages.get(kitName) ?? []
      pages.push({ label, icon, to: route.path, order })
      kitPages.set(kitName, pages)
      continue
    }

    // Top-level pages: "/", "/components", "/compositions".
    if (segs.length <= 1) {
      const label = meta?.label ?? (segs.length === 0 ? 'Overview' : titleCase(segs[0]!))
      topLevel.push({ label, icon, to: route.path, order })
    }
  }

  // Sortable is structurally a NavigationMenuItem plus `order`.
  const items: (NavigationMenuItem & { order: number })[] = topLevel.sort(byOrderThenLabel)

  // One top-level entry per kit, kits sorted by name for stability.
  for (const [index, [kitName, pages]] of [...kitPages.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .entries()) {
    const sorted = pages.sort(byOrderThenLabel)
    const label = titleCase(kitName)
    const icon = sorted[0]?.icon ?? 'i-lucide-package'
    const active = isWithin(currentPath, `/kits/${kitName}`)
    // Single-page kit collapses to a plain link; multi-page kit becomes a dropdown.
    if (sorted.length === 1) {
      items.push({ label, icon, to: sorted[0]!.to, active, order: KIT_ORDER + index })
    } else {
      const activeTo = findActiveTo(sorted, currentPath)
      items.push({
        label,
        icon,
        active,
        defaultOpen: active,
        children: sorted.map(({ order: _order, ...page }) => ({ ...page, active: page.to === activeTo })),
        order: KIT_ORDER + index,
      })
    }
  }

  return items.map(({ order: _order, ...item }) => item)
}

export function useGalleryNav() {
  const router = useRouter()
  const route = useRoute()

  return computed<NavigationMenuItem[]>(() => buildGalleryNav(router.getRoutes(), route.path))
}
