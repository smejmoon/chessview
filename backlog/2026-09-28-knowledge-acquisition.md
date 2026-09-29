# Do:

Change the current Explorer/discovery implementation so it satisfies `docs/components/knowledge-acquisition.md` §Requirements: fetching, deriving, hydrating, reconciling, and persisting graph/evidence information remain independent of what the current Constellation shows. Explorer facet freshness, stale fallback, and source-snapshot reconciliation now remain inside `loadExplorer()` before structural outgoing reads; finish removing visible-board budgets and Constellation membership from acquisition stopping rules except where a caller explicitly limits the information it requests.

# Because:

`docs/components/knowledge-acquisition.md` §Purpose / §Requirements separates durable knowledge acquisition from `docs/components/constellation.md` §Requirements. The product contract in `docs/product.md` §Product usability bar requires that Chessview may acquire and retain a larger graph region than the current Constellation and that visible-space limits do not become acquisition limits. A fresh cached Explorer snapshot now repairs persisted outgoing edges before composition relies on them; an expired snapshot is refreshed when possible and remains usable/reconciled when refresh fails; without cached Explorer evidence, acquisition failure remains a failure instead of becoming ordinary absence.

# Edges:

All Lichess traffic remains subject to `docs/components/lichess-access.md` §Network boundary, `docs/architecture/lichess-gateway.md` §Boundary / §Dependency direction, and `rules/lichess-gateway.md`. Played-Move materialization remains owned by `docs/components/position-graph.md` §Requirements rather than this outcome. `docs/components/constellation.md` §Requirements may request one position or a larger graph region; this entry owns fulfilling that need, not deciding which acquired positions become visible.

# Unsettled:

Choose the concrete interaction between Constellation and Knowledge acquisition only as needed by implementation. Viable shapes include an explicit request/result loop or an abstract provider; the durable docs intentionally do not require one.

Decide how view-scoped cancellation interacts with reusable/shared acquisition work so an obsolete view can stop waiting without accidentally making that view the owner of reusable graph enrichment. Preserve the lifetime separation in `docs/architecture/current-view.md` §Reusable producer lifetime and `docs/architecture/position-repository.md` §Facet hydration.

Decide which existing `explorer.js`, repository, enrichment, and controller responsibilities should be renamed or split so the implementation makes the durable ownership boundary testable without introducing unnecessary framework machinery.

# Complete:

Deterministic tests demonstrate the behavior required by `docs/components/knowledge-acquisition.md` §Verification: acquisition can reconcile cached/fresh Explorer knowledge, preserve manual/derived provenance, persist information beyond the current Constellation, and fulfill a request larger than the visible result without a presentation budget truncating durable acquisition. No application-issued Lichess request bypasses `docs/components/lichess-access.md` §Network boundary or `docs/architecture/lichess-gateway.md` §Boundary.

# Sync:

After any implementation or verification step that changes what remains, and before ending an implementation pass, rewrite this entry around the factual work and verification still open; do not accumulate progress history. If an outcome's completion condition is satisfied, run Backlog Close for that outcome. If Close cannot pass its normal gates, leave the entry open with the blocking condition explicit.
