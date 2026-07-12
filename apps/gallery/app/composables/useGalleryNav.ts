import type { NavigationMenuItem } from '@nuxt/ui'

// Augment Nuxt's PageMeta so `definePageMeta({ nav })` is type-safe.
declare module '#app' {
  interface PageMeta {
    nav?: false | { label?: string; icon?: string; order?: number }
  }
}
export {}

interface NavRecord {
  path: string
  label: string
  icon?: string
  order: number
}

// kebab / path segment → Title Case fallback (e.g. "api-docs" → "Api Docs").
function titleCase(seg: string): string {
  return seg
    .split('-')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

/**
 * Derive the gallery navigation from the Nuxt route tree.
 * Adding a `pages/**` file = one more nav item automatically.
 * Hide a page with `definePageMeta({ nav: false })`.
 */
export function useGalleryNav() {
  const router = useRouter()

  return computed<NavigationMenuItem[]>(() => {
    const records: NavRecord[] = []
    const kitChildren: NavigationMenuItem[] = []

    for (const route of router.getRoutes()) {
      // Skip dynamic routes and explicitly hidden pages.
      if (route.path.includes(':')) continue
      if ((route.meta?.nav as false | undefined) === false) continue

      const nav = route.meta?.nav as { label?: string; icon?: string; order?: number } | undefined
      const segs = route.path.replace(/^\/|\/$/g, '').split('/').filter(Boolean)

      const label = nav?.label ?? (segs.length === 0 ? 'Overview' : titleCase(segs[segs.length - 1]!))
      const icon = nav?.icon
      const order = nav?.order ?? 99

      if (segs[0] === 'kits') {
        // Aggregate every kit page under a single collapsible "Kits" parent.
        kitChildren.push({ label, icon, to: route.path })
        continue
      }

      // Top-level pages: "/", "/components", "/compositions".
      if (segs.length <= 1) {
        records.push({ path: route.path, label, icon, order })
      }
    }

    const items: (NavigationMenuItem & { order: number })[] = records.map((r) => ({
      label: r.label,
      icon: r.icon,
      to: r.path,
      order: r.order,
    }))

    if (kitChildren.length > 0) {
      items.push({
        label: 'Kits',
        icon: 'i-lucide-package',
        children: kitChildren,
        order: 3,
      })
    }

    return items
      .sort((a, b) => a.order - b.order)
      .map(({ order: _order, ...item }) => item)
  })
}
