# Do:

Continue the `ChartedGraph` requirements review and align implementation only where the settled domain model exposes a real code mismatch. Keep `ChartedGraph` as the durable domain model and `PositionGraph` as the distinct application/architecture boundary for validated edge access and mutation unless later requirements invalidate that separation.

As the review surfaces additional code/document mismatches in Nodes, Edges, Growth and retention, or their technical realization, fold them into this outcome rather than creating competing graph-alignment work.

# Because:

`docs/components/charted-graph.md` owns durable graph semantics, while `docs/architecture/position-graph.md` owns the edge API, normalization, mutation coordination, and persistence mechanics. `PositionGraph.updateEdge()` is constrained to mutable evidence updates and preservation of already-established retention provenance; `ensureEdge()` is the operation that may establish `manual` or `derived` provenance. That keeps graph-retention reasons distinct from statistical refresh while preserving the existing `ChartedGraph` / `PositionGraph` separation.

The persistence boundary now follows that separation more directly: `PositionGraph` consumes `src/edge-store.js`, `PositionRepository` consumes `src/position-store.js`, and shared IndexedDB setup/transaction mechanics live in `src/indexed-db.js`. `src/db.js` remains only a compatibility and test/maintenance surface rather than the application-level mixed node/edge API.

Atomic edge-store mutation preserves per-edge read/modify/write coordination and retention-provenance merging. It does not establish source-observation freshness. Explorer Reading identity/order and prevention of an older Reading overwriting a newer projected observation are owned by `backlog/2026-09-30-explorer-reading-projection.md` rather than by `PositionGraph`.

The reviewed canonical-position identity, Move resolution, edge normalization, explicit Move materialization, transposition persistence, and Knowledge Acquisition callers currently follow the graph boundary. The remaining risk is that further requirements review may reveal another implementation behavior that does not match the settled `ChartedGraph` contract.

# Edges:

`docs/components/charted-graph.md` owns the durable graph requirements being reviewed.

`docs/architecture/position-graph.md` owns the application-level edge boundary and its technical contract. Code changes to `src/position-graph.js`, `src/edge-store.js`, shared persistence mechanics, tests, or callers belong here when they are required by settled graph semantics.

`docs/architecture/position-repository.md` and `src/position-store.js` own position-record persistence separately from graph-edge persistence. Shared IndexedDB mechanics in `src/indexed-db.js` should remain domain-neutral.

Source-specific graph-admission policy, Explorer Reading projection identity/order, Constellation selection, and Lichess source semantics remain outside this outcome even when their implementations also consume graph data.

# Unsettled:

Which additional implementation-alignment findings, if any, emerge while the human continues reviewing the ChartedGraph Nodes, Edges, Growth and retention, and architecture boundaries.

# Complete:

The ChartedGraph requirements review is settled, every implementation mismatch discovered during that review is either repaired or explicitly retained for a documented boundary reason, and the resulting code/tests use coherent graph terminology without changing established graph behavior unintentionally.

# Sync:

After any implementation or verification step that changes what remains, and before ending an implementation pass, synchronize this entry. Also synchronize when an action completes or becomes unavailable, a blocking condition changes, or a judgment is settled. Rewrite around the factual work and verification still open; do not accumulate progress history. If an outcome's completion condition is satisfied, run Backlog Close for that outcome. If Close cannot pass its normal gates, leave the entry open with the blocking condition explicit.
