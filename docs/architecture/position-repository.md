# PositionRepository

`PositionRepository` is Chessview's application-level owner of canonical position records and generic lifetime/state for position-associated source channels.

The repository owns **state without source meaning**. Source providers own **meaning and policy without duplicating repository lifetime state**.

## Identity

One repository record is keyed by the [canonical position](../glossary.md#canonical-position) defined by [`ChartedGraph`](../components/charted-graph.md#nodes). `PositionRepository` consumes that identity; it does not maintain a second position-identity rule. A stored `fen` remains a playable six-field representation attached to that identity.

A [SourceChannel](../glossary.md#sourcechannel) is a named category of position-associated source observations, such as rated Explorer, Masters, or cloud evaluation. Its identity is `(canonical position, SourceChannel)`; the repository treats it as an opaque category key and does not interpret the observation's meaning.

Route-dependent source annotations are not canonical position-record fields. Different move orders can reach the same canonical position, so storing one route's annotation on that shared record would wrongly attribute it to every route.

An Explorer [OpeningLabel](../glossary.md#openinglabel) is source-supplied classification metadata in the observation's `opening` field, not canonical-position identity or proof of the user's route. It remains inside the Explorer observation rather than being mirrored to the top-level position record. The low-level position store also ignores legacy top-level `opening` fields so stale browser cache cannot reintroduce that false identity.

## Record lifetime

The repository keeps one in-memory persisted-record view per canonical key when it has been read or written during the current page lifetime. On a cache miss it reads the persisted node from IndexedDB. Writes update IndexedDB and the in-memory record together.

Application code that reads or writes position nodes goes through `PositionRepository`. `src/position-store.ts` is the typed low-level node persistence adapter. `src/cache-schema.ts` owns shared IndexedDB structural identities such as store names, key paths, indexes, and logical per-store schema versions; both schema setup and low-level adapters consume those identities rather than restating them. Shared IndexedDB opening, physical schema creation and validation, and request/transaction mechanics live in `src/indexed-db.ts`. Graph Edges remain independently persisted through [`PositionGraph`](position-graph.md), which owns Graph Edge identity and mutation rather than position-record hydration.

Position persistence is rebuildable browser cache. The `nodes` store has its own logical cache-schema version independent from Graph Edge persistence. A node-schema mismatch clears cached position records and stamps the current version rather than migrating old records. Physical IndexedDB layout changes use a new cache database epoch rather than converting an older cache in place.

`src/db.ts` is retained only as the typed test/maintenance surface, including whole-store reset. Application position code does not use it as a mixed node/edge persistence API.

## Live source channel state

A validated source observation may become usable before or independently of successful persistence. `PositionRepository` therefore owns one optional **live admitted value** for each `(position, source channel)` during the current application lifetime.

A live source channel entry contains the admitted value plus generic metadata supplied by the source provider, such as the observation timestamp and whether that exact admitted value has been persisted. This state exists so a usable source observation does not disappear merely because IndexedDB persistence failed.

The repository does not decide whether an observation deserves admission. The source provider parses and validates source data first, then admits the usable value. Likewise, the repository does not decide whether a retained value is fresh, stale-but-usable, authoritative absence, or should be refreshed. Those remain source-specific decisions.

Live source channel state is not a second durable cache. It is page-lifetime application state. Invalidating a SourceChannel may remove selected live values without changing unrelated source channels or Graph Edge topology.

## SourceChannel hydration and shared producer lifetime

Explorer, cloud evaluation, Masters, and future position-backed data are independently hydrated source channels. There is no whole-node freshness flag: each endpoint client keeps its own TTL, request parameters, parsing, validation, fallback, absence, and failure semantics.

Equivalent concurrent loads for one source channel and canonical key share one producer. Each caller participates with generic work demand: its own lifetime signal and urgency. One caller becoming obsolete detaches only that caller. The shared producer exposes the highest effective urgency among its live callers, so queued transport can promote or demote as callers join or leave without creating another producer. When the last caller detaches before the producer settles, the repository aborts the producer so cancellable downstream work can stop.

The shared producer receives a repository-owned work context rather than any caller's context. Its abort signal represents the lifetime of the coalesced producer, and its urgency is live aggregate state derived from current participants. This keeps producer lifetime independent of first-caller lifetime while preserving cancellation when nobody still needs the work.

Work demand is generic application coordination rather than a Lichess transport type. `PositionRepository` owns aggregation because coalescing happens here; it does not schedule HTTP requests. A source provider may forward the producer work context to a transport operation, while persistence and other useful completion work remain independent unless they explicitly consume that context.

This gives the repository one coherent responsibility around source channels:

- what live value is currently admitted for `(position, source channel)`;
- what persisted record fields currently exist for that position;
- what shared producer is currently establishing that source channel;
- which callers still participate in that producer;
- the producer's effective urgency;
- cancellation when no participant remains.

It does **not** give the repository source policy.

## One-way cache maintenance

Explorer cache clearing is a rare, terminal application operation followed by a page reload. The application first disposes Current View, then asks PositionRepository to **quiesce** source work before deleting Explorer cache fields. Quiescence is not ordinary refresh or a new current-view lifetime.

Quiescence refuses new source loads and position-record mutations, aborts shared source producers, and waits for every unsettled producer (including one whose last subscriber already detached) and already accepted position-record mutation to finish. Only after that drain may the Explorer provider invalidate its live Readings and the low-level position store clear selected or all Explorer fields. This prevents an already-started write from restoring cleared data. Quiescence is one-way for the page lifetime; failure to clear must not be presented as success, and recovery requires a reload. Other source-channel observations and durable Graph Edges are not targets of Explorer cache deletion.

## Source-provider boundary

Lichess-backed endpoint clients own endpoint meaning and source policy. They decide:

- request parameters and endpoint-specific parsing;
- whether returned data is valid and usable;
- freshness/TTL;
- stale fallback;
- successful absence versus failure;
- source-specific retry/recovery;
- which generic source channel metadata to attach when admitting a value.

Once a provider has established a usable observation, it uses `PositionRepository` to retain that live source channel value, coordinate equivalent acquisition, and persist position fields. Providers must not maintain a parallel `latest`/current-value map for the same position source channel.

`LichessGateway` owns application-wide serialization, cooldown, pre-send cancellation, and generic queued transport precedence. It does not own canonical-position identity, source-channel state, source channel freshness, shared parsed-result semantics, or the domain reason a caller is foreground or background.

## Graph boundary

Refreshable source channels are not `ChartedGraph` state. Clearing or replacing Explorer/Masters/evaluation cache data must not retract established Graph Edges.

Conversely, whether a source observation has been incorporated into graph topology is **not source-channel state**. Knowledge Acquisition and `PositionGraph` own reconciliation/convergence against graph state. `PositionRepository` must not turn graph-incorporation status into source-channel meaning.

`PositionGraph` separately owns durable Graph Edge access, legal edge normalization, and edge mutation coordination. Node-record hydration and Graph Edge mutation share canonical position identity but remain independent technical boundaries.

`ChartedGraph` owns durable topology. Source clients own source observations and source policy. `Evidence` interprets observations, and `Constellation` combines known Graph Edges with currently available evidence into current-view Candidates and visible relationships.

## Current-view boundary

Current-view/refinement coordination may participate in repository-owned source work with scoped cancellation and urgency, but it does not own shared producer lifetime. Leaving or replacing a current view detaches that participant; equivalent work may continue while another live participant remains.

The repository does not know current-view revision identity, structural versus supplementary demand, Weather, Constellation settlement, or whether a source result is still relevant to the active view.

## Verification

Deterministic tests should cover:

- in-memory persisted-record reuse before IndexedDB fallback;
- persisted updates remaining visible through the repository;
- live admitted source channel values surviving persistence failure;
- source channel invalidation remaining scoped to the selected source channel/positions;
- independently cancellable callers sharing one source channel load;
- effective shared urgency following the highest live caller demand;
- last-caller cancellation aborting the shared producer;
- replacement callers being able to start fresh work after a cancelled producer is detached;
- terminal maintenance stopping new loads and mutations, aborting and draining even detached producers, and waiting for already accepted writes before cache deletion;
- source-client freshness remaining independent per source channel;
- source-channel eviction leaving `ChartedGraph` topology unchanged;
- an incompatible node-cache schema clearing nodes without invalidating an independently compatible Graph Edge cache;
- source-supplied Explorer OpeningLabel metadata remaining source-local rather than becoming canonical position-record identity;
- legacy top-level `opening` fields being ignored at the persisted position-store boundary.
