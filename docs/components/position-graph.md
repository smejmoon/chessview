# Position graph

## Purpose

Own Chessview's durable chess-state model: what a node means, what an edge means, and how equivalent positions merge.

Terminology follows the [Chessview glossary](../glossary.md), especially [Move](../glossary.md#move), [Resolve Move](../glossary.md#resolve-move), [graph edge](../glossary.md#graph-edge), and [materialize a move](../glossary.md#materialize-a-move).

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
- Explorer, manual exploration, and derived/transposition knowledge may coexist on one edge rather than replacing one another.
- For the initial boundary, independent retention provenance consists only of `manual` and `derived` booleans. No provenance history, timestamps, source records, or generic provenance framework is required.
- Ensuring an already-known edge preserves its existing statistical fields and independent provenance while adding any supplied `manual` or `derived` provenance.
- Materializing a played Move delegates its chess resolution to Resolve Move, then ensures the durable graph edge exists with explicit/manual provenance and ensures the target position record exists.
- Explicitly explored/manual and derived edges survive refreshes of Explorer-backed edges; Explorer refresh may update statistical evidence while preserving those independent provenance flags.
- Move materialization establishes graph knowledge only; it does not decide whether the target becomes the current Nodus or belongs in the current Constellation.
- Graph state persists in IndexedDB so navigation and previously discovered transpositions survive reloads.
- `PositionGraph` does not cache graph neighborhoods or maintain a second in-memory graph.

## Application boundary

The initial `PositionGraph` API is deliberately small:

```js
positionGraph.outgoing(position)
positionGraph.incoming(position)
positionGraph.ensureEdge(edge, {
  manual: false,
  derived: false,
})
```

`outgoing(position)` and `incoming(position)` canonicalize their position argument before reading durable edges.

`ensureEdge(edge, provenance)` validates and canonicalizes the graph identity. For a new identity it persists one edge with supplied fields and provenance. For an existing identity it preserves the stored statistical fields and OR-adds independent `manual` / `derived` provenance without creating a duplicate.

Higher-level graph mutation workflows remain outside this boundary. `move-materialization.js` owns `source + Move -> target record + explicit edge`. Transposition expansion owns which derived relationships should be materialized and uses `PositionGraph.ensureEdge()` to retain derived provenance even when the same relationship is already known another way.

## Implementation

- `chess.js` owns legal move generation and playable FEN handling.
- `src/graph.js::resolveMove()` owns pure source-position + Move resolution into canonical target, target FEN, SAN, and UCI.
- `src/position-graph.js` owns application-level edge reads and invariant-preserving edge ensure semantics.
- `src/move-materialization.js` owns the concrete resolved-Move -> durable graph-edge/target materialization operation and delegates edge persistence to `PositionGraph`.
- Canonical keys are the stable node identity used by persistence, navigation, knowledge acquisition, Constellation composition, and evidence attachment.
- [`PositionRepository`](../architecture/position-repository.md) owns application-level access to node records: one in-memory record per canonical key, IndexedDB fallback/persistence, and independently cancellable shared hydration of position-backed data facets.
- IndexedDB stores nodes and edges; graph persistence is independent of the current Constellation. `db.js` is the low-level persistence adapter under `PositionRepository` and `PositionGraph`, not the application/domain edge boundary.
- [Knowledge acquisition](knowledge-acquisition.md) owns Explorer-backed enrichment and reconciliation; it uses Resolve Move to interpret Explorer moves, preserves manual/derived provenance, and does not own played-Move materialization.
- Explorer reconciliation currently retains its source-scoped atomic replacement primitive in `db.js`. Migrating that mutation path behind `PositionGraph` is a later step and must preserve the existing one-transaction replacement semantics rather than decomposing reconciliation into independently committed per-edge updates/deletes.
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
- materialization of a played legal Move into its canonical target and durable edge;
- transposition merge behavior and derived provenance retention;
- persistence of nodes and edges;
- in-memory node reuse and IndexedDB fallback through `PositionRepository`;
- preservation of manual/derived graph provenance when Explorer-backed edges are reconciled, while refreshed Explorer statistics replace stale statistical values.

## Related components

- [Knowledge acquisition](knowledge-acquisition.md) adds and reconciles Explorer-derived graph edges and evidence.
- [Constellation](constellation.md) projects durable graph knowledge into the current coherent visible subgraph without redefining graph identity.
- [Nodus](nodus.md) owns Recenter behavior and decides which canonical position organizes the current view.
- [Evidence](evidence.md) attaches statistical and engine meaning without changing graph identity.
