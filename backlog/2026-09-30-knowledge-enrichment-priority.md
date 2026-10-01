# Do:

Add bounded proactive enrichment for newly useful durable graph knowledge, with enough generic `LichessGateway` request priority that speculative/background work cannot delay information needed for explicit user/current-view work.

Knowledge Acquisition should decide which known positions/facets are worth warming, order that background work, and bound how much speculative acquisition remains live. Source clients should still decide whether their facet is already usable/fresh and how to obtain it. The gateway should schedule only generic transport urgency, not graph, Constellation, or evidence semantics.

# Because:

`docs/components/knowledge-acquisition.md` assigns proactive enrichment to Knowledge Acquisition because graph growth is the event that establishes that Chessview considers a position or relationship useful enough to remember. Warming relevant evidence after that decision can shift latency away from later navigation without making optional evidence part of current Constellation settlement.

The current request gate is FIFO and serializes all application-issued Lichess traffic through one tail. Enqueuing speculative cloud-evaluation or other enrichment work before a later foreground Explorer/authentication/current-view request could therefore turn proactive warming into a responsiveness regression unless queued work can yield by urgency.

# Edges:

Knowledge Acquisition owns which positions/facets become proactive enrichment candidates, their ordering within background work, acquisition budgets, graph-distance/relevance limits, and dropping speculative intentions that are no longer worth pursuing. It must not become an unbounded recursive graph crawler.

Source clients such as Explorer, Masters, and `LichessEval` retain endpoint-specific cache/freshness, validation, stale fallback, and successful-absence semantics. Proactive enrichment should nominate source facets rather than duplicate those policies.

`LichessGateway` owns cross-client transport serialization, cooldown, queued cancellation, and which live HTTP request receives the next slot. Its priority vocabulary must stay generic. Start with the smallest useful urgency model in which required/foreground work can pass queued background work; add more classes or anti-starvation machinery only if concrete behavior requires them.

A request already in flight does not need to be preempted merely because higher-priority work arrives. Priority governs queued work. Existing shared per-position/facet producer lifetime and caller cancellation through `PositionRepository` must continue to prevent obsolete speculative callers from forcing unnecessary network work.

Proactive enrichment is supplementary/background to the current view. It must not keep Weather unsettled, invalidate a trustworthy Constellation, or make missing engine evidence a structural selection dependency.

Durable graph topology remains monotonic even if refreshable source evidence later needs memory or persistence limits. Evidence eviction/refresh policy must not silently remove established graph identity.

`backlog/2026-09-30-knowledge-acquisition-boundary.md` owns separating Explorer source access from graph reconciliation/Edge Admission. Proactive enrichment may use that boundary but does not need to redesign PositionGraph identity or Constellation selection.

# Unsettled:

Choose the initial nomination scope for proactive enrichment: whether to start only from Explorer Edge Admission or also accept positions newly materialized by explicit/manual or derived graph workflows. Keep the trigger tied to newly useful durable knowledge rather than current-view uncertainty.

Choose the first set of facets worth warming and the smallest practical acquisition budget. Consider bounded queued candidates, distance/relevance to recently useful positions, cache/storage pressure, and user navigation locality; do not turn provisional numeric budgets into product promises without evidence.

Choose how background candidates are ordered inside Knowledge Acquisition. Useful signals may include proximity to the current/recent Nodus, whether a position was explicitly traversed, and local human Prevalence where available. Keep this rich ordering out of `LichessGateway`.

Choose the minimum generic gateway urgency contract. Foreground/current work must be able to pass queued background work while preserving one-request-at-a-time and 429 cooldown behavior; background starvation during sustained active use is acceptable initially because warming is opportunistic.

# Complete:

Deterministic tests prove that newly nominated useful graph knowledge can schedule bounded proactive enrichment without recursively exploding the queue; already-usable/fresh facets avoid unnecessary network access through their source clients; obsolete speculative work can disappear before send; and a foreground/current-view request arriving behind queued background work receives the next available transport slot after the in-flight request completes.

Existing one-request-at-a-time, shared 429 cooldown, source-specific cache/failure semantics, shared producer lifetime, and caller cancellation remain intact. Background enrichment never controls Weather or becomes required for Constellation settlement. A later visit to successfully warmed knowledge can consume the already available source evidence without repeating avoidable acquisition.

# Sync:

After any implementation or verification step that changes what remains, and before ending an implementation pass, synchronize this entry. Also synchronize when an action completes or becomes unavailable, a blocking condition changes, or a judgment is settled. Rewrite around the factual work and verification still open; do not accumulate progress history. If an outcome's completion condition is satisfied, run Backlog Close for that outcome. If Close cannot pass its normal gates, leave the entry open with the blocking condition explicit.
