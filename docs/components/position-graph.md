# Position graph

## Purpose

Own Chessview's durable chess-state model: what a node means, what an edge means, and how equivalent positions merge.

Terminology follows the [Chessview glossary](../glossary.md), especially [Move](../glossary.md#move), [Resolve Move](../glossary.md#resolve-move), [graph edge](../glossary.md#graph-edge), and [materialize a move](../glossary.md#materialize-a-move).

## Requirements

- A graph node is one canonical chess position.
- Every graph edge represents exactly one legal move from its source position to its target position.
- Canonical identity includes pieces, side to move, castling rights, and only en-passant state that can affect future legal play.
- Halfmove and fullmove counters do not participate in position identity.
- Positions reached by different move orders merge into the same node.
- Incoming edges provide Root context; outgoing edges provide Line context.
- Resolving a Move is the pure directional operation `source + Move -> canonical target + target FEN + SAN/UCI`. The same operation may produce an outgoing Line relationship or validate that a known incoming Root relationship reaches the current Nodus; it does not derive predecessor positions by running chess backward.
- Edge identity is independent of how the edge became known. Explorer, manual exploration, and derived/transposition provenance may coexist on one edge rather than replacing one another.
- Materializing a played Move delegates its chess resolution to Resolve Move, then ensures the durable graph edge exists with explicit/manual provenance and ensures the target position record exists.
- Materializing an already-known edge preserves its existing Explorer games, share, qualification, and other evidence fields while adding explicit/manual provenance.
- Explicitly explored/manual edges survive refreshes of Explorer-derived edges; Explorer refresh may update statistical evidence while preserving manual/derived provenance.
- Move materialization establishes graph knowledge only; it does not decide whether the target becomes the current Nodus or belongs in the current Constellation.
- Graph state persists in IndexedDB so navigation and previously discovered transpositions survive reloads.

## Implementation

- `chess.js` owns legal move generation and playable FEN handling.
- `src/graph.js::resolveMove()` owns pure source-position + Move resolution into canonical target, target FEN, SAN, and UCI.
- `src/move-materialization.js` owns the concrete resolved-Move -> durable graph-edge/target materialization operation and delegates chess interpretation to `resolveMove()`.
- Canonical keys are the stable node identity used by persistence, navigation, knowledge acquisition, Constellation composition, and evidence attachment.
- [`PositionRepository`](../architecture/position-repository.md) owns application-level access to node records: one in-memory record per canonical key, IndexedDB fallback/persistence, and independently cancellable shared hydration of position-backed data facets.
- IndexedDB stores nodes and edges; graph persistence is independent of the current Constellation. `db.js` is the low-level persistence adapter rather than an application-level node cache.
- [Knowledge acquisition](knowledge-acquisition.md) owns Explorer-backed enrichment and reconciliation; it uses Resolve Move to interpret Explorer moves, preserves explicit/manual provenance, and does not own played-Move materialization.
- Presentation code may use product terms such as Root and Line, but storage and graph algorithms should use directional graph terms where clearer.

## Verification

Deterministic tests should cover:

- canonical FEN identity and ignored counters;
- relevant versus irrelevant en-passant identity;
- Resolve Move producing the canonical target and SAN/UCI for a legal Move;
- legal one-move edge creation;
- materialization of a played legal Move into its canonical target and durable edge;
- transposition merge behavior;
- persistence of nodes and edges;
- in-memory node reuse and IndexedDB fallback through `PositionRepository`;
- materializing an Explorer-backed edge without losing its statistical evidence;
- preservation of manual/explicit graph provenance when Explorer-derived edges are reconciled, while refreshed Explorer statistics replace stale statistical values.

## Related components

- [Knowledge acquisition](knowledge-acquisition.md) adds and reconciles Explorer-derived graph edges and evidence.
- [Constellation](constellation.md) projects durable graph knowledge into the current coherent visible subgraph without redefining graph identity.
- [Nodus](nodus.md) owns Recenter behavior and decides which canonical position organizes the current view.
- [Evidence](evidence.md) attaches statistical and engine meaning without changing graph identity.
