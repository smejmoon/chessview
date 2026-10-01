# ChartedGraph

## Purpose

Own Chessview's durable chess graph: what a node means, what an edge means, how equivalent positions merge, how legal relationships are interpreted, and what remains true as the graph grows.

Canonical Chessview terms are defined in the [Chessview glossary](../glossary.md); this component links them at first meaningful use.

## Model

Chess rules define one fixed graph of legal [canonical positions](../glossary.md#canonical-position) and [Moves](../glossary.md#move). Chessview does not attempt to persist that entire graph. [`ChartedGraph`](../glossary.md#chartedgraph) is the durable subset of canonical positions and legal Move relationships that Chessview has established so far.

## Nodes

A `ChartedGraph` node represents one [canonical chess position](../glossary.md#canonical-position). Positions with the same canonical identity are the same node regardless of how they were reached.

Canonical position identity consists of piece placement, side to move, castling rights, and only en-passant state that changes available legal moves. FEN halfmove and fullmove counters are intentionally excluded because `ChartedGraph` models position-to-position Move connectivity rather than move-count history; FENs differing only in those counters therefore merge into the same node.

Positions reached by different move orders merge into the same node.

## Edges

Every [graph edge](../glossary.md#graph-edge) represents exactly one legal [Move](../glossary.md#move) from its source position to its target position.

Incoming edges provide [Root](../glossary.md#root) context; outgoing edges provide [Line](../glossary.md#line) context.

Edge identity is canonical `source + Move + target` and is independent of how the edge became known.

### Resolve Move

[Resolve Move](../glossary.md#resolve-move) is the pure operation that interprets a legal Move from a canonical source position.

Given the source position and Move, it determines:

- the canonical target position;
- a playable FEN for that target;
- the Move's SAN notation;
- the Move's UCI notation.

Resolving a Move does not persist a `ChartedGraph` node or edge, change the current [Nodus](../glossary.md#nodus), or decide whether the relationship belongs in `ChartedGraph`.

In compact form:

`source position + Move -> canonical target + playable FEN + SAN + UCI`

The result can establish or validate the same directed chess relationship whether that relationship is used as an outgoing Line from its source or as incoming Root context for its target. Resolve Move works forward from source to target; it does not derive predecessor positions by running chess backward.

### Retention provenance

Different ways of establishing one legal relationship may coexist on the same edge rather than replacing one another.

Chessview currently recognizes two independent retention reasons: explicit/manual materialization and derived/transposition knowledge. Once either reason is established, statistical refresh must not clear it. The persistence representation for those reasons belongs to the [PositionGraph architecture](../architecture/position-graph.md), not to the `ChartedGraph` domain model.

## Growth and retention

A position or relationship may become established through explicitly [materializing a Move](../glossary.md#materialize-a-move), derived/transposition knowledge, or an admission decision based on observations from supported sources such as [`LichessGamesDB`, `MastersGamesDB`, or `PlayerGamesDB`](opening-explorer-databases.md). A move appearing in a source database is evidence from which an owning acquisition policy may decide to establish graph knowledge; source presence alone does not mechanically insert every returned move. Source-specific graph-admission policy is defined outside this component.

`ChartedGraph` can grow as Chessview establishes more legal positions and relationships. Ordinary source refreshes do not remove already-established topology merely because statistics change, a threshold changes, or a later source observation omits a move. Mutable statistics and other evidence may be refreshed independently of graph existence.

Graph existence is durable chess knowledge; games, share, timestamps, and similar statistical fields are mutable evidence attached to that identity rather than part of topology.

Concurrent graph mutations must not lose an already-established retention reason or replace a later committed statistical update with an earlier one. The current coordination mechanism that enforces this invariant belongs to the [PositionGraph architecture](../architecture/position-graph.md).

Materializing a played Move delegates chess interpretation to Resolve Move, then ensures the corresponding durable graph edge and target position record exist with explicit/manual retention provenance. Move materialization establishes graph knowledge only; it does not decide whether the target becomes the current Nodus or belongs in the current Constellation.

Established graph knowledge survives reloads. Ordinary application behavior has no graph-edge deletion operation; database clearing for tests or maintenance is outside the `ChartedGraph` domain contract.

## Architecture boundary

[`PositionGraph`](../architecture/position-graph.md) is the current application-level edge access and mutation boundary beneath this model. It owns edge normalization, legal source/Move/target validation, exact mutation API semantics, concurrency coordination, and persistence mechanics.

[`PositionRepository`](../architecture/position-repository.md) separately owns canonical position records and their hydrated data facets. Higher-level acquisition, materialization, and transposition workflows may establish or refresh graph knowledge through those technical boundaries without redefining `ChartedGraph` identity.

## Verification

Deterministic tests should cover:

- canonical identity merging FENs that differ only in halfmove/fullmove counters;
- relevant versus irrelevant en-passant identity;
- transposition merge behavior for positions reached by different move orders;
- Resolve Move producing the canonical target, playable FEN, SAN, and UCI for a legal Move;
- one legal Move relationship having one canonical edge identity regardless of how it became known;
- explicit/manual and derived retention reasons coexisting without statistical refresh clearing either one;
- mutable statistics changing without changing edge identity;
- a previously established edge remaining durable when a later source observation omits it;
- a previously established edge remaining durable when later statistics fall below a rule that would govern a still-unknown relationship;
- materialization of a played legal Move establishing its canonical target and durable relationship without deciding the current Nodus or Constellation;
- established graph knowledge surviving reloads.

Exact API, normalization, concurrency, and persistence verification belongs to the [PositionGraph architecture](../architecture/position-graph.md). Position-record cache and IndexedDB fallback verification belongs to [`PositionRepository`](../architecture/position-repository.md).

## Related components

- [Knowledge acquisition](knowledge-acquisition.md) adds newly admitted graph knowledge and refreshes mutable evidence on known edges.
- [Opening Explorer databases](opening-explorer-databases.md) defines the supported source populations whose observations may inform acquisition policy.
- [Constellation](constellation.md) projects `ChartedGraph` knowledge into the current coherent visible subgraph without redefining graph identity.
- [Nodus](nodus.md) owns Recenter behavior and decides which canonical position organizes the current view.
- [Evidence](evidence.md) attaches statistical and engine meaning without changing graph identity.
