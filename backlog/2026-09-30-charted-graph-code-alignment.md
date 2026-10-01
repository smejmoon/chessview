# Do:

Align the remaining implementation with the settled `ChartedGraph` model: Graph Edges are durable topology, not containers for mutable Explorer evidence or current-view selection state. Remove `PositionGraph.updateEdge()`-driven Explorer refresh, constrain Graph Edge persistence to canonical relationship state plus any justified durable behavioral property, and stop using Graph Edge objects as containers for Candidate/Salience annotations where the owning Constellation layer can carry that state separately.

Review the remaining `manual` / `derived` representation against the settled contract. Preserve the explicit-materialization behavior currently carried by `manual` under a clearer durable name if needed; remove `derived` if no product behavior depends on that distinction.

# Because:

`docs/components/charted-graph.md` defines a Graph Edge as one durable legal `source + Move + target` relationship. Mutable Explorer statistics, source-observation versions, eligibility, Salience, family/depth membership, and other current-view state are outside Graph Edge persistence.

Explicit Move materialization now supplies only topology fields to `PositionGraph.ensureEdge()` instead of manufacturing zero-valued Explorer games/share/eligibility/timestamps, and its regression verifies newly materialized edges do not gain those fields. Existing graph and acquisition paths can still persist or carry mutable evidence, so the broader boundary is not yet aligned.

`docs/components/knowledge-acquisition.md` limits Explorer reconciliation to graph growth: resolve returned moves, admit unknown legal relationships under acquisition policy, and establish missing topology. Already-known relationships require no graph rewrite merely because another Reading contains the same Move. Current `knowledge-acquisition.ts` still constructs evidence-bearing edge objects and calls `PositionGraph.updateEdge()` for reconciliation.

`docs/components/constellation.md` and `docs/components/constellation-selection.md` define a Candidate as a known Graph Edge combined with current evidence and current-view selection state. The implementation still decorates edge-shaped objects with `games`, `share`, `qualifies`, and `salienceOrder`, so code has not yet caught up with the ownership split.

`docs/architecture/position-graph.md` specifies a topology-oriented boundary. The current `PositionGraph.updateEdge()`, open-ended stored edge shape, and `manual` / `derived` surface remain compatibility implementation that must be aligned rather than treated as durable requirements.

# Edges:

`docs/components/charted-graph.md` owns durable Graph Edge semantics.

`docs/components/knowledge-acquisition.md` owns Edge Admission and reconciliation of graph-bearing observations into missing topology. Explorer/source clients continue to own source observations and cache freshness; `PositionRepository` supplies generic facet storage/load coordination.

`docs/components/constellation.md`, `docs/components/constellation-selection.md`, and `docs/components/evidence.md` own current evidence, Candidate selection state, and visible relationships. `backlog/2026-10-01-constellation-selection-code-alignment.md` separately owns removing the legacy `edge.qualifies` gate from Line composition; this outcome should not create a competing eligibility protocol while moving current-view state off Graph Edges.

`docs/architecture/position-graph.md` owns the application-level Graph Edge boundary and persistence mechanics. `docs/architecture/position-repository.md` owns canonical position records and source-facet infrastructure separately.

# Unsettled:

Whether the existing `manual` flag should survive under a clearer explicit-materialization name. Current Constellation and Rail behavior uses that distinction, so deleting it outright would change product behavior.

Whether any product behavior depends on `derived` as durable state rather than simply on the existence of the Graph Edge. Current investigation found transposition code writes it but no independent product consumer has yet justified retaining it.

Whether any real consumer still depends on persisted `edge.games`, `edge.share`, `edge.updatedAt`, or `edge.qualifies` after current Explorer evidence is joined at the Evidence/Constellation boundary. Any such dependency must either move to the owning layer or be justified as a distinct durable graph requirement.

How existing IndexedDB Graph Edge records containing legacy evidence/provenance fields should be normalized when the stored edge shape is tightened, including preservation of the explicit-materialization behavior represented today by `manual`.

# Complete:

Graph Edge persistence contains only canonical legal relationship state plus any explicitly justified durable behavioral property; mutable Explorer statistics and current-view Candidate/Salience annotations are no longer persisted as graph state.

Explorer reconciliation establishes missing admitted topology, is naturally idempotent for already-known relationships, and remains retryable for missing relationships after partial persistence failure without an observation revision/projection watermark protocol.

Constellation selection carries current evidence and selection annotations outside Graph Edge state, and tests verify that source-evidence eviction or refresh can change current evidence without mutating established `ChartedGraph` topology.

# Sync:

After any implementation or verification step that changes what remains, and before ending an implementation pass, synchronize this entry. Also synchronize when an action completes or becomes unavailable, a blocking condition changes, or a judgment is settled. Rewrite around the factual work and verification still open; do not accumulate progress history. If an outcome's completion condition is satisfied, run Backlog Close for that outcome. If Close cannot pass its normal gates, leave the entry open with the blocking condition explicit.
