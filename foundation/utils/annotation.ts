// Shared type surface of the Annotation family (foundation).
//
// The shell (AnnotationPopover) and every form (TermAnnotation, DocAnnotation,
// and the kit's ApiDocsFieldAnnotation) extend these chrome labels. It lives in
// a util — not inside the shell SFC — so all slices reference it BARE (no
// import), exactly like the api-docs FieldNode model. This is what makes the
// type reachable across the foundation ↔ kit topology boundary: a relative
// specifier to the shell SFC would differ between the source repo
// (`kits/api-docs/components` → `foundation/components`) and after copy-in
// (everything flattens to `app/components/…`), whereas Nuxt auto-imports both
// `foundation/utils` (source) and `app/utils` (target) identically.
export interface AnnotationPopoverLabels {
  /** sr-only announcement while `loading`. */
  loading?: string
  /** Retry button caption in the error state. */
  retry?: string
}
