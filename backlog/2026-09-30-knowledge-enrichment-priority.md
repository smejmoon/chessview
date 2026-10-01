# Do:

Add bounded proactive enrichment for newly useful durable graph knowledge using the now-available generic foreground/background Lichess transport urgency.

Knowledge Acquisition should decide which known positions/facets are worth warming, order that background work, and bound how much speculative acquisition remains live. Source clients should still decide whether their facet is already usable/fresh and how to obtain it. Background enrichment should nominate source work with background urgency; explicit/current-view demand may share and promote the same producer without duplicate acquisition.

# Because:

`docs/components/knowledge-acquisition.md` assigns proactive enrichment to Knowledge Acquisition because graph growth is the event that establishes that Chessview considers a position or relationship useful enough to remember. Warming relevant evidence after that decision can shift latency away from later navigation without making optional evidence part of current Constellation settlement.

`LichessGateway` now supports the generic transport rule this outcome needed: the next available request slot goes to queued foreground work before queued background work, without preempting an in-flight request. `PositionRepository` exposes the highest urgency among live subscribers to one shared facet producer, so later foreground demand can promote queued speculative work and losing that demand can demote it again.

# Edges:

Knowledge Acquisition owns which positions/facets become proactive enrichment candidates, their ordering within background work, acquisition budgets, graph-distance/relevance limits, and dropping speculative intentions that are no longer worth pursuing. It must not become an unbounded recursive graph crawler.

Source clients such as Explorer, Masters, and `LichessEval` retain endpoint-specific cache/freshness, validation, stale fallback, and successful-absence semantics. Proactive enrichment should nominate source facets rather than duplicate those policies.

`LichessGateway` owns cross-client transport serialization, cooldown, queued cancellation, and generic foreground/background precedence. The two-class urgency model is sufficient for the current observed need; richer priority classes or anti-starvation behavior remain unnecessary until concrete behavior earns them.

A request already in flight is not preempted merely because foreground work arrives. Existing shared per-position/facet producer lifetime and caller cancellation through `PositionRepository` continue to prevent obsolete speculative callers from forcing unnecessary network work.

Proactive enrichment is supplementary/background to the current view. It must not keep Weather unsettled, invalidate a trustworthy Constellation, or make missing engine evidence a structural selection dependency.

Established graph topology remains durable even if refreshable source evidence later needs memory or persistence limits. Evidence eviction/refresh policy must not silently remove established graph identity.

`docs/components/knowledge-acquisition.md` §Boundary owns the separation between source observations and graph reconciliation/Edge Admission, while `docs/components/opening-explorer-databases.md` §Client boundary owns source-client responsibilities. `backlog/2026-09-30-explorer-reading-projection.md` separately tracks avoiding repeated projection of the same cached Explorer Reading while preserving retry after incomplete reconciliation. Proactive enrichment may use those boundaries but does not need to redesign `PositionGraph` identity or Constellation selection.

# Unsettled:

Choose the initial nomination scope for proactive enrichment: whether to start only from Explorer Edge Admission or also accept positions newly materialized by explicit/manual or derived graph workflows. Keep the trigger tied to newly useful durable knowledge rather than current-view uncertainty.

Choose the first set of facets worth warming and the smallest practical acquisition budget. Consider bounded queued candidates, distance/relevance to recently useful positions, cache/storage pressure, and user navigation locality; do not turn provisional numeric budgets into product promises without evidence.

Choose how background candidates are ordered inside Knowledge Acquisition. Useful signals may include proximity to the current/recent Nodus, whether a position was explicitly traversed, and local human Prevalence where available. Keep this rich ordering out of `LichessGateway`.

# Complete:

Deterministic tests prove that newly nominated useful graph knowledge can schedule bounded proactive enrichment without recursively exploding the queue; already-usable/fresh facets avoid unnecessary network access through their source clients; obsolete speculative work can disappear before send; and later explicit/current-view demand can share and promote already-queued work rather than duplicate it.

Existing one-request-at-a-time, foreground-over-background queued precedence, shared 429 cooldown, source-specific cache/failure semantics, shared producer lifetime, and caller cancellation remain intact. Background enrichment never controls Weather or becomes required for Constellation settlement. A later visit to successfully warmed knowledge can consume the already available source evidence without repeating avoidable acquisition.

# Sync:

After any implementation or verification step that changes what remains, and before ending an implementation pass, synchronize this entry. Also synchronize when an action completes or becomes unavailable, a blocking condition changes, or a judgment is settled. Rewrite around the factual work and verification still open; do not accumulate progress history. If an outcome's completion condition is satisfied, run Backlog Close for that outcome. If Close cannot pass its normal gates, leave the entry open with the blocking condition explicit.
