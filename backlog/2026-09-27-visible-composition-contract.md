# Do:

Replace the visible graph's hybrid array/object compatibility shape with an explicit source-owned visible-composition contract, then move direct consumers to that contract so `src/nodus-structure.js` no longer has to normalize both an array and an object-shaped composition.

# Because:

`src/visible-graph.js` currently returns the `nodes` array after attaching `center`, `direction`, `nodes` (self-reference), `relationships`, `families`, lookup maps, and `relationshipsFor` to that same array. This keeps older iterable consumers working, but it means one runtime value simultaneously represents a node list and the whole visible composition.

`src/nodus-structure.js` exposes the ambiguity directly in `normalizeComposition`: it reads nodes through `value?.nodes ?? value ?? []` while separately reading `value?.relationships` and `value?.families`. That dual acceptance makes the real domain boundary harder to state and is a likely source of the next useful static-type mismatch now that the `composeNodusStructure` call contract is source-owned.

# Edges:

Keep the visible composition transient and limited to view composition. Do not turn it into persisted graph state, scheduling state, or a large orchestration object.

Preserve current selection semantics, deterministic ordering, merge/family metadata, board-count limits, and existing Roots/Lines behavior. This outcome is about the boundary representation and its direct consumers, not a repository-wide TypeScript conversion or a redesign of graph selection.

A compatibility adapter is acceptable temporarily if a direct consumer still genuinely needs an iterable node array, but the canonical result should have one unambiguous shape rather than an array carrying composition fields.

# Unsettled:

Settle the smallest canonical `VisibleComposition` shape and where it is owned. In particular, decide whether lookup maps and `relationshipsFor` belong on the returned value, remain private to the builder, or move behind separate query helpers.

Settle whether the source-owned contract is best expressed with checked JSDoc in the current JavaScript module or by migrating the owning module to TypeScript. Prefer whichever makes the boundary explicit without forcing unrelated migration.

Settle which legacy consumers, if any, still require raw array iteration and whether they should be migrated directly or served by a narrow compatibility view.

# Complete:

`createVisibleGraph(...).result()` has one explicit canonical composition shape; direct consumers use that shape without dual array/object interpretation; `normalizeComposition` no longer needs `value?.nodes ?? value`; and deterministic tests, TypeScript checking, and the production build pass without weakening compiler settings.

# Steps:

Inventory direct consumers of `createVisibleGraph(...).result()` and distinguish composition consumers from node-list-only consumers.

Define the source-owned visible-composition contract at the smallest owning boundary.

Refactor the result representation and direct consumers, retaining only narrowly justified compatibility code.

Remove the dual-shape normalization path once no direct consumer requires it.

Run deterministic tests, TypeScript checking, and the production build, then sync this entry around anything still open.

# Sync:

After any implementation or verification step that changes what remains, and before ending an implementation pass, rewrite this entry around the factual work and verification still open; do not accumulate progress history. If `Complete:` is satisfied, run Backlog Close. If Close cannot pass its normal gates, leave the entry open with the blocking condition explicit.
