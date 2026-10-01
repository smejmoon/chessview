# Do:

Treat normal Explorer request cancellation as cancellation rather than as a refresh failure. In particular, an `AbortError` must leave the source-client path without emitting the error-level `explorer refresh failed` diagnostic or falling through stale-refresh recovery intended for genuine failures.

# Because:

`src/explorer.js::loadExplorerReading()` currently logs every caught error as `explorer refresh failed` before `staleExplorerOrThrow()` recognizes `AbortError` and rethrows it. Normal lifecycle cancellation can come from obsolete caller demand, ordinary shared-load last-subscriber cleanup, or expiry of the bounded lifetime for a started supplementary warm. Those cancellations are expected control flow rather than source failures, so logging them as refresh failures produces misleading diagnostics.

# Edges:

This outcome belongs to the Explorer source-client lifecycle. It does not change Explorer Reading data shape, source freshness, authentication semantics, graph admission, Weather, `ChartedGraph` identity, or the bounded supplementary-warm lifetime owned by Knowledge Acquisition.

It may be implemented in the same pass as nearby graph/Knowledge Acquisition repairs when convenient, but it does not block `backlog/2026-09-30-charted-graph-code-alignment.md` and that graph-alignment outcome does not need to absorb this source-client diagnostic concern.

# Complete:

Deterministic verification shows that an aborted Explorer load propagates cancellation without the refresh-failed error diagnostic and without stale-failure fallback, while genuine refresh failures still retain their existing diagnostics and stale-reading fallback behavior where applicable.

# Sync:

After any implementation or verification step that changes what remains, and before ending an implementation pass, synchronize this entry. Also synchronize when an action completes or becomes unavailable, a blocking condition changes, or a judgment is settled. Rewrite around the factual work and verification still open; do not accumulate progress history. If an outcome's completion condition is satisfied, run Backlog Close for that outcome. If Close cannot pass its normal gates, leave the entry open with the blocking condition explicit.
