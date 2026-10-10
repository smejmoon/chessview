# Do:

Implement [Position cache](../docs/architecture/position-cache.md) through `PositionRepository`: serve compatible cached observations immediately regardless of age, start due refresh in the background, coordinate shared demand, and preserve usable state on source or storage failure. Simplify `src/explorer.ts`, `src/masters.ts`, and `src/lichess-eval.ts` by moving duplicated generic cache lookup, TTL, live-admission, persistence, and fallback mechanics into the repository.

After the repository takes over that ordinary lifecycle, **remove the displaced provider code**, not just add a repository layer alongside it. Specific reduction candidates supported by the current implementations:
- `src/explorer.ts`: provider-local cache-hit/TTL and fallback branches in `ensure`, and generic live-admission, persistence-tracking, and fallback helpers (`admit`, `markPersisted`, `recoverRefresh`, `persist`) where their work has moved to `PositionRepository`.
- `src/masters.ts`: corresponding cache-hit/TTL and stale-fallback decisions in `load` and generic helpers (`admit`, `markPersisted`, `staleOrAbsent`, `persistMastersReading`).
- `src/lichess-eval.ts`: repeated TTL/cached-selection, fallback, and persistence flow in `get`, plus generic helpers (`admit`, `markPersisted`, `persist`) after their responsibilities have moved.

Treat these as removal candidates, not guaranteed whole-function deletions: preserve any remaining source-specific validation, source operational reporting, passive observation APIs, and actual behavior. Prefer deleting needless wrappers to keeping duplicate control flow under new names. Do not create another cache abstraction merely to move the duplication.

Source clients continue supplying endpoint requests, meaningful cache identity, payload validation, source-quality constraints, and absence interpretation. Give unexpected cache failures actionable debug diagnostics, not speculative repair or retry machinery.

# Because:

[Data stability](../docs/components/data-stability.md) makes time-to-refresh a consequence of source stability; valid positive observations have no maximum age. The existing providers each repeat cache decisions under `PositionRepository.load()`, which currently only shares in-flight producers.

# Edges:

Preserve startup authorization, explicit reconnect, accepted Constellation/Rail, Root representative-game requirements, Masters versus rated source identity, cloud-eval minimum depth and 404 semantics, source operational status, and cancellation. Do not add polling or a new Lichess scheduler. Coordinate shared work-demand changes with [work-context implementation](2026-10-07-work-context-implementation.md) without absorbing its transport/API migration.

Concrete TTL numbers remain in `src/config.ts` and should change only with a source-stability rationale. Preserve real cache maintenance/debug entry points such as `src/explorer-cache.ts` while they have callers, rather than equating a small adapter with unnecessary code. The independently tracked [test consolidation](2026-10-10-position-cache-test-consolidation.md) removes obsolete provider-cache tests once the replacement is verified.

# Complete:

An active view receives valid compatible cached data without waiting for due refresh. One shared refresh can improve later evidence while failure leaves known Graph Edges and usable observations intact. Incompatible cached data cannot stand in for a different question. PositionRepository owns generic cache behavior; redundant provider-side TTL, cache-selection, live-admission, persistence, and stale-fallback branches/helpers have been removed or retained only with an identified independent source responsibility. The migration yields a net reduction in duplicated control flow rather than layering another framework on top. Tests, typecheck and build pass without losing request/cancellation invariants.

# Sync:

Use backlog-tend for routine synchronization.
