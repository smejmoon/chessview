# PositionRepository

`PositionRepository` is Chessview's application-level owner of canonical position records and generic lifetime/state for position-associated source facets.

The repository owns **state without source meaning**. Source providers own **meaning and policy without duplicating repository lifetime state**.

## Identity

One repository record is keyed by the [canonical position](../glossary.md#canonical-position) defined by [`ChartedGraph`](../components/charted-graph.md#nodes). `PositionRepository` consumes that identity; it does not maintain a second position-identity rule. A stored `fen` remains a playable six-field representation attached to that identity.

A source facet is identified by `(canonical position, facet)`, for example rated Explorer, Masters, or cloud evaluation. Facet identity is generic repository infrastructure; the repository does not interpret what the facet value means.

## Record lifetime

The repository keeps one in-memory persisted-record view per canonical key when it has been read or written during the current page lifetime. On a cache miss it reads the persisted node from IndexedDB. Writes update IndexedDB and the in-memory record together.

Application code that reads or writes position nodes goes through `PositionRepository`. `src/position-store.ts` is the typed low-level node persistence adapter. `src/cache-schema.ts` owns shared IndexedDB structural identities such as store names, key paths, indexes, and logical per-store schema versions; both schema setup and low-level adapters consume those identities rather than restating them. Shared IndexedDB opening, physical schema creation and validation, and request/transaction mechanics live in `src/indexed-db.ts`. Graph Edges remain independently persisted through [`PositionGraph`](position-graph.md), which owns Graph Edge identity and mutation rather than position-record hydration.

Position persistence is rebuildable browser cache. The `nodes` store has its own logical cache-schema version independent from Graph Edge persistence. A node-schema mismatch clears cached position records and stamps the current version rather than migrating old records. Physical IndexedDB layout changes use a new cache database epoch rather than converting an older cache in place.

`src/position-store.js`, `src/indexed-db.js`, and `src/db.js` are compatibility re-export shims for JavaScript callers during incremental TypeScript migration. `src/db.ts` is retained only as the typed test/maintenance surface, including whole-store reset. Application position code does not use it as a mixed node/edge persistence API.

## Live facet state

A validated source observation may become usable before or independently of successful persistence. `PositionRepository` therefore owns one optional **live admitted value** for each `(position, facet)` during the current application lifetime.

A live facet entry contains the admitted value plus generic metadata supplied by the source provider, such as the observation timestamp and whether that exact admitted value has been persisted. This state exists so a usable source observation does not disappear merely because IndexedDB persistence failed.

The repository does not decide whether an observation deserves admission. The source provider parses and validates source data first, then admits the usable value. Likewise, the repository does not decide whether a retained value is fresh, stale-but-usable, authoritative absence, or should be refreshed. Those remain source-specific decisions.

Live facet state is not a second durable cache. It is page-lifetime application state. Facet invalidation may remove selected live values without changing unrelated facets or Graph Edge topology.

## Facet hydration and shared producer lifetime

Explorer, cloud evaluation, Masters, and future position-backed data are independently hydrated facets. There is no whole-node freshness flag: each endpoint client keeps its own TTL, request parameters, parsing, validation, fallback, absence, and failure semantics.

Equivalent concurrent loads for one facet and canonical key share one producer. Each caller participates with its own `AbortSignal` and transport urgency. One caller becoming obsolete detaches only that caller. The shared producer exposes the highest effective urgency among its live callers, so a queued request can promote or demote as callers join or leave without creating another producer. When the last caller detaches before the producer settles, the repository aborts the producer so queued work can be rejected before it reaches Lichess.

The shared producer receives an internal abort signal owned by the repository rather than any caller's signal. This keeps producer lifetime independent of first-caller lifetime while preserving cancellation when nobody still needs the work.

This gives the repository one coherent responsibility around source facets:

- what live value is currently admitted for `(position, facet)`;
- what persisted record fields currently exist for that position;
- what shared producer is currently establishing that facet;
- which callers still participate in that producer;
- the producer's effective urgency;
- cancellation when no participant remains.

It does **not** give the repository source policy.

## Source-provider boundary

Lichess-backed endpoint clients own endpoint meaning and source policy. They decide:

- request parameters and endpoint-specific parsing;
- whether returned data is valid and usable;
- freshness/TTL;
- stale fallback;
- successful absence versus failure;
- source-specific retry/recovery;
- which generic facet metadata to attach when admitting a value.

Once a provider has established a usable observation, it uses `PositionRepository` to retain that live facet value, coordinate equivalent acquisition, and persist position fields. Providers must not maintain a parallel `latest`/current-value map for the same position facet.

`LichessGateway` owns application-wide serialization, cooldown, pre-send cancellation, and generic queued transport precedence. It does not own canonical-position identity, source-facet state, facet freshness, shared parsed-result semantics, or the domain reason a caller is foreground or background.

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
- an incompatible node-cache schema clearing nodes without invalidating an independently compatible Graph Edge cache.
