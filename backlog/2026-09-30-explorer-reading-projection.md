# Do:

Make successful reconciliation of one Explorer Reading idempotent across later recompositions while keeping incomplete or failed reconciliation retryable, and ensure an older Reading cannot overwrite mutable statistics already reconciled from a newer observation. Preserve a clean separation between source-cache freshness, source-observation identity/order, and the fact that a particular source observation has already been projected into durable graph state.

# Because:

`src/knowledge-acquisition.js::reconcileCachedExplorerReading()` currently replays the full Reading whenever cached Explorer data exists. `src/nodus-structure.js` deduplicates Explorer work only inside one `createCandidateSource()` instance, so a later recomposition creates a fresh local map and can project the same cached Reading again. That repeats durable edge/target mutation and reconciliation logging even when no source observation changed.

Constellation-directed supplementary lookahead now intentionally allows an Explorer Reading to be warmed and cached before any later graph-acquisition request reconciles it. That makes source-cache state and graph-projection state observably independent rather than merely an implementation detail, so projection completion cannot be inferred from freshness or cache presence.

The current graph mutation boundary also serializes each edge mutation without knowing which Explorer observation is newer. `PositionGraph.updateEdge()` therefore prevents a provenance/statistics lost-update race, but by itself cannot prevent an older Reading that finishes reconciliation later from replacing statistics already committed from a newer Reading. The projection protocol needs enough observation identity/order to make that outcome impossible rather than treating transaction order as source freshness.

# Edges:

Knowledge Acquisition owns whether and when a source observation has been successfully reconciled and the ordering semantics between distinct observations of the same source position. The Explorer client owns source data, fetch time, freshness, stale fallback, request lifecycle, and supplementary warming through its normal cache path. A source fetch timestamp must not silently become the Knowledge Acquisition projection-completion marker, though source-observation metadata may participate in whatever explicit snapshot identity/order the projection protocol chooses.

`ChartedGraph` owns the invariant that an earlier statistical observation must not replace a later committed one. `PositionGraph` owns invariant-preserving per-edge mutation and persistence, but it should not independently infer Explorer snapshot freshness or source-observation lifecycle. Knowledge Acquisition should supply whatever ordering/version information or serialized projection discipline is needed to satisfy the graph invariant.

`docs/components/knowledge-acquisition.md` §Supplementary lookahead owns Constellation-directed lookahead and deliberately keeps warming separate from reconciliation. This outcome owns only the later projection protocol once a cached Reading is actually reconciled; it does not own lookahead nomination, transport priority, or speculative lifetime.

This work may be implemented together with `backlog/2026-09-30-charted-graph-code-alignment.md` if the same mutation boundary changes, or after that graph work if separation stays cleaner. Neither outcome blocks the other.

# Unsettled:

Choose the smallest durable identity/version for distinguishing one Explorer Reading snapshot from another, ordering distinct observations of the same source position when necessary, and recording completed projection without putting downstream reconciliation state inside the data-only Reading itself.

Choose where projection completion and last-applied observation identity/order are persisted and how partial reconciliation is represented. Completion may be recorded only after every accepted update in the attempt has persisted; an interrupted or failed projection must remain safely retryable even when some earlier edge or target updates already landed.

Choose the smallest concurrency rule that prevents stale replacement. It may serialize projection per source observation, reject application of an observation older than the last successfully applied one, or use another equivalent mechanism, but transaction completion order alone must not define which Reading is newer.

# Complete:

Deterministic verification shows that after one cached Explorer Reading has reconciled successfully, later recompositions or later visits using that same Reading do not replay its graph/target mutations; a distinct later Reading is reconciled; and an interrupted or failed reconciliation of a Reading remains retryable until it completes.

A Reading warmed by supplementary lookahead can remain cached without being marked projected, and a later normal graph-acquisition request reconciles it exactly once without requiring another network request.

A concurrency regression also proves observation ordering: Reading A is captured, a newer Reading B reconciles successfully, then A completes afterward, and B's mutable statistics remain authoritative rather than being replaced by A. The same guarantee holds without losing manual/derived provenance or durable topology.

Source freshness, stale-cache behavior, and lookahead warming remain independently owned by the Explorer client/acquisition path; projection identity/order does not become a second cache-freshness policy.

# Sync:

After any implementation or verification step that changes what remains, and before ending an implementation pass, synchronize this entry. Also synchronize when an action completes or becomes unavailable, a blocking condition changes, or a judgment is settled. Rewrite around the factual work and verification still open; do not accumulate progress history. If an outcome's completion condition is satisfied, run Backlog Close for that outcome. If Close cannot pass its normal gates, leave the entry open with the blocking condition explicit.
