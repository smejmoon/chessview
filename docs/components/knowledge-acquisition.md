# Knowledge acquisition

## Purpose

Own the growth of Chessview's useful [ChartedGraph](charted-graph.md) knowledge from source observations: obtain graph-bearing observations on behalf of product callers, interpret those observations into legal relationships, apply Edge Admission for previously unknown relationships, and fulfill opportunistic enrichment nominations without deciding current-view relevance itself.

Knowledge Acquisition is independent from what the current view ultimately shows. A request may acquire more graph knowledge than the resulting [Constellation](constellation.md) contains, and durable graph knowledge may outlive every view that caused it to be learned.

Knowledge Acquisition is an application/domain boundary rather than a source client, relevance selector, or transport scheduler. It decides how observations become useful graph knowledge and how nominated source work is fulfilled; callers own why particular information is needed or likely to be useful now.

## Terms

**Explorer Reading** is a data-only, source-shape-valid observation from `LichessGamesDB` for one canonical source position: the source-position totals plus the returned moves and their human-game statistics. An Explorer Reading records source facts; request state, fetch time, freshness/staleness, cache lifecycle, and graph reconciliation state are not part of the Reading.

An Explorer Reading is source evidence, not `ChartedGraph` identity. A later Reading may change statistics or omit a move without retracting graph knowledge already established from an earlier Reading. A Reading guarantees enough source-level structure for domain interpretation; it does not guarantee that every returned UCI move is legal from the canonical source position, and it does not guarantee that downstream graph reconciliation or persistence will succeed.

**Edge Admission** is the one-time acquisition decision that allows a previously unknown legal relationship observed in an Explorer Reading to enter Chessview's `ChartedGraph`. Once admitted, the Graph Edge is known topology; later Readings may provide different evidence about that Move but do not re-admit, refresh, or revoke the Graph Edge itself.

## Boundary

Product callers own why information is needed. For example, Constellation owns whether another Explorer Reading can still change its constrained composition and may separately nominate bounded supplementary lookahead from positions it considers locally relevant to the current view. Knowledge Acquisition owns fulfilling requested or nominated acquisition and reconciling graph-bearing observations when reconciliation is requested; it does not absorb the caller's visibility, presentation-space, settlement, or relevance policy.

The current-view boundary may replace or cancel obsolete lookahead relevance as accepted composition changes, modes switch, or the Nodus changes. A nomination that is already obsolete before warming starts does no work. Once Knowledge Acquisition has started a supplementary warm, however, fulfillment receives its own bounded background lifetime rather than being cancelled solely because the nominating view changed. That detached lifetime does not make the current view owner of reusable source data or shared producer state.

Source clients own endpoint-specific access, authentication behavior, request parameters, parsing and source validation, facet cache/freshness policy, stale fallback, and successful source absence. A source client exposes a source-shape-valid usable observation or absence; it does not thereby own Chessview's graph-growth policy.

[`ChartedGraph`](charted-graph.md) owns durable graph semantics and retention. [`PositionGraph`](../architecture/position-graph.md) is the current application boundary for canonical Graph Edge identity, legal-edge validation, invariant-preserving graph mutation, and durable edge persistence. Knowledge Acquisition decides whether an observed unknown relationship receives Edge Admission and ensures admitted graph knowledge is established.

[Evidence](evidence.md) owns semantic chess meaning derived from usable source data, including Prevalence and human-result interpretation from the current Explorer Reading. Knowledge Acquisition may request source facets, but it does not mirror mutable Explorer statistics onto Graph Edges and does not decide whether an evaluation is strong/bad, whether human results are favorable, or how those signals affect selection or presentation.

[`LichessGateway`](../architecture/lichess-gateway.md) owns application-wide transport scheduling, serialization, cooldown, and cancellation of obsolete queued HTTP work. Knowledge Acquisition may distinguish required work from opportunistic/background acquisition, but the gateway chooses which live Lichess request receives the next transport slot without learning Constellation, graph-growth, or evidence semantics.

## Requirements

- Acquired position and Graph Edge knowledge is reconciled against canonical `ChartedGraph` identity rather than stored as view-local duplicates.
- Acquisition obeys the [`ChartedGraph` growth and retention contract](charted-graph.md#growth-and-retention): it may establish new legal positions and relationships, while ordinary source refresh is never authority to retract topology already established by Chessview.
- Rated Lichess Explorer Readings are graph-bearing observations. When reconciliation is requested, Knowledge Acquisition resolves returned legal moves, decides Edge Admission for unknown relationships, and ensures admitted target position records exist.
- Reconciliation does not copy Explorer game counts, move share, source timestamps, observation revisions, Salience, eligibility, or other mutable source/current-view state onto Graph Edges.
- Automatic Edge Admission is an acquisition decision. The current rule uses source-sample sufficiency only: once an Explorer Reading meets the tunable acquisition sample floor, every legal relationship returned by that Reading may be admitted. A move's local share is not an Edge Admission threshold.
- When an Explorer Reading is below the acquisition sample floor, unknown returned relationships are not automatically admitted. Already-known Graph Edges require no graph update merely because they appear in the Reading.
- Edge Admission is separate from Constellation selection. Admission must not silently become a visibility threshold; rare admitted relationships remain available to future views and evidence.
- Omission from a later Explorer Reading, a lower frequency, or falling below a later threshold does not mean the legal relationship ceased to exist. Acquisition leaves the durable Graph Edge in place.
- A usable cached Explorer Reading may establish graph knowledge before a caller relies on successful graph acquisition, so cached source data can repair missing topology without requiring another network request.
- Reconciliation is retryable rather than one transaction spanning every edge and target record in a Reading. Acquisition reports successful graph acquisition only after every accepted graph update in that reconciliation attempt has persisted. If persistence fails after some valid updates have landed, those durable updates remain, the acquisition fails visibly, and a later reconciliation may safely resume from the same Reading.
- Repeated reconciliation converges against actual graph state. Relationships already established need no graph rewrite; admissible missing relationships remain retryable. No durable Explorer observation identity, projection-completion marker, or source-order protocol is required merely to make reconciliation idempotent.
- Acquisition and visibility are separate decisions. Knowledge Acquisition does not independently inspect the current visible-space budget or Constellation membership to decide which relationships a requested Explorer Reading may admit or retain.
- Constellation may request an Explorer Reading for one position or request Readings incrementally while composing a larger graph region. Knowledge Acquisition owns how each request is fulfilled; the caller owns whether another Reading can still affect its result.
- Automatic Constellation discovery is currently bounded by the rated Lichess Explorer data available to Chessview. Knowledge Acquisition is not required to search beyond that source merely to determine whether an otherwise unknown-frequency move deserves automatic visibility.
- Constellation selection may consume already-available engine evidence, but missing optional engine evidence does not create a Knowledge Acquisition obligation merely because obtaining it could change Salience. Cloud evaluation may instead be acquired for explicit current-view enrichment or supplementary lookahead under their owning policies.
- Explicit Move materialization establishes `ChartedGraph` knowledge independently of automatic acquisition or Constellation selection.

## Supplementary lookahead

Supplementary lookahead is Constellation-directed. Constellation may nominate a bounded set of canonical positions that are locally relevant to an accepted composition and plausible near-term navigation targets. Those nominations express ephemeral usefulness, not durable graph identity and not structural work required to settle the current Constellation.

- Constellation owns which positions it nominates and their relevance ordering. Exact lookahead breadth is a Constellation policy/implementation choice rather than a transport priority class.
- The current-view boundary owns whether a nomination remains relevant to the current accepted projection. Recenter, mode changes, or accepted refinement may replace obsolete nomination relevance immediately.
- Knowledge Acquisition turns a still-live nomination into supplementary source-client work with background urgency. If the nomination is already obsolete before warming starts, the warm is not started. Once warming starts, it receives a detached background lifetime of at most 30 seconds so useful source work can finish into cache instead of being cancelled solely because the view changed.
- The bounded warm lifetime is fulfillment policy, not current-view lifetime. Later foreground demand for the same position/facet may join the same shared producer and promote its transport urgency; if no caller joins and the warm exceeds its ceiling, the warm subscription expires and ordinary `PositionRepository` last-subscriber cancellation may stop the producer.
- Knowledge Acquisition does not independently crawl outward from warmed results or invent a second relevance ranking.
- Warming a graph-bearing source facet does not by itself reconcile that observation into `ChartedGraph` or perform Edge Admission. A later normal graph-acquisition request may reconcile the already-usable cached observation through the ordinary Knowledge Acquisition path.
- Source clients still own whether a nominated facet is already usable/fresh and whether obtaining it requires network access. Knowledge Acquisition does not duplicate endpoint cache policy.
- Supplementary lookahead must yield to information needed for explicit user/current-view work and must not keep Weather unsettled or delay publication of a trustworthy Constellation.
- Shared per-position/facet producers may be joined by later foreground demand. Their effective transport urgency follows the highest live subscriber, so a background warm can become foreground without duplicate acquisition.
- `ChartedGraph` topology remains durable even if source-evidence storage later needs memory or persistence limits. Evicting refreshable evidence must not silently retract established graph identity.

## Verification

Deterministic tests should cover:

- acquisition adding durable knowledge without requiring that knowledge to become visible;
- a sufficiently sampled Explorer Reading admitting a rare returned legal relationship without a move-share cutoff;
- an insufficiently sampled Explorer Reading declining Edge Admission for an unknown relationship;
- cached Explorer data repairing missing persisted graph topology without a network request;
- source-shape-valid Explorer Readings leaving chess-legality interpretation to Knowledge Acquisition, with an invalid returned move not preventing other legal returned moves from reconciling;
- reconciliation persistence failure remaining visible to the caller even when earlier valid graph updates in the same Reading may already have landed;
- repeated reconciliation of an already-known Reading performing no unnecessary Graph Edge rewrite while still retrying missing admitted relationships;
- a previously materialized Graph Edge remaining durable when a later Explorer Reading omits it;
- a previously materialized Graph Edge remaining durable when current Explorer evidence later falls below a rule that would govern a still-unknown relationship;
- acquisition from a selected source learning more outgoing relationships than the current Constellation shows;
- a caller stopping further Explorer Reading requests once additional outgoing knowledge cannot change its current structural result;
- explicitly materialized moves remaining durable independently of automatic Constellation eligibility;
- optional engine evidence remaining unnecessary for structural settlement merely because it could alter selection if it existed;
- bounded Constellation-directed lookahead warming source data with background urgency without reconciling graph-bearing observations or recursively expanding the graph;
- an already-obsolete nomination doing no source work;
- a started supplementary warm surviving view replacement for its bounded lifetime so later foreground demand can share and promote the same producer rather than duplicate it;
- expiry of that detached lifetime releasing an otherwise-unused producer through normal shared-load cancellation;
- a later graph-acquisition request consuming an already-warmed usable source observation and reconciling missing topology without avoidable network access;
- supplementary lookahead remaining independent from Weather and current Constellation settlement.
