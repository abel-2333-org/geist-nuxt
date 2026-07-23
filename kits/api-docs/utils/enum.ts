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
  /** When this group of values applies (already localized). */
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
}
