# Do:

Align implementation with the settled `ChartedGraph` model: Graph Edges are durable topology, not containers for mutable Explorer evidence or current-view selection state. Remove code paths that rewrite existing Graph Edges only to refresh Explorer games/share/timestamps, and stop using Graph Edge objects as containers for Candidate/Salience annotations where the owning Constellation layer can carry that state separately.

Review the remaining `manual` / `derived` representation against the settled contract. Preserve an explicit-materialization distinction only where current product behavior needs it; remove or rename provenance fields that no longer carry an independent product meaning.

# Because:

`docs/components/charted-graph.md` now defines a Graph Edge as one durable legal `source + Move + target` relationship. Mutable Explorer statistics, source-observation versions, eligibility, Salience, family/depth membership, and other current-view state are outside Graph Edge persistence.

`docs/components/knowledge-acquisition.md` now limits Explorer reconciliation to graph growth: resolve returned moves, admit unknown legal relationships under acquisition policy, and establish missing topology. Already-known relationships require no graph rewrite merely because another Reading contains the same Move. Reconciliation therefore converges against actual graph state and does not need durable Explorer projection revisions or source-order bookkeeping.

`docs/components/constellation.md` and `docs/components/constellation-selection.md` define a Candidate as a known Graph Edge combined with current evidence and current-view selection state. The implementation still decorates edge-shaped objects with `games`, `share`, `qualifies`, and `salienceOrder`, so code has not yet caught up with the ownership split.

`docs/architecture/position-graph.md` now specifies a topology-oriented boundary. The current `PositionGraph.updateEdge()` and `manual` / `derived` surface remain compatibility implementation that must be reviewed against that contract rather than treated as durable requirements.

# Edges:

`docs/components/charted-graph.md` owns durable Graph Edge semantics.

`docs/components/knowledge-acquisition.md` owns Edge Admission and reconciliation of graph-bearing observations into missing topology. Explorer/source clients continue to own source observations and cache freshness; `PositionRepository` supplies generic facet storage/load coordination.

`docs/components/constellation.md`, `docs/components/constellation-selection.md`, and `docs/components/evidence.md` own current evidence, Candidate selection state, and visible relationships. Implementation changes should move ephemeral state toward those owners rather than inventing a second persistent projection protocol.

`docs/architecture/position-graph.md` owns the application-level Graph Edge boundary and persistence mechanics. `docs/architecture/position-repository.md` owns canonical position records and source-facet infrastructure separately.

# Unsettled:

Whether the existing `manual` flag should survive under a clearer explicit-materialization name, and whether any current product behavior still depends on `derived` as durable state rather than simply on the existence of the Graph Edge.

Whether any real consumer still depends on persisted `edge.games`, `edge.share`, `edge.updatedAt`, or `edge.qualifies` after current Explorer evidence is joined at the Evidence/Constellation boundary. Any such dependency must either move to the owning layer or be justified as a distinct durable graph requirement.

# Complete:

Graph Edge persistence contains only canonical legal relationship state plus any explicitly justified durable behavioral property; mutable Explorer statistics and current-view Candidate/Salience annotations are no longer persisted as graph state.

Explorer reconciliation establishes missing admitted topology, is naturally idempotent for already-known relationships, and remains retryable for missing relationships after partial persistence failure without an observation revision/projection watermark protocol.

Constellation selection carries current evidence and selection annotations outside Graph Edge state, and tests verify that source-evidence eviction or refresh can change current evidence without mutating established `ChartedGraph` topology.

# Sync:

After any implementation or verification step that changes what remains, and before ending an implementation pass, synchronize this entry. Also synchronize when an action completes or becomes unavailable, a blocking condition changes, or a judgment is settled. Rewrite around the factual work and verification still open; do not accumulate progress history. If an outcome's completion condition is satisfied, run Backlog Close for that outcome. If Close cannot pass its normal gates, leave the entry open with the blocking condition explicit.
