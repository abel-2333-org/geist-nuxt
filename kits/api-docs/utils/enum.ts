// Enum display model (API docs kit). These types describe a field's allowed
// values and are the canonical contract shared by ApiDocsEnumTable (which
// renders them) and the FieldNode model in `field.ts` (which embeds them).
//
// They live in a util — not inside EnumTable.vue — so any slice can reference
// them through Nuxt's `#imports` surface in BOTH the source repo and a
// copied-in consumer, where the util lands in `app/utils/` while components
// land in `app/components/api-docs/`. A cross-directory relative import from a
// util to a component would not resolve identically across those two
// topologies; auto-imported utils do. EnumTable.vue re-exports these for
// backward compatibility with callers that still import from the component.

/** A single enum member.
 *  `value` is deliberately `string` (not `string | number`): the default-row
 *  marker relies on strict `===` against `defaultValue`, so widening this
 *  type would silently break that match. Callers stringify numerics. */
export interface EnumValue {
  value: string
  description: string
}

/** A named group of enum members — e.g. bank lists that apply under a condition. */
export interface EnumVariant {
  title?: string
  /** When this group of values applies (already localized, inline markdown).
   *  Rendered as a caption under the variant selector: the tab title names the
   *  group, this sentence says when you are in it. */
  when?: string
  values: EnumValue[]
}

/** Public props contract for ApiDocsEnumTable. Kept outside the SFC so its
 *  legacy type re-exports do not interfere with Vue's runtime-prop extraction. */
export interface EnumTableProps {
  /** Flat enum: a single list of allowed values. */
  values?: EnumValue[]
  /** Grouped enum: values that vary by condition. */
  variants?: EnumVariant[]
  defaultValue?: string
  label?: string
  defaultLabel?: string
  searchPlaceholder?: string
  emptyLabel?: string
  variantLabel?: (index: number) => string
  filterThreshold?: number
  /** Polite live-region text when a filter yields hits. Receives the count.
   *  Same signature as SidebarNav's — the kit's two filterable lists announce
   *  through one contract shape. */
  resultsAnnouncement?: (count: number) => string
  /** Polite live-region text for grouped enums. Receives the aggregate hit
   *  count, the active group's hit count, and its localized label. */
  variantResultsAnnouncement?: (totalCount: number, activeCount: number, activeLabel: string) => string
  /** Polite live-region text when a filter yields nothing. Receives the query. */
  noResultsAnnouncement?: (query: string) => string
}
