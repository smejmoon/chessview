# PositionRepository

`PositionRepository` is Chessview's application-level owner of canonical position records and generic lifetime/state for position-associated source facets.

The repository owns **shared state and generic caching without source meaning**. Source clients supply the input needed to use [Position cache](position-cache.md); [Data stability](../components/data-stability.md) guides refresh assumptions.

## Identity

One repository record is keyed by the [canonical position](../glossary.md#canonical-position) defined by [`ChartedGraph`](../components/charted-graph.md#nodes). `PositionRepository` consumes that identity; it does not maintain a second position-identity rule. A stored `fen` remains a playable six-field representation attached to that identity.

A source facet is identified by `(canonical position, facet)`, for example rated Explorer, Masters, or cloud evaluation. Facet identity is generic repository infrastructure; the repository does not interpret what the facet value means.

Route-dependent source annotations are not canonical position-record fields. In particular, an Explorer `opening` label remains inside the Explorer observation; it must not be mirrored to the top-level position record because one canonical position may be reached through multiple opening histories. The low-level position store also ignores legacy top-level `opening` fields so stale browser cache cannot reintroduce that false identity.

## Record lifetime

The repository keeps one in-memory persisted-record view per canonical key when it has been read or written during the current page lifetime. On a cache miss it reads the persisted node from IndexedDB. Writes update IndexedDB and the in-memory record together.

Application code that reads or writes position nodes goes through `PositionRepository`. `src/position-store.ts` is the typed low-level node persistence adapter. `src/cache-schema.ts` owns shared IndexedDB structural identities such as store names, key paths, indexes, and logical per-store schema versions; both schema setup and low-level adapters consume those identities rather than restating them. Shared IndexedDB opening, physical schema creation and validation, and request/transaction mechanics live in `src/indexed-db.ts`. Graph Edges remain independently persisted through [`PositionGraph`](position-graph.md), which owns Graph Edge identity and mutation rather than position-record hydration.

Position persistence is rebuildable browser cache. The `nodes` store has its own logical cache-schema version independent from Graph Edge persistence. A node-schema mismatch clears cached position records and stamps the current version rather than migrating old records. Physical IndexedDB layout changes use a new cache database epoch rather than converting an older cache in place.

`src/db.ts` is retained only as the typed test/maintenance surface, including whole-store reset. Application position code does not use it as a mixed node/edge persistence API.

## Live facet state

A validated source observation may become usable before or independently of successful persistence. `PositionRepository` therefore owns one optional **live admitted value** for each `(position, facet)` during the current application lifetime.

A live facet entry contains the admitted value plus generic metadata supplied by the source provider, such as the observation timestamp and whether that exact admitted value has been persisted. This state exists so a usable source observation does not disappear merely because IndexedDB persistence failed.

The source provider parses and validates observations and supplies source-specific admission and refresh conditions. The repository applies [Position cache](position-cache.md) to select retained values, decide when refresh is due, and coordinate background acquisition. It does not derive chess meaning from those observations.

Live facet state is not a second durable cache. It is page-lifetime application state. Ordinary external node-store writes invalidate hydrated persisted-record views, but do not discard unpersisted live observations from unrelated facets. Explicit whole-store reset clears both; targeted facet maintenance may remove selected live values without changing unrelated facets or Graph Edge topology.

## Facet hydration and shared producer lifetime

Explorer, cloud evaluation, Masters, and future position-backed data remain independently hydrated facets, with no whole-node freshness flag. Source clients supply requests, validation, and meaningful absence; [Position cache](position-cache.md) owns the generic refresh, fallback, and persistence behavior.

Equivalent concurrent loads for one facet and canonical key share one producer. Each caller participates with generic work demand: its own lifetime signal and urgency. One caller becoming obsolete detaches only that caller. The shared producer exposes the highest effective urgency among its live callers, so queued transport can promote or demote as callers join or leave without creating another producer. When the last caller detaches before the producer settles, the repository aborts the producer so cancellable downstream work can stop.

The shared producer receives a repository-owned work context rather than any caller's context. Its abort signal represents the lifetime of the coalesced producer, and its urgency is live aggregate state derived from current participants. This keeps producer lifetime independent of first-caller lifetime while preserving cancellation when nobody still needs the work.

Work demand is generic application coordination rather than a Lichess transport type. `PositionRepository` owns aggregation because coalescing happens here; it does not schedule HTTP requests. A source provider may forward the producer work context to a transport operation, while persistence and other useful completion work remain independent unless they explicitly consume that context.

This gives the repository one coherent responsibility around source facets:

- what live value is currently admitted for `(position, facet)`;
- what persisted record fields currently exist for that position;
- what shared producer is currently establishing that facet;
- which callers still participate in that producer;
- the producer's effective urgency;
- cancellation when no participant remains.

It does **not** give the repository source policy.

## Source-provider boundary

Lichess-backed endpoint clients own endpoint meaning and acquisition: request parameters, response parsing, source validity and quality, and interpretation of endpoint-specific absence and failure. They supply cache identity and stability-driven refresh inputs rather than duplicating generic caching.

`PositionRepository` executes the [Position cache](position-cache.md) contract: matching and returning retained observations, age-based refresh, live and persistent values, shared producer coordination, and diagnostics for cache faults. This does not make it a Lichess client or interpreter of chess evidence.

`LichessGateway` owns HTTP serialization, cooldown, and transport request precedence. It does not own cache freshness, canonical-position identity, or current-view structural demand.

## Graph boundary

Refreshable source facets are not `ChartedGraph` state. Clearing or replacing Explorer/Masters/evaluation cache data must not retract established Graph Edges.

Conversely, whether a source observation has been incorporated into graph topology is **not source-facet state**. Knowledge Acquisition and `PositionGraph` own reconciliation/convergence against graph state. `PositionRepository` must not turn graph-incorporation status into source-facet meaning.

`PositionGraph` separately owns durable Graph Edge access, legal edge normalization, and edge mutation coordination. Node-record hydration and Graph Edge mutation share canonical position identity but remain independent technical boundaries.

`ChartedGraph` owns durable topology. Source clients own source observations and source policy. `Evidence` interprets observations, and `Constellation` combines known Graph Edges with currently available evidence into current-view Candidates and visible relationships.

## Current-view boundary

Current-view/refinement coordination may participate in repository-owned source work with scoped cancellation and urgency, but it does not own shared producer lifetime. Leaving or replacing a current view detaches that participant; equivalent work may continue while another live participant remains.

The repository does not know current-view revision identity, structural versus supplementary demand, Weather, Constellation settlement, or whether a source result is still relevant to the active view.

## Verification

Deterministic tests should cover:

- in-memory persisted-record reuse before IndexedDB fallback;
- persisted updates remaining visible through the repository;
- live admitted facet values surviving persistence failure;
- facet invalidation remaining scoped to the selected facet/positions;
- independently cancellable callers sharing one facet load;
- effective shared urgency following the highest live caller demand;
- last-caller cancellation aborting the shared producer;
- replacement callers being able to start fresh work after a cancelled producer is detached;
- source-client freshness remaining independent per facet;
- source-facet eviction leaving `ChartedGraph` topology unchanged;
- an incompatible node-cache schema clearing nodes without invalidating an independently compatible Graph Edge cache;
- route-dependent Explorer opening metadata remaining source-local rather than becoming canonical position-record identity;
- legacy top-level opening labels being ignored at the persisted position-store boundary.
