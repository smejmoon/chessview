# Do:

Obtain deterministic test, TypeScript-check, and production-build evidence for the exact current `koko` tip. If all verification passes, close this outcome.

# Blocked:

The exact current `koko` tip has no passing verification evidence yet. Chessview's CI workflow can run the required checks through `workflow_dispatch`, but the current connected ChatGPT GitHub surface cannot dispatch that workflow and no authorized repository executor is connected; this clears when CI is manually dispatched for the exact tip or equivalent execution evidence is supplied.

# Because:

`src/visible-graph.js` owns visible Roots/Lines selection together with its private mutable builder and publishes one plain `{ nodes, relationships, families }` value. Builder lookup maps and `relationshipsFor`, plus Nodus context such as center and direction, are not part of the returned composition.

`src/graph.js` now retains durable chess/graph utilities rather than visible-neighborhood selection, and `src/nodus-structure.js` consumes the source-owned composition directly without `normalizeComposition` or dual array/object interpretation.

Direct consumers and tests use `composition.nodes`; map rendering receives Roots/Lines direction explicitly from the Nodus view context instead of recovering it from the composition. Renderer loading/empty fallback values use the same canonical three-field composition shape.

# Edges:

Keep the visible composition transient and limited to view composition. Do not turn it into persisted graph state, scheduling state, or a large orchestration object.

Preserve current selection semantics, deterministic ordering, merge state, board-count limits, `lineShare`/`rootEdgeId` family metadata, and existing Roots/Lines behavior. Family `direction` is intentionally retired because Roots/Lines direction belongs to the Nodus view context rather than each family record. Root-label generation and other wider Nodus-structure responsibilities remain outside this outcome.

No repository-wide TypeScript conversion or compatibility adapter is required by the implemented boundary.

# Complete:

Visible composition has one source-owned canonical `{ nodes, relationships, families }` shape across produced and renderer fallback values; visible selection and its private builder share that owner; direct consumers use the canonical shape without dual array/object interpretation; and deterministic tests, TypeScript checking, and the production build pass without weakening compiler settings.

# Steps:

Dispatch Chessview's `CI` workflow for the exact current `koko` tip, or obtain equivalent execution evidence that runs `npm test`, `npm run typecheck`, and `npm run build` against that exact tip.

If all three checks pass, run Backlog Close for this outcome; otherwise rewrite this entry around the concrete remaining failure.

# Sync:

After any implementation or verification step that changes what remains, and before ending an implementation pass, rewrite this entry around the factual work and verification still open; do not accumulate progress history. If `Complete:` is satisfied, run Backlog Close. If Close cannot pass its normal gates, leave the entry open with the blocking condition explicit.
