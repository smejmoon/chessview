# Do:

Implement Root bootstrap for an arbitrary canonical Nodus that has no known incoming Graph Edge.

Derive a bounded set of locally legal one-ply predecessor hypotheses from the current position, use those positions only as addresses for authoritative rated-Lichess Explorer acquisition/reconciliation, and let ordinary Evidence-backed Candidate selection admit any predecessor relationship that the source actually establishes. Once an authoritative incoming edge exists, compose Root/sibling context and move-order transposition enrichment through the existing graph/Evidence path.

Do not require prior navigation history or a previously known incoming edge merely to discover Roots for a directly loaded FEN.

# Because:

The current Root path has a bootstrap hole. `composeRootContext()` begins from known incoming Graph Edges, while Root transposition enrichment reconstructs a reference path by walking those same known incoming edges. A directly loaded canonical position can therefore reach a settled `view=roots` with an empty Root region even after substantial Explorer acquisition and reconciliation, simply because no incoming seed was known.

Local chess legality can identify predecessor positions worth asking about, but it does not establish historical occurrence. The current Candidate contract still requires usable rated-Lichess Prevalence for the predecessor relationship. Local reverse reachability should therefore bootstrap discovery, not bypass Evidence or become graph truth by itself.

This outcome is about making authoritative Root discovery possible from an arbitrary Nodus. It is not primarily a visual fallback task.

# Edges:

A locally derived predecessor is a transient hypothesis only. It must not be persisted into ChartedGraph, displayed as an authoritative Root, or promoted to a Selection Candidate solely because the move into the Nodus is legal.

Explorer/Knowledge Acquisition remains authoritative for whether a hypothesized predecessor was historically observed and for admitting the corresponding Graph Edge. Existing PositionRepository, LichessGateway, Evidence, Current View, and Candidate-selection ownership stays in place; this outcome must not create a second cache, scheduler, freshness protocol, or reconciliation lifecycle.

Root transposition enrichment remains downstream of authoritative topology. Current View now nominates that refinement only when the accepted Roots composition already contains an authoritative incoming relationship to the Nodus, so an empty-topology attempt cannot settle the task before bootstrap discovers its first real incoming edge. It may use the newly established incoming seed once ordinary graph reconciliation has made that seed real, but it must not turn local hypotheses into durable ancestry itself.

Foreground/background request policy remains owned by Current View and Knowledge Acquisition. Bootstrap discovery may nominate bounded work, but it does not gain an independent priority system.

This outcome does not optimize the latency of Root views that already have sufficient authoritative incoming topology, except where the bootstrap path itself removes avoidable dead-end work.

# Unsettled:

The first practical bootstrap is implemented around observed Lichess games rather than local reverse generation. The center Explorer request asks for two top and two recent representative games. A separate sampled-predecessor component batch-exports those game IDs once, replays each game locally, and nominates the distinct observed predecessor immediately before the exact canonical Nodus. Those nominations remain discovery input only: existing Explorer refinement/reconciliation on each predecessor establishes any durable Graph Edge and ordinary Evidence/Candidate selection decides Root visibility.

Root coverage is now measured from authoritative data only: for each selected authoritative Root edge, Chessview takes that move's rated-Lichess Explorer game count from the predecessor Reading, sums those counts, and divides by the center Explorer total. Sample frequency never contributes to coverage. The Roots toggle exposes both percentage and covered/total games so real positions can show whether the simple four-game discovery sample is sufficient.

Root transposition refinement is gated on authoritative visible incoming topology, so an empty Root composition no longer consumes the transposition task before bootstrap can establish a seed.

Exact-tip CI passed for the implementation before this backlog synchronization (tests, TypeScript, and production build). Re-run exact-tip CI for this documentation tip, then verify the branch preview against a directly loaded arbitrary/Panov Nodus: sampled game export must succeed through LichessGateway, sampled predecessors must reconcile into incoming Graph Edges, Roots must appear without prior navigation, and the displayed coverage must agree with the predecessor Explorer move counts over the center Explorer total. If representative games are absent or fail to expose useful predecessors, decide from observed coverage whether a local predecessor-hypothesis fallback is still warranted.

# Complete:

A directly loaded canonical Nodus with no previously known incoming Graph Edge can bootstrap Root discovery from local predecessor hypotheses. When rated-Lichess Explorer evidence establishes a qualifying predecessor relationship, normal Knowledge Acquisition reconciles that edge, ordinary Evidence-backed Candidate selection can admit it, and the same current Nodus can refine to a non-empty authoritative Root/sibling projection without requiring prior navigation history.

If none of the bounded local predecessor hypotheses is supported by qualifying source evidence, the view may remain without Roots; no local-only predecessor is persisted, presented as historically real, or admitted as a Candidate.

The solution introduces no independent persistence, freshness, scheduler, currentness, or Candidate-eligibility ownership, and Root transposition enrichment continues to operate only on authoritative graph topology.

# Sync:

After any implementation or verification step that changes what remains, and before ending an implementation pass, synchronize this entry. Also synchronize when an action completes or becomes unavailable, a blocking condition changes, or a judgment is settled. Rewrite around the factual work and verification still open; do not accumulate progress history. If an outcome's completion condition is satisfied, run Backlog Close for that outcome. If Close cannot pass its normal gates, leave the entry open with the blocking condition explicit.
