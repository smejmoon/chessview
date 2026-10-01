# Do:

Continue the current `ChartedGraph` requirements review and align implementation only where the settled domain model exposes a real code mismatch. Keep `ChartedGraph` as the durable domain model and `PositionGraph` as the distinct application/architecture boundary for validated edge access and mutation unless later requirements invalidate that separation.

As the review surfaces additional code/document mismatches in Nodes, Edges, Growth and retention, or their technical realization, fold them into this outcome rather than creating competing graph-alignment work.

# Because:

`docs/components/charted-graph.md` now owns durable graph semantics, while `docs/architecture/position-graph.md` owns the current edge API, normalization, mutation coordination, and persistence mechanics. That separation gives the two names distinct responsibilities, so a mechanical `PositionGraph` -> `ChartedGraph` implementation rename is not currently justified.

The remaining risk is that further requirements review may reveal implementation behavior that does not match the settled `ChartedGraph` contract.

# Edges:

`docs/components/charted-graph.md` owns the durable graph requirements being reviewed.

`docs/architecture/position-graph.md` owns the existing application-level edge boundary and its technical contract. Code changes to `src/position-graph.js`, related persistence mechanics, tests, or callers belong here when they are required by settled graph semantics.

This outcome does not decide source-specific graph-admission policy, Constellation selection, or Lichess source semantics.

# Unsettled:

Which additional implementation-alignment findings, if any, emerge while the human continues reviewing the ChartedGraph Nodes, Edges, Growth and retention, and architecture boundaries.

# Complete:

The ChartedGraph requirements review is settled, every implementation mismatch discovered during that review is either repaired or explicitly retained for a documented boundary reason, and the resulting code/tests use coherent graph terminology without changing established graph behavior unintentionally.

# Sync:

After any implementation or verification step that changes what remains, and before ending an implementation pass, synchronize this entry. Also synchronize when an action completes or becomes unavailable, a blocking condition changes, or a judgment is settled. Rewrite around the factual work and verification still open; do not accumulate progress history. If an outcome's completion condition is satisfied, run Backlog Close for that outcome. If Close cannot pass its normal gates, leave the entry open with the blocking condition explicit.
