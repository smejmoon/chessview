# PositionGraph

`PositionGraph` is Chessview's application-level boundary for durable [`ChartedGraph`](../components/charted-graph.md) edge access and mutation.

`ChartedGraph` owns the domain meaning of canonical positions, legal Move relationships, topology retention, and independent retention provenance. `PositionGraph` owns the technical boundary that validates those identities, coordinates invariant-preserving edge mutation, and persists the result.

## API

The current application-level API is deliberately small:

```js
positionGraph.outgoing(position)
positionGraph.incoming(position)
positionGraph.ensureEdge(edge, {
  manual: false,
  derived: false,
})
positionGraph.updateEdge(edge, {
  create: false,
})
```

`outgoing(position)` and `incoming(position)` canonicalize their position argument before reading durable edges.

## Edge normalization and identity

Before a write, `PositionGraph` canonicalizes the supplied source and target positions, resolves the supplied Move from the canonical source, and rejects the write when the supplied target does not match that legal move result.

The durable edge ID, SAN, and UCI are recomputed from the validated canonical relationship rather than trusted from caller-supplied values. This keeps one persisted identity for one legal `source + Move + target` relationship regardless of which workflow discovered it.

## Mutation semantics

`ensureEdge(edge, provenance)` ensures one durable edge exists for the supplied legal identity. For a new identity it persists the normalized edge. For an existing identity it preserves the stored mutable/statistical fields and adds any requested retention provenance without creating a duplicate.

The current persistence representation stores the two independent retention reasons as `manual` and `derived` booleans. `ensureEdge()` OR-adds those flags, so a later ensure cannot clear a reason that was already established.

`updateEdge(edge, { create })` replaces mutable fields for one validated legal identity while preserving canonical graph identity and already-established `manual` / `derived` provenance. It never establishes either retention reason from the update payload; provenance is added only through `ensureEdge()`. When `create` is false, an unknown identity remains unknown. When `create` is true, the caller may create the legal unknown edge; the caller owns that admission decision.

Neither operation can retarget an existing edge or withdraw established topology.

## Concurrency and persistence

Edge mutation is an atomic per-edge read/modify/write operation. `src/edge-store.ts::mutateEdge()` reads the current edge and applies one update inside the same IndexedDB `edges` transaction before committing the replacement value.

That coordination prevents concurrent edge mutations from independently replacing the same stored snapshot and lets provenance updates merge against the currently stored edge. It does **not** establish which source observation is newer. Explorer Reading identity, projection completion, and rejection of an older observation after a newer one are Knowledge Acquisition concerns rather than `PositionGraph` inference.

IndexedDB stores edges by durable edge ID and indexes them by canonical `source` and `target` for directional neighborhood reads. `src/edge-store.ts` is the typed low-level edge persistence adapter. Shared IndexedDB opening, schema creation, request wrapping, and transaction completion live in `src/indexed-db.ts`; they do not own graph identity, legality, admission policy, or provenance semantics.

The matching `.js` files are compatibility re-export shims so existing JavaScript callers can keep stable import paths during incremental TypeScript migration. `src/db.js` remains only a compatibility and test/maintenance surface, including whole-store reset. Application graph code does not use it as a mixed persistence API.

`PositionGraph` does not keep a second in-memory graph or graph-neighborhood cache. Durable edge reads are served by the persistence boundary.

## Boundaries

[`PositionRepository`](position-repository.md) owns canonical position records and their independently hydrated facets. It does not own edge identity or edge reconciliation.

[`Knowledge acquisition`](../components/knowledge-acquisition.md) decides whether an observed unknown relationship receives Edge Admission and which mutable statistical evidence is applied to known edges. `PositionGraph` validates and persists that decision but does not decide usefulness thresholds or source-observation ordering.

Move materialization owns the higher-level workflow that resolves an explicitly played Move, ensures the corresponding durable edge, and ensures the target position record exists. Transposition expansion owns which derived relationships should be materialized. Neither workflow redefines `PositionGraph` edge identity.

Constellation selection, Evidence, and current-view state consume graph knowledge but do not own this persistence boundary.

## Implementation

- `src/position-graph.js` implements the application boundary and its normalization, ensure, update, incoming, and outgoing operations.
- `src/graph.js::canonicalPosition()` provides canonical position identity.
- `src/graph.js::resolveMove()` provides legal source-position + Move resolution used to validate edge target and notation.
- `src/graph.js::edgeId()` computes durable edge identity from the normalized relationship.
- `src/edge-store.ts::mutateEdge()` provides typed atomic per-edge read/modify/write persistence.
- `src/edge-store.ts::getIncoming()` and `getOutgoing()` provide typed indexed directional edge reads.
- `src/indexed-db.ts` owns typed shared IndexedDB setup and transaction/request mechanics.
- `src/edge-store.js` and `src/indexed-db.js` are compatibility re-export shims for JavaScript callers.

## Verification

Deterministic tests should cover:

- incoming and outgoing reads canonicalizing their position argument;
- a legal new edge being normalized and persisted exactly once;
- a mismatched target being rejected;
- caller-supplied edge IDs or notation not overriding the validated canonical relationship;
- ensuring an existing edge preserving mutable/statistical fields while adding `manual` or `derived` provenance;
- manual and derived provenance coexisting on one edge;
- concurrent manual/derived ensures retaining both provenance flags;
- updating mutable fields without changing edge identity;
- an update preserving already-established provenance without establishing provenance supplied by the update payload;
- an update not creating an unknown edge unless the caller explicitly passes `create: true`;
- concurrent statistics refresh and provenance addition retaining both the refreshed state and established provenance;
- durable incoming/outgoing reads continuing to work from IndexedDB without a second graph cache.

Ordering between distinct Explorer Readings is verified at the Knowledge Acquisition projection boundary rather than inferred from storage transaction order.
