import type { NavigationMenuItem } from '@nuxt/ui'

// Augment Nuxt's PageMeta so `definePageMeta({ nav })` is type-safe.
declare module '#app' {
  interface PageMeta {
    nav?: false | { label?: string; icon?: string; order?: number }
  }
}

type NavMeta = { label?: string; icon?: string; order?: number }

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

interface NavLink {
  label: string
  icon?: string
  to: string
  order: number
}

/**
 * Derive the gallery sidebar navigation from the Nuxt route tree.
 * Adding a `pages/**` file = one more nav entry automatically;
 * hide a page with `definePageMeta({ nav: false })`.
 *
 * Returns a single vertical tree: top-level destinations first, then a "Kits"
 * section heading, then one entry per kit — single-page kits collapse to a
 * link, multi-page kits become an accordion (their pages as children, open by
 * default). This feeds the vertical UNavigationMenu in both the desktop
 * sidebar and the mobile slideover, so nesting depth is unlimited.
 */
export function useGalleryNav() {
  const router = useRouter()

  return computed<NavigationMenuItem[]>(() => {
    const topLevel: NavLink[] = []
    const kitPages = new Map<string, NavLink[]>()

    for (const route of router.getRoutes()) {
      if (route.path.includes(':')) continue
      const meta = route.meta?.nav as false | NavMeta | undefined
      if (meta === false) continue

      const segs = route.path.replace(/^\/|\/$/g, '').split('/').filter(Boolean)
      const icon = meta?.icon
      const order = meta?.order ?? 99

      if (segs[0] === 'kits' && segs.length >= 2) {
        const kitName = segs[1]!
        const label = meta?.label ?? (segs.length === 2 ? 'Overview' : titleCase(segs[segs.length - 1]!))
        const pages = kitPages.get(kitName) ?? []
        pages.push({ label, icon, to: route.path, order })
        kitPages.set(kitName, pages)
        continue
      }

      if (segs.length <= 1) {
        const label = meta?.label ?? (segs.length === 0 ? 'Overview' : titleCase(segs[0]!))
        topLevel.push({ label, icon, to: route.path, order })
      }
    }

    const tree: NavigationMenuItem[] = topLevel
      .sort(byOrderThenLabel)
      .map(({ order: _o, ...link }) => link)

    const kits = [...kitPages.entries()].sort(([a], [b]) => a.localeCompare(b))
    if (kits.length > 0) {
      tree.push({ label: 'Kits', type: 'label' })
      for (const [kitName, pages] of kits) {
        const sorted = pages.sort(byOrderThenLabel)
        const label = titleCase(kitName)
        tree.push(
          sorted.length === 1
            ? { label, icon: sorted[0]!.icon, to: sorted[0]!.to }
            : {
                label,
                icon: sorted[0]?.icon,
                defaultOpen: true,
                children: sorted.map(({ order: _o, ...page }) => page),
              },
        )
      }
    }

    return tree
  })
}
