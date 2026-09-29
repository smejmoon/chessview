# Position graph

## Purpose

Own Chessview's durable chess-state model: what a node means, what an edge means, and how equivalent positions merge.

Terminology follows the [Chessview glossary](../glossary.md), especially [Move](../glossary.md#move), [Resolve Move](../glossary.md#resolve-move), [graph edge](../glossary.md#graph-edge), and [materialize a move](../glossary.md#materialize-a-move).

Chess rules define one fixed graph of legal canonical positions and Moves. Chessview does not attempt to persist that entire graph; `PositionGraph` owns the monotonically discovered durable subset that Chessview has learned so far.

`PositionGraph` is the application-level boundary for durable graph-edge access and mutation. It owns edge identity and mutation invariants. It does not own position-record hydration, Lichess/Explorer behavior, evidence meaning, Constellation selection, or current-view state.

## Requirements

- A graph node is one canonical chess position.
- Every graph edge represents exactly one legal move from its source position to its target position.
- Canonical identity includes pieces, side to move, castling rights, and only en-passant state that can affect future legal play.
- Halfmove and fullmove counters do not participate in position identity.
- Positions reached by different move orders merge into the same node.
- Incoming edges provide Root context; outgoing edges provide Line context.
- Resolving a Move is the pure directional operation `source + Move -> canonical target + target FEN + SAN/UCI`. The same operation may produce an outgoing Line relationship or validate that a known incoming Root relationship reaches the current Nodus; it does not derive predecessor positions by running chess backward.
- Edge identity is canonical `source + move + target` and is independent of how the edge became known.
- `PositionGraph` canonicalizes edge source and target identities, resolves the supplied move from the canonical source, rejects mismatched targets, and computes the durable edge ID rather than trusting a caller-supplied ID.
- Durable topology is monotonic. Once Chessview has established a legal graph edge, ordinary product workflows do not remove that edge because later statistical evidence changes, falls below an acquisition/selection threshold, or omits the move from a later source Reading.
- Graph existence is durable chess knowledge; games, share, timestamps, and similar statistical fields are mutable evidence attached to that identity.
- Explorer, manual exploration, and derived/transposition knowledge may coexist on one edge rather than replacing one another.
- Independent retention provenance consists only of `manual` and `derived` booleans for now. Those flags may be added but are not cleared by statistical refresh. No provenance history, source records, or generic provenance framework is required.
- Ensuring an already-known edge preserves its current mutable fields and independent provenance while adding any supplied `manual` or `derived` provenance.
- Updating an already-known edge may replace its mutable fields, but it preserves canonical graph identity and any already-established `manual` / `derived` provenance.
- A caller may request that an update create a previously unknown legal edge; [Knowledge acquisition](knowledge-acquisition.md#terms) owns Explorer-backed Edge Admission and decides whether creation is allowed. `PositionGraph` validates and persists the result but does not decide usefulness thresholds.
- Concurrent topology/provenance/statistics mutations of the same edge must not lose already-established provenance or overwrite a later committed statistical update with an earlier Reading.
- Materializing a played Move delegates its chess resolution to Resolve Move, then ensures the durable graph edge exists with explicit/manual provenance and ensures the target position record exists.
- Move materialization establishes graph knowledge only; it does not decide whether the target becomes the current Nodus or belongs in the current Constellation.
- Graph state persists in IndexedDB so navigation and previously discovered transpositions survive reloads.
- `PositionGraph` does not cache graph neighborhoods or maintain a second in-memory graph.
- Ordinary application behavior has no graph-edge deletion operation. Database clearing for tests/maintenance is not part of the Position Graph domain contract.

## Application boundary

The application-level API is deliberately small:

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

`ensureEdge(edge, provenance)` validates and canonicalizes graph identity. For a new identity it persists one edge with supplied fields and provenance. For an existing identity it preserves the stored mutable/statistical fields and OR-adds independent `manual` / `derived` provenance without creating a duplicate.

`updateEdge(edge, { create })` also validates and canonicalizes graph identity. For an existing identity it replaces the supplied edge state while preserving canonical identity and already-established manual/derived provenance. When `create` is false, an unknown identity remains unknown; when `create` is true, a legal unknown identity may be admitted. The caller owns that admission decision.

Neither operation can retarget an existing edge or withdraw graph topology.

Higher-level graph mutation workflows remain outside this boundary. `move-materialization.js` owns `source + Move -> target record + explicit edge`. Transposition expansion owns which derived relationships should be materialized. [Knowledge acquisition](knowledge-acquisition.md) owns whether newly observed statistical relationships receive Edge Admission and which mutable evidence fields an Explorer Reading supplies.

## Implementation

- `chess.js` owns legal move generation and playable FEN handling.
- `src/graph.js::resolveMove()` owns pure source-position + Move resolution into canonical target, target FEN, SAN, and UCI.
- `src/position-graph.js` owns application-level edge reads and invariant-preserving ensure/update semantics.
- `src/move-materialization.js` owns the concrete resolved-Move -> durable graph-edge/target materialization operation and delegates edge persistence to `PositionGraph`.
- Canonical keys are the stable node identity used by persistence, navigation, knowledge acquisition, Constellation composition, and evidence attachment.
- [`PositionRepository`](../architecture/position-repository.md) owns application-level access to node records: one in-memory record per canonical key, IndexedDB fallback/persistence, and independently cancellable shared hydration of position-backed data facets.
- IndexedDB stores nodes and edges; graph persistence is independent of the current Constellation. `db.js` is the low-level persistence adapter under `PositionRepository` and `PositionGraph`, not the application/domain edge boundary.
- `db.js` provides an atomic per-edge read/modify/write primitive so `PositionGraph` can preserve topology, provenance, and current statistics across concurrent mutations without moving graph semantics into the persistence adapter.
- [Knowledge acquisition](knowledge-acquisition.md) owns Explorer-backed enrichment: it uses Resolve Move to interpret an Explorer Reading, asks `PositionGraph` to update known-edge statistics, may Edge Admit newly observed edges according to acquisition policy, and never treats a refresh as authority to delete already-known topology.
- Presentation code may use product terms such as Root and Line, but storage and graph algorithms should use directional graph terms where clearer.

## Verification

Deterministic tests should cover:

- canonical FEN identity and ignored counters;
- relevant versus irrelevant en-passant identity;
- Resolve Move producing the canonical target and SAN/UCI for a legal Move;
- `PositionGraph` incoming/outgoing queries canonicalizing position identity;
- ensuring a legal new edge persists exactly one canonical relationship;
- ensuring an existing edge does not duplicate it;
- rejecting an edge whose target does not match its legal move result;
- adding manual provenance to an Explorer-backed edge without losing statistical evidence;
- manual and derived provenance coexisting on one edge;
- concurrent manual/derived ensures retaining both provenance flags;
- concurrent statistical refresh and provenance addition retaining both the refreshed statistics and provenance;
- updating mutable statistics without changing edge identity;
- an update not creating an unknown edge unless the caller explicitly permits Edge Admission;
- materialization of a played legal Move into its canonical target and durable edge;
- transposition merge behavior and derived provenance retention;
- persistence of nodes and edges;
- in-memory node reuse and IndexedDB fallback through `PositionRepository`;
- Explorer Reading refresh updating known-edge statistics while never deleting a previously materialized legal edge solely because it is absent or no longer significant in the new Reading.

## Related components

- [Knowledge acquisition](knowledge-acquisition.md) adds newly admitted graph knowledge and refreshes mutable evidence on known edges.
- [Constellation](constellation.md) projects durable graph knowledge into the current coherent visible subgraph without redefining graph identity.
- [Nodus](nodus.md) owns Recenter behavior and decides which canonical position organizes the current view.
- [Evidence](evidence.md) attaches statistical and engine meaning without changing graph identity.
