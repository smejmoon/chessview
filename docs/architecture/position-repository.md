# PositionRepository

`PositionRepository` is Chessview's application-level owner of canonical position records and generic infrastructure for position-associated data facets.

## Identity

One repository record is keyed by the [canonical position](../glossary.md#canonical-position) defined by [`ChartedGraph`](../components/charted-graph.md#nodes). `PositionRepository` consumes that identity; it does not maintain a second position-identity rule. A stored `fen` remains a playable six-field representation attached to that identity.

## Record lifetime

The repository keeps one in-memory record per canonical key when it has been read or written during the current page lifetime. On a cache miss it reads the persisted node from IndexedDB. Writes update IndexedDB and the in-memory record together.

Application code that reads or writes position nodes goes through `PositionRepository`. `src/position-store.ts` is the typed low-level node persistence adapter. `src/cache-schema.ts` owns shared IndexedDB structural identities such as store names, key paths, indexes, and logical per-store schema versions; both schema setup and low-level adapters consume those identities rather than restating them. Shared IndexedDB opening, physical schema creation and validation, and request/transaction mechanics live in `src/indexed-db.ts`. Graph Edges remain independently persisted through [`PositionGraph`](position-graph.md), which owns Graph Edge identity and mutation rather than position-record hydration.

Position persistence is rebuildable browser cache. The `nodes` store has its own logical cache-schema version independent from Graph Edge persistence. A node-schema mismatch clears cached position records and stamps the current version rather than migrating old records. Physical IndexedDB layout changes use a new cache database epoch rather than converting an older cache in place.

`src/position-store.js`, `src/indexed-db.js`, and `src/db.js` are compatibility re-export shims for JavaScript callers during incremental TypeScript migration. `src/db.ts` is retained only as the typed test/maintenance surface, including whole-store reset. Application position code does not use it as a mixed node/edge persistence API.

## Facet hydration

Explorer, cloud evaluation, Masters, and future position-backed data are independently hydrated facets of a position record. There is no whole-node freshness flag: each endpoint client keeps its own TTL, request parameters, parsing, failure semantics, and persisted fields.

`PositionRepository` does not interpret facet meaning. For example, it may persist an Explorer Reading and `explorerFetchedAt`, but the Explorer client decides whether that Reading is fresh, stale-but-usable, absent, or should be replaced. Evidence and Constellation decide how usable source observations affect chess interpretation and the current view.

Equivalent concurrent loads for one facet and canonical key share one producer. Each caller participates with its own `AbortSignal` and transport urgency. One caller becoming obsolete detaches only that caller. The shared producer exposes the highest effective urgency among its live callers, so a queued request can promote or demote as callers join or leave without creating another producer. When the last caller detaches before the producer settles, the repository aborts the producer so queued work can be rejected before it reaches Lichess.

The shared producer receives an internal abort signal owned by the repository rather than any caller's signal. This keeps producer lifetime independent of first-caller lifetime while preserving cancellation when nobody still needs the work.

Refreshable source facets are not `ChartedGraph` state. Clearing or replacing Explorer/Masters/evaluation cache data must not retract established Graph Edges. Conversely, `PositionRepository` does not record whether one source observation has been projected into graph state; Knowledge Acquisition converges graph reconciliation against actual `ChartedGraph` state instead of using a repository-side projection watermark.

## Boundaries

`NodusController` owns current-view obsolescence and publication. It supplies scoped cancellation but does not own shared request lifetime or expose revision identity to the repository.

Lichess-backed endpoint clients own endpoint meaning and call `PositionRepository` to coordinate shared per-position work and persistence. They continue to call `LichessGateway` for application-issued HTTP requests.

`LichessGateway` owns application-wide serialization, cooldown, pre-send cancellation, and generic queued transport precedence. It does not own canonical-position identity, endpoint caches, facet freshness, shared parsed-result semantics, or the domain reason a caller is foreground or background.

`PositionGraph` separately owns durable Graph Edge access, legal edge normalization, and edge mutation coordination. Node-record hydration and Graph Edge mutation share canonical position identity but remain independent technical boundaries.

`ChartedGraph` owns durable topology. `Explorer` and other source clients own source observations. `Evidence` interprets those observations, and `Constellation` combines known Graph Edges with currently available evidence into current-view Candidates and visible relationships. `PositionRepository` supplies shared storage/loading mechanics to those source clients without absorbing their domain policy.

## Verification

Deterministic tests should cover in-memory reuse before IndexedDB fallback, persisted updates remaining visible through the repository, independently cancellable callers sharing one facet load, effective shared urgency following the highest live caller demand, last-caller cancellation aborting the shared producer, replacement callers being able to start fresh work after a cancelled producer is detached, source-client freshness remaining independent per facet, source-facet eviction leaving `ChartedGraph` topology unchanged, and an incompatible node-cache schema clearing nodes without invalidating an independently compatible Graph Edge cache.
