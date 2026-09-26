# Position graph

## Purpose

Own Chessview's durable chess-state model: what a node means, what an edge means, and how equivalent positions merge.

## Requirements

- A graph node is one canonical chess position.
- Every graph edge represents exactly one legal move from its source position to its target position.
- Canonical identity includes pieces, side to move, castling rights, and only en-passant state that can affect future legal play.
- Halfmove and fullmove counters do not participate in position identity.
- Positions reached by different move orders merge into the same node.
- Incoming edges provide Root context; outgoing edges provide Line context.
- Edge identity is independent of how the edge became known. Explorer, manual exploration, and derived/transposition provenance may coexist on one edge rather than replacing one another.
- Promoting an already-known edge to manual/explicit preserves its existing Explorer games, share, qualification, and other evidence fields.
- Explicitly explored/manual edges survive refreshes of automatically discovered Explorer edges; Explorer refresh may update statistical evidence while preserving manual/derived provenance.
- Graph state persists in IndexedDB so navigation and previously discovered transpositions survive reloads.

## Implementation

- `chess.js` owns legal move generation and playable FEN handling.
- Canonical keys are the stable node identity used by persistence, navigation, discovery, and evidence attachment.
- IndexedDB stores nodes and edges; graph persistence is independent of the current rendered path.
- Presentation code may use product terms such as Root and Line, but storage and graph algorithms should use directional graph terms where clearer.

## Verification

Deterministic tests should cover:

- canonical FEN identity and ignored counters;
- relevant versus irrelevant en-passant identity;
- legal one-move edge creation;
- transposition merge behavior;
- persistence of nodes and edges;
- promotion of an Explorer-backed edge to manual without losing its statistical evidence;
- preservation of manual/explicit graph provenance when Explorer-derived edges are reconciled, while refreshed Explorer statistics replace stale statistical values.

## Related components

- [Discovery](discovery.md) adds and reconciles graph edges.
- [Interface](interface.md) renders and navigates the graph.
- [Evidence](evidence.md) attaches statistical and engine meaning without changing graph identity.
