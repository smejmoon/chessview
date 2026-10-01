# Do:

Finish the durable Graph Edge compatibility cleanup now that Explorer reconciliation is topology-only. Replace the legacy `manual` name with the settled explicit-materialization property while preserving its current navigation/Rail behavior, remove `derived` from the Graph Edge API and stored representation, and migrate existing IndexedDB edge records to canonical relationship fields plus explicit materialization only.

Keep current Explorer evidence and Candidate/Salience state outside persistence. `backlog/2026-10-01-constellation-selection-code-alignment.md` owns the remaining Line-composition protocol that still carries selection annotations on edge-shaped values; coordinate with that outcome rather than reintroducing a graph-level eligibility field here.

# Because:

`docs/components/charted-graph.md` defines a Graph Edge as one durable legal `source + Move + target` relationship plus only a durable behavioral property that changes product behavior. Explorer statistics, timestamps, eligibility, Salience, family/depth membership, and other current-view state are outside Graph Edge persistence.

`PositionGraph` now constructs a whitelisted durable relationship value instead of spreading caller objects into storage. New or subsequently mutated edges therefore cannot persist `games`, `share`, `qualifies`, `updatedAt`, or other arbitrary caller fields; mutation also scrubs those legacy fields from an edge it rewrites.

Knowledge Acquisition now reads existing outgoing topology, calls `ensureEdge()` only for admitted missing relationships, and leaves already-known Graph Edges unmodified while still ensuring their target position records. This makes repeated reconciliation converge against actual graph state and keeps partial target-record failure retryable without an Explorer projection revision/watermark protocol.

Explicit Move materialization supplies topology-only edge input. Transposition discovery is now a typed topology-only implementation and no longer manufactures Explorer fields or establishes `derived: true`. Current production behavior still consumes the explicit/manual distinction in Constellation and Rail paths, while investigation and passing tests have identified no independent product behavior that consumes `derived`.

`src/transpositions.ts` and `src/constellation-selection.ts` now hold the implementations behind stable `.js` compatibility re-exports. The latter conversion is mechanical: it intentionally preserves the existing Candidate behavior until the separate Constellation-selection alignment outcome removes its legacy edge-shaped selection annotations.

Current deterministic tests pass without relying on Graph Edge statistics being refreshed from Explorer Readings, confirming that current source evidence can remain on the Explorer/Evidence path while ChartedGraph retains topology.

# Edges:

`docs/components/charted-graph.md` owns durable Graph Edge semantics.

`docs/components/knowledge-acquisition.md` owns Edge Admission and reconciliation of graph-bearing observations into missing topology. Explorer/source clients continue to own source observations and cache freshness; `PositionRepository` supplies generic facet storage/load coordination.

`docs/components/constellation.md`, `docs/components/constellation-selection.md`, and `docs/components/evidence.md` own current evidence, Candidate selection state, and visible relationships. `backlog/2026-10-01-constellation-selection-code-alignment.md` separately owns removing the legacy `edge.qualifies`/edge-shaped selection protocol from Line composition.

`docs/architecture/position-graph.md` owns the application-level Graph Edge boundary and persistence mechanics. `docs/architecture/position-repository.md` owns canonical position records and source-facet infrastructure separately.

# Complete:

Graph Edge persistence contains only canonical legal relationship state plus the explicitly justified explicit-materialization property; existing legacy edge records are normalized without losing that behavior, and `derived`/Explorer/current-view fields are absent from the durable representation.

Explorer reconciliation establishes missing admitted topology, performs no Graph Edge rewrite for already-known relationships, and remains retryable for missing relationships or target records after partial persistence failure without an observation revision/projection watermark protocol.

Constellation selection carries current evidence and selection annotations outside durable Graph Edge state, with its remaining edge-shaped selection compatibility removed under the dedicated Constellation-selection alignment outcome.

# Sync:

After any implementation or verification step that changes what remains, and before ending an implementation pass, synchronize this entry. Also synchronize when an action completes or becomes unavailable, a blocking condition changes, or a judgment is settled. Rewrite around the factual work and verification still open; do not accumulate progress history. If an outcome's completion condition is satisfied, run Backlog Close for that outcome. If Close cannot pass its normal gates, leave the entry open with the blocking condition explicit.
