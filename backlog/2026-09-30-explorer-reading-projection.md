# Do:

Make successful reconciliation of one cached Explorer Reading idempotent across later recompositions while keeping incomplete or failed reconciliation retryable. Preserve a clean separation between source-cache freshness and the fact that a particular source observation has already been projected into durable graph state.

# Because:

`src/knowledge-acquisition.js::reconcileCachedExplorerReading()` currently replays the full Reading whenever cached Explorer data exists. `src/nodus-structure.js` deduplicates Explorer work only inside one `createCandidateSource()` instance, so a later recomposition creates a fresh local map and can project the same cached Reading again. That repeats durable edge/target mutation and reconciliation logging even when no source observation changed.

# Edges:

Knowledge Acquisition owns whether and when a source observation has been successfully reconciled; the Explorer client owns source data, fetch time, freshness, stale fallback, and request lifecycle. A source fetch timestamp must not silently become the Knowledge Acquisition projection-completion marker.

`ChartedGraph` and `PositionGraph` own durable graph identity and mutation invariants, not source-observation lifecycle. This work may be implemented together with `backlog/2026-09-30-charted-graph-code-alignment.md` if the same mutation boundary changes, or after that graph work if separation stays cleaner. Neither outcome blocks the other.

# Unsettled:

Choose the smallest durable identity/version for distinguishing one Explorer Reading snapshot from another and recording completed projection without putting downstream reconciliation state inside the data-only Reading itself.

Choose where projection completion is persisted and how partial reconciliation is represented. Completion may be recorded only after every accepted update in the attempt has persisted; an interrupted or failed projection must remain safely retryable even when some earlier edge or target updates already landed.

# Complete:

Deterministic verification shows that after one cached Explorer Reading has reconciled successfully, later recompositions using that same Reading do not replay its graph/target mutations; a distinct later Reading is reconciled; and an interrupted or failed reconciliation of a Reading remains retryable until it completes. Source freshness and stale-cache behavior remain independently owned by the Explorer client.

# Sync:

After any implementation or verification step that changes what remains, and before ending an implementation pass, synchronize this entry. Also synchronize when an action completes or becomes unavailable, a blocking condition changes, or a judgment is settled. Rewrite around the factual work and verification still open; do not accumulate progress history. If an outcome's completion condition is satisfied, run Backlog Close for that outcome. If Close cannot pass its normal gates, leave the entry open with the blocking condition explicit.
