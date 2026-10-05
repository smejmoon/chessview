# Knowledge acquisition

## Purpose

Own growth of Chessview's useful [ChartedGraph](charted-graph.md) knowledge from source observations: interpret graph-bearing observations into legal relationships, apply Edge Admission for previously unknown relationships, persist admitted graph knowledge, and fulfill explicitly nominated source work without deciding current-view relevance itself.

Knowledge Acquisition is independent from what the current view ultimately shows. A request may learn more graph knowledge than the resulting [Constellation](constellation.md) contains, and durable graph knowledge may outlive every refinement run that caused it to be learned.

Knowledge Acquisition is an application/domain boundary rather than a source client, relevance selector, settlement owner, or transport scheduler. Callers own why a particular observation or reconciliation is useful now; Knowledge Acquisition owns how a usable Explorer Reading becomes graph knowledge.

## Terms

**Explorer Reading** is a data-only, source-shape-valid observation from `LichessGamesDB` for one canonical source position: source-position totals plus returned moves and human-game statistics. Request state, fetch time, freshness/staleness, persistence state, and graph-reconciliation state are not part of the Reading.

An Explorer Reading is source evidence, not `ChartedGraph` identity. A later Reading may change statistics or omit a move without retracting graph knowledge already established from an earlier Reading.

**Edge Admission** is the one-time acquisition decision that allows a previously unknown legal relationship observed in an Explorer Reading to enter `ChartedGraph`. Once admitted, the Graph Edge is known topology; later Readings provide evidence but do not re-admit, refresh, or revoke the edge itself.

## Boundary

Product/current-view callers own relevance. Constellation exposes positions whose missing graph-bearing Explorer knowledge can still affect constrained composition through its Reading frontier. Current-view planning may turn an admitted frontier need into Explorer acquisition/reconciliation work. Knowledge Acquisition fulfills reconciliation when asked; it does not consume the frontier, call Constellation progress callbacks, or decide current-view settlement.

Provider acquisition and graph reconciliation are separate operations. A source provider may produce a usable Explorer Reading without growing the graph. Knowledge Acquisition may then reconcile that Reading deliberately. This permits Rail and Evidence to consume a fresh provider-current observation immediately while graph growth remains owned here.

For Current View refinement, Knowledge Acquisition preserves that separation in the outcome boundary. `refineExplorerReading` classifies only failure of the Explorer **load** phase after provider-owned cache/stale fallback policy has run. A provider-classified retry gate is returned as retryable; exhausted source acquisition is returned as unavailable-for-this-run. Once a usable Reading exists, graph reconciliation runs normally and any reconciliation/persistence exception propagates as an ordinary failure rather than being converted into source unavailability.

When reconciliation completes, [Current view](../architecture/current-view.md) may recompute the accepted view from facts now available. If that reconciliation was admitted as a structural obligation, completion alone is not enough for settlement: the result must be incorporated or made irrelevant by recomposition. Knowledge Acquisition does not push graph changes to Rail/Constellation and does not maintain a source-to-consumer event graph.

Source clients own endpoint-specific access, authentication behavior, request parameters, parsing/source validation, facet freshness, stale fallback, provider-current retention, successful source absence, and semantic classification of exhausted source acquisition for refinement. They expose usable source observations or source-level refinement outcomes; they do not own Chessview graph-growth policy.

[`PositionGraph`](../architecture/position-graph.md) owns canonical Graph Edge identity, legal-edge validation, invariant-preserving mutation, and durable edge persistence. Knowledge Acquisition decides whether an observed unknown relationship receives Edge Admission and ensures admitted graph knowledge is established.

[Evidence](evidence.md) owns semantic chess meaning from usable source observations. Knowledge Acquisition does not mirror mutable Explorer statistics onto Graph Edges and does not decide evaluation/human-result semantics.

[`LichessGateway`](../architecture/lichess-gateway.md) owns application-wide Lichess transport scheduling, cooldown, and queued cancellation. `PositionRepository` owns shared producer lifetime for one position/facet. Knowledge Acquisition supplies foreground/background participation according to caller policy but does not create separate producer identities for current-view consumers.

## Requirements

- Acquired position and Graph Edge knowledge is reconciled against canonical `ChartedGraph` identity rather than stored as view-local duplicates.
- Acquisition obeys the [`ChartedGraph` growth and retention contract](charted-graph.md#growth-and-retention): it may establish new legal positions/relationships, while ordinary source refresh is never authority to retract topology already established by Chessview.
- Rated Explorer Readings are graph-bearing observations. When reconciliation is requested, Knowledge Acquisition resolves returned legal moves, decides Edge Admission for unknown relationships, and ensures admitted target position records exist.
- Reconciliation does not copy Explorer game counts, move share, source timestamps, observation revisions, Salience, eligibility, or other mutable source/current-view state onto Graph Edges.
- Automatic Edge Admission uses source-sample sufficiency only: once an Explorer Reading meets the tunable acquisition sample floor, every legal relationship returned by that Reading may be admitted. Local move share is not an admission threshold.
- Below the acquisition sample floor, unknown returned relationships are not automatically admitted. Already-known Graph Edges require no graph rewrite merely because they appear in the Reading.
- Edge Admission is separate from Constellation selection. Rare admitted relationships remain available to future views/evidence even when not currently visible.
- Omission from a later Explorer Reading, lower frequency, or later threshold changes do not retract a known legal Graph Edge.
- A usable cached or provider-current Explorer Reading may be reconciled without avoidable network retrieval.
- Fresh source usability does not depend on graph persistence succeeding. Conversely, successful source acquisition does not imply graph reconciliation succeeded.
- Reconciliation is retryable rather than one transaction spanning every edge/target in a Reading. If persistence fails after some valid updates land, those durable updates remain and a later reconciliation may safely resume.
- Repeated reconciliation converges against actual graph state. Already-established relationships need no rewrite; admissible missing relationships remain retryable.
- A failed Explorer load may become unavailable-for-this-run only after source-provider fallback/recovery policy is exhausted. Knowledge Acquisition does not infer that classification from transport strings or presentation state.
- A retryable Explorer load outcome carries the lower-owned gate that makes another attempt eligible. Current View does not invent a timer or retry immediately.
- A usable Explorer Reading followed by graph reconciliation failure is never silently discharged as source unavailable; that failure remains visible/retryable at the graph-knowledge boundary.
- Acquisition and visibility remain separate. Knowledge Acquisition does not inspect current presentation-space capacity to decide which relationships a requested Reading may admit or retain.
- Missing optional engine evidence does not create a Knowledge Acquisition or structural-settlement obligation merely because it could alter selection if it existed.
- Explicit Move materialization establishes graph knowledge independently of automatic Explorer acquisition or Constellation selection.

## Supplementary lookahead

Supplementary lookahead is Constellation-directed and outside structural settlement.

- Constellation owns which positions it nominates and their ordering.
- Lookahead nomination does not make a position visible, make Current View structurally Settling, or require graph reconciliation.
- An obsolete nomination that has not started does no source work.
- Once a supplementary warm starts, Knowledge Acquisition gives it a bounded background lifetime so reusable source data may finish into cache even if the old view changes.
- Later foreground demand for the same position/facet may join the same shared producer and promote its transport urgency rather than duplicate retrieval.
- Warming a graph-bearing source facet does not itself reconcile that observation into `ChartedGraph`; a later deliberate reconciliation may consume the warmed observation.
- Knowledge Acquisition does not recursively crawl from warmed results or invent a second relevance ranking.
- Supplementary lookahead does not keep Weather structurally unsettled.

## Verification

Deterministic tests should cover:

- acquisition adding durable graph knowledge without requiring that knowledge to become visible;
- source acquisition alone not owning Edge Admission;
- a sufficiently sampled Explorer Reading admitting a rare returned legal relationship without a move-share cutoff;
- an insufficiently sampled Reading declining admission for an unknown relationship;
- cached/provider-current Explorer data repairing missing topology without avoidable network access;
- source-shape-valid Readings leaving chess-legality interpretation to Knowledge Acquisition, with one invalid move not preventing other legal moves from reconciling;
- reconciliation persistence failure remaining visible while already-landed valid updates remain durable;
- repeated reconciliation performing no unnecessary Graph Edge rewrite while still retrying missing admitted relationships;
- later Explorer omission/frequency change leaving known topology durable;
- acquisition learning more outgoing relationships than the current Constellation displays;
- Constellation Reading-frontier needs being fulfilled by externally coordinated acquisition rather than a Knowledge-Acquisition-owned composition loop;
- a completed structural reconciliation remaining unsettled until Current View recomposition incorporates its result;
- exhausted Explorer source acquisition producing semantic unavailable-for-this-run without manufacturing a Reading;
- a provider-owned retry gate crossing the Knowledge Acquisition boundary unchanged;
- graph reconciliation failure after a usable Reading propagating instead of becoming source unavailability;
- explicitly materialized moves remaining durable independently of automatic Constellation eligibility;
- optional engine evidence remaining unnecessary for structural settlement;
- bounded supplementary warming remaining separate from graph reconciliation and current-view settlement;
- foreground demand sharing/promoting an already-running background producer rather than duplicating it;
- detached warm expiry releasing an otherwise-unused producer through normal shared-load cancellation.
