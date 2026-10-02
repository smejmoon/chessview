# PositionGraph

`PositionGraph` is Chessview's application-level boundary for durable [`ChartedGraph`](../components/charted-graph.md) Graph Edge access and mutation.

`ChartedGraph` owns the domain meaning of canonical positions, legal Move relationships, topology retention, and any durable relationship property whose value changes product behavior. `PositionGraph` owns the technical boundary that validates those identities, coordinates invariant-preserving Graph Edge mutation, and persists the result.

## API

The application-level API is deliberately small and topology-oriented:

```js
positionGraph.outgoing(position)
positionGraph.incoming(position)
positionGraph.ensureEdge(edge, {
  explicit: false,
})
```

Mutable Explorer evidence is not updated through `PositionGraph`. There is no Graph Edge refresh/update operation distinct from ensuring a durable relationship.

`outgoing(position)` and `incoming(position)` canonicalize their position argument before reading durable Graph Edges.

## Edge normalization and identity

Before a write, `PositionGraph` canonicalizes the supplied source and target positions, resolves the supplied Move from the canonical source, and rejects the write when the supplied target does not match that legal move result.

The durable edge ID, SAN, and UCI are recomputed from the validated canonical relationship rather than trusted from caller-supplied values. This keeps one persisted identity for one legal `source + Move + target` relationship regardless of which workflow discovered it.

## Mutation semantics

`ensureEdge(edge, options)` ensures one durable Graph Edge exists for the supplied legal identity. For a new identity it persists the normalized relationship. For an existing identity it preserves that relationship and may add the durable `explicit` materialization property used when product behavior needs that distinction.

Ordinary source reconciliation does not rewrite an existing Graph Edge merely because another Explorer Reading contains the same Move. Explorer game counts, move share, timestamps, source revisions, eligibility, Salience, and other source/current-view fields are not Graph Edge mutation concerns.

Neither source refresh nor `ensureEdge()` can retarget an existing Graph Edge or withdraw established topology.

## Concurrency and persistence

Edge mutation is an atomic per-edge read/modify/write operation. `src/edge-store.ts::mutateEdge()` reads the current edge and applies one update inside the same IndexedDB `edges` transaction before committing the replacement value.

That coordination prevents concurrent Graph Edge establishment from creating competing stored snapshots and allows explicit materialization to merge with an already-established relationship.

IndexedDB stores edges by durable edge ID and indexes them by canonical `source` and `target` for directional neighborhood reads. The stored edge shape is canonical relationship state — `id`, `source`, `target`, `uci`, and `san` — plus optional `explicit` materialization. `src/edge-store.ts` is the typed low-level edge persistence adapter. Shared IndexedDB opening, schema creation, migration, request wrapping, and transaction completion live in `src/indexed-db.ts`; they do not own graph identity, legality, admission policy, source evidence, or Constellation state.

IndexedDB schema version 2 migrates version-1 edge records in place. Legacy `manual: true` becomes `explicit: true`; `derived`, Explorer statistics/timestamps, eligibility, and arbitrary legacy edge fields are dropped. This preserves the only durable behavioral distinction while normalizing existing installations to the current Graph Edge shape.

The matching `.js` files are compatibility re-export shims so existing JavaScript callers can keep stable import paths during incremental TypeScript migration. `src/db.js` remains only a compatibility and test/maintenance surface, including whole-store reset. Application graph code does not use it as a mixed persistence API.

`PositionGraph` does not keep a second in-memory graph or graph-neighborhood cache. Durable Graph Edge reads are served by the persistence boundary.

## Boundaries

[`PositionRepository`](position-repository.md) owns canonical position records and their independently hydrated facets. It does not own Graph Edge identity or graph reconciliation.

[`Knowledge acquisition`](../components/knowledge-acquisition.md) decides whether an observed unknown relationship receives Edge Admission. For an already-known relationship, current Explorer evidence remains in the source/evidence path rather than being written through `PositionGraph`.

Move materialization owns the higher-level workflow that resolves an explicitly played Move, ensures the corresponding durable Graph Edge, and ensures the target position record exists. Transposition expansion owns which legal relationships should be established from transposition knowledge. Neither workflow redefines `PositionGraph` edge identity.

Constellation selection, Evidence, and current-view state consume Graph Edges but keep their current evidence and annotations outside this persistence boundary.

## Implementation

- `src/position-graph.ts` implements the application boundary and its normalization, ensure, incoming, and outgoing operations. It exposes only the durable `explicit` materialization option beyond canonical relationship identity.
- `src/graph.js::canonicalPosition()` provides canonical position identity.
- `src/graph.js::resolveMove()` provides legal source-position + Move resolution used to validate edge target and notation.
- `src/graph.js::edgeId()` computes durable Graph Edge identity from the normalized relationship.
- `src/edge-store.ts::mutateEdge()` provides typed atomic per-edge read/modify/write persistence over the canonical stored edge shape.
- `src/edge-store.ts::getIncoming()` and `getOutgoing()` provide typed indexed directional edge reads.
- `src/indexed-db.ts` owns typed shared IndexedDB setup, the v1-to-v2 edge migration, and transaction/request mechanics.
- `src/edge-store.js` and `src/indexed-db.js` are compatibility re-export shims for JavaScript callers.

## Verification

Deterministic tests should cover:

- incoming and outgoing reads canonicalizing their position argument;
- a legal new Graph Edge being normalized and persisted exactly once;
- a mismatched target being rejected;
- caller-supplied edge IDs or notation not overriding the validated canonical relationship;
- ensuring an existing Graph Edge not rewriting Explorer statistics or current-view state;
- explicit materialization being retained when the same relationship is also learned automatically;
- concurrent establishment retaining one canonical relationship and any durable explicit property;
- the v1-to-v2 migration preserving legacy explicit/manual materialization while removing `derived`, Explorer evidence, and current-view fields;
- an ensure not retargeting or deleting established topology;
- durable incoming/outgoing reads continuing to work from IndexedDB without a second graph cache.

Explorer freshness, statistics, and source-observation lifetime are verified through their source client, Evidence, and Knowledge Acquisition boundaries rather than through Graph Edge mutation ordering.
