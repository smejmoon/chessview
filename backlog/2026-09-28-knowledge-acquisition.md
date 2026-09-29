# Do:

Finish the Knowledge acquisition behavior in `docs/components/knowledge-acquisition.md` §Requirements. Explorer reconciliation now grows durable topology monotonically and refreshes mutable statistics on returned known edges without deleting omitted or newly low-frequency relationships; finish removing visible-board budgets and Constellation membership from acquisition stopping rules except where a caller explicitly limits the information it requests.

# Because:

`docs/product.md` §Cross-product commitments and `docs/components/position-graph.md` §Requirements now define Chessview's durable graph as a monotonically discovered subset of the fixed legal chess graph: first admission can be selective, but later evidence refresh changes statistics rather than retracting established topology. `docs/components/knowledge-acquisition.md` §Requirements owns that admission/refresh distinction. Explorer facet freshness, stale fallback, and reconciliation remain inside `loadExplorer()` before structural outgoing reads; no-cache acquisition failure remains failure rather than ordinary absence.

# Edges:

All Lichess traffic remains subject to `docs/components/lichess-access.md` §Network boundary, `docs/architecture/lichess-gateway.md` §Boundary / §Dependency direction, and `rules/lichess-gateway.md`. Played-Move materialization remains owned by `docs/components/position-graph.md` §Requirements. Constellation selection remains a separate consumer: an automatic first-admission floor must not silently become a visibility threshold or exclude the rare candidates that `docs/components/constellation-selection.md` §Eligibility may rescue with engine or favorable human evidence.

# Unsettled:

Choose the automatic first-admission rule for newly observed Explorer relationships. The rule may use frequency/sample evidence and should bound topology growth, but it is permanent-admission policy rather than retention policy; do not reuse the Constellation rarity/visibility threshold in a way that makes rare-candidate rescue unreachable.

Choose the concrete interaction between Constellation and Knowledge acquisition only as needed by implementation. Viable shapes include an explicit request/result loop or an abstract provider; the durable docs intentionally do not require one.

Decide how view-scoped cancellation interacts with reusable/shared acquisition work so an obsolete view can stop waiting without accidentally making that view the owner of reusable graph enrichment. Preserve the lifetime separation in `docs/architecture/current-view.md` §Reusable producer lifetime and `docs/architecture/position-repository.md` §Facet hydration.

Decide which existing `explorer.js`, repository, enrichment, and controller responsibilities should be renamed or split so the implementation makes the durable ownership boundary testable without introducing unnecessary framework machinery.

# Complete:

Deterministic tests demonstrate `docs/components/knowledge-acquisition.md` §Verification: acquisition can add newly admitted topology, refresh statistics on known edges without deleting omitted or newly low-frequency topology, reconcile cached/stale Explorer evidence, preserve manual/derived provenance under concurrent refresh, persist information beyond the current Constellation, and fulfill a request larger than the visible result without a presentation budget truncating durable acquisition. No application-issued Lichess request bypasses `docs/components/lichess-access.md` §Network boundary or `docs/architecture/lichess-gateway.md` §Boundary.

# Sync:

After any implementation or verification step that changes what remains, and before ending an implementation pass, rewrite this entry around the factual work and verification still open; do not accumulate progress history. If an outcome's completion condition is satisfied, run Backlog Close for that outcome. If Close cannot pass its normal gates, leave the entry open with the blocking condition explicit.
