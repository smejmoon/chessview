# Knowledge acquisition

## Purpose

Own the growth and refresh of Chessview's useful known chess graph: obtain source observations on behalf of product callers, reconcile graph-bearing observations into durable canonical knowledge, and own acquisition policy for opportunistic enrichment of knowledge already judged useful.

Knowledge acquisition is independent from what the current view ultimately shows. A request may acquire more information than the resulting [Constellation](constellation.md) contains, and durable graph knowledge may outlive every view that caused it to be learned.

Knowledge Acquisition is an application/domain boundary rather than a source client or transport scheduler. It decides how observations become useful stored knowledge and, when Chessview does proactive work, what additional knowledge is worth pursuing within an acquisition budget.

## Terms

**Explorer Reading** is the source-shape-valid rated Lichess Explorer evidence for one canonical source position at one fetch/cache point: the source-position totals plus the returned moves and their human-game statistics. An Explorer Reading is refreshable source evidence, not durable graph identity. A later Reading may change statistics or omit a move without retracting graph knowledge already established from an earlier Reading.

An Explorer Reading guarantees enough source-level structure for domain interpretation. It does not guarantee that every returned UCI move is legal from the canonical source position, and it does not guarantee that downstream graph reconciliation or persistence will succeed.

**Edge Admission** is the one-time acquisition decision that allows a previously unknown legal relationship observed in an Explorer Reading to enter Chessview's durable `PositionGraph`. Once admitted, the edge is known topology; later Readings refresh evidence on it but do not re-admit or revoke it.

## Boundary

Product callers own why information is needed. For example, Constellation owns whether another Explorer Reading can still change its constrained composition. Knowledge Acquisition owns fulfilling the requested acquisition and reconciling graph-bearing observations; it does not absorb the caller's visibility, presentation-space, or settlement policy.

Source clients own endpoint-specific access, authentication behavior, request parameters, parsing and source validation, facet cache/freshness policy, stale fallback, and successful source absence. A source client exposes a source-shape-valid usable observation or absence; it does not thereby own Chessview's graph-growth policy.

`PositionGraph` owns canonical graph identity, legal-edge validation, mutation invariants, and durable topology. Knowledge Acquisition decides whether an observed unknown relationship receives Edge Admission and which mutable statistical evidence from an Explorer Reading is reconciled onto known edges.

[Evidence](evidence.md) owns semantic chess meaning derived from usable source data. Knowledge Acquisition may request source facets, but it does not decide whether an evaluation is strong/bad, whether human results are favorable, or how those signals affect selection or presentation.

[`LichessGateway`](../architecture/lichess-gateway.md) owns application-wide transport scheduling, serialization, cooldown, and cancellation of obsolete queued HTTP work. Knowledge Acquisition may distinguish required work from opportunistic/background acquisition, but the gateway chooses which live Lichess request receives the next transport slot without learning Constellation, graph-growth, or evidence semantics.

## Requirements

- Acquired position and edge knowledge is reconciled against canonical graph identity rather than stored as view-local duplicates.
- The legal chess graph is fixed by chess rules, while Chessview's persisted graph is a monotonically discovered useful subset. Acquisition may add newly established legal positions/edges but does not retract already-known topology during ordinary refresh.
- Rated Lichess Explorer Readings are graph-bearing observations. Knowledge Acquisition interprets them into graph updates: resolve returned legal moves, refresh mutable statistics on already-known relationships, decide Edge Admission for unknown relationships, and ensure admitted target position records exist.
- Automatic Edge Admission is an acquisition decision. The current rule uses source-sample sufficiency only: once an Explorer Reading meets the tunable acquisition sample floor, every legal relationship returned by that Reading may be admitted. A move's local share is not an Edge Admission threshold.
- When an Explorer Reading is below the acquisition sample floor, unknown returned relationships are not automatically admitted, but any returned relationship that is already known still receives refreshed mutable statistics.
- Edge Admission is separate from Constellation selection. Admission must not silently become a visibility threshold; rare admitted relationships remain available to future views and evidence.
- When an Explorer Reading contains a move for an already-known edge, acquisition updates that edge's current statistical fields even if the move would not qualify for Edge Admission if it were still unknown.
- Omission from a later Explorer Reading, a lower frequency, or falling below a later threshold does not mean the legal relationship ceased to exist. Acquisition leaves the durable edge in place; absence from the new Reading supplies no replacement statistics for that edge.
- A usable cached Explorer Reading is reconciled into persisted graph state before a caller relies on successful acquisition, so cached source data can repair missing materialization and refresh known-edge statistics without requiring another network request.
- Reconciliation is monotonic and retryable rather than one transaction spanning every edge and target record in a Reading. Acquisition reports success only after every accepted update in that reconciliation attempt has persisted. If persistence fails after some valid updates have landed, those durable updates remain, the acquisition fails visibly, and a later reconciliation may safely resume from the same Reading.
- Refreshing Explorer data preserves explicit/manual and independently derived graph provenance while updating mutable statistics for returned known edges.
- Acquisition and visibility are separate decisions. Acquisition itself does not inspect the current visible-space budget or Constellation membership to decide which relationships a requested Explorer Reading may admit or retain.
- Constellation may request an Explorer Reading for one position or request Readings incrementally while composing a larger graph region. Knowledge Acquisition owns how each request is fulfilled; the caller owns whether another Reading can still affect its result.
- Automatic Constellation discovery is currently bounded by the rated Lichess Explorer data available to Chessview. Knowledge Acquisition is not required to search beyond that source merely to determine whether an otherwise unknown-frequency move deserves automatic visibility.
- Constellation selection may consume already-available engine evidence, but missing optional engine evidence does not create a Knowledge Acquisition obligation merely because obtaining it could change Salience. Cloud evaluation may instead be acquired for explicit current-view enrichment or opportunistic background enrichment under their owning policies.
- Explicit Move materialization remains a Position Graph operation. It may establish durable graph knowledge even when the move is outside automatic acquisition or Constellation selection.

## Proactive enrichment

Proactive enrichment, when enabled, belongs to Knowledge Acquisition because it answers what additional knowledge is worth pursuing after Chessview has already decided that a position or relationship is useful to know. Graph growth is the natural trigger; current Constellation uncertainty is not.

- Newly admitted or otherwise newly useful durable graph positions may be nominated for opportunistic enrichment through relevant source clients.
- Proactive enrichment is bounded. Knowledge Acquisition owns its candidate ordering, work budget, graph-distance/relevance limits, and removal of speculative intentions that are no longer worth pursuing. It must not turn ordinary graph growth into an unbounded recursive crawler.
- Source clients still own whether a nominated facet is already usable/fresh and whether obtaining it requires network access. Knowledge Acquisition does not duplicate endpoint cache policy.
- Opportunistic enrichment is background work. It must yield to information needed for explicit user/current-view work and must not keep Weather unsettled or delay publication of a trustworthy Constellation.
- Transport urgency is generic at the gateway boundary. Rich ordering among background acquisition candidates remains a Knowledge Acquisition concern; transport does not need to know why one position is more useful than another.
- Durable graph topology remains monotonic even if source-evidence storage later needs memory or persistence limits. Evicting refreshable evidence must not silently retract established graph identity.

## Verification

Deterministic tests should cover:

- acquisition adding durable knowledge without requiring that knowledge to become visible;
- a sufficiently sampled Explorer Reading admitting a rare returned legal relationship without a move-share cutoff;
- an insufficiently sampled Explorer Reading declining Edge Admission for an unknown relationship while still refreshing returned known edges;
- cached Explorer data repairing persisted graph state without a network request;
- source-shape-valid Explorer Readings leaving chess-legality interpretation to Knowledge Acquisition, with an invalid returned move not preventing other legal returned moves from reconciling;
- reconciliation persistence failure remaining visible to the caller even when earlier monotonic updates in the same Reading may already have landed;
- Explorer refresh updating statistics on returned known edges while preserving explicit/manual and derived provenance;
- a previously materialized edge remaining durable when a later Explorer Reading omits it;
- a previously materialized edge remaining durable when refreshed statistics fall below a rule that would govern a still-unknown relationship;
- concurrent provenance addition and Explorer statistical refresh retaining both results;
- acquisition from a selected source learning more outgoing relationships than the current Constellation shows;
- a caller stopping further Explorer Reading requests once additional outgoing knowledge cannot change its current structural result;
- explicitly materialized moves remaining durable independently of automatic Constellation eligibility;
- optional engine evidence remaining unnecessary for structural settlement merely because it could alter selection if it existed;
- when proactive enrichment is implemented, bounded background work yielding to required acquisition without changing Weather or graph identity semantics.
