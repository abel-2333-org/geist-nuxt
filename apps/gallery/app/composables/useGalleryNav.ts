import type { NavigationMenuItem } from '@nuxt/ui'

// Augment Nuxt's PageMeta so `definePageMeta({ nav })` is type-safe.
declare module '#app' {
  interface PageMeta {
    nav?: false | { label?: string; icon?: string; order?: number }
  }
}

type NavMeta = { label?: string; icon?: string; order?: number }

// "Kits" group sits after top-level pages. Kept well clear of page orders (default 99).
const KITS_GROUP_ORDER = 1000

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

interface Sortable {
  label: string
  icon?: string
  to: string
  order: number
}

/**
 * Derive the gallery navigation from the Nuxt route tree.
 * Adding a `pages/**` file = one more nav item automatically.
 * Hide a page with `definePageMeta({ nav: false })`.
 *
 * Structure: top-level pages ("/", "/components", ...) render inline; every
 * `kits/<name>/**` page folds into a single "Kits" dropdown. Nuxt UI's
 * horizontal navigation menu only renders two levels (trigger → one flat
 * child list), so kits are NOT nested as per-kit sub-trees. Instead each kit
 * page is a direct child of "Kits"; a multi-page kit carries its kit name as
 * every entry's `description`, which lands in Nuxt UI's native mega-menu
 * description slot and keeps the pages visually grouped.
 */
export function useGalleryNav() {
  const router = useRouter()

  return computed<NavigationMenuItem[]>(() => {
    const topLevel: Sortable[] = []
    const kitPages = new Map<string, Sortable[]>()

    for (const route of router.getRoutes()) {
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

    if (kitPages.size > 0) {
      // "Kits" section heading, then one entry per kit (sorted by name).
      items.push({ label: 'Kits', type: 'label', order: KITS_GROUP_ORDER })

      const kitItems = [...kitPages.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([kitName, pages], i) => {
          const sorted = pages.sort(byOrderThenLabel)
          const kitTitle = titleCase(kitName)
          const order = KITS_GROUP_ORDER + 1 + i
          // Single-page kit: a plain link. Multi-page kit: a collapsible
          // accordion (its pages as children), open by default so the current
          // section is visible without an extra click.
          if (sorted.length === 1) {
            return { label: kitTitle, icon: sorted[0]!.icon, to: sorted[0]!.to, order }
          }
          return {
            label: kitTitle,
            icon: sorted[0]?.icon,
            defaultOpen: true,
            children: sorted.map(({ order: _order, ...page }) => page),
            order,
          }
        })

      items.push(...kitItems)
    }

    return items.map(({ order: _order, ...item }) => item)
  })
}
