# ChartedGraph

## Purpose

Own Chessview's durable chess graph: what a node means, what a graph edge means, how equivalent positions merge, how legal relationships are interpreted, and what remains true as the graph grows.

Canonical Chessview terms are defined in the [Chessview glossary](../glossary.md); this component links them at first meaningful use.

## Model

Chess rules define one fixed graph of legal [canonical positions](../glossary.md#canonical-position) and [Moves](../glossary.md#move). Chessview does not attempt to persist that entire graph. [`ChartedGraph`](../glossary.md#chartedgraph) is the durable subset of canonical positions and legal Move relationships that Chessview has established so far.

`ChartedGraph` records chess knowledge, not a snapshot of the evidence that happened to reveal that knowledge. Source observations, population statistics, engine evaluations, selection scores, and current-view annotations remain outside graph identity and graph persistence.

## Nodes

A `ChartedGraph` node represents one [canonical chess position](../glossary.md#canonical-position). Positions with the same canonical identity are the same node regardless of how they were reached.

Canonical position identity consists of piece placement, side to move, castling rights, and only en-passant state that changes available legal moves. FEN halfmove and fullmove counters are intentionally excluded because `ChartedGraph` models position-to-position Move connectivity rather than move-count history; FENs differing only in those counters therefore merge into the same node.

Positions reached by different move orders merge into the same node.

## Graph edges

Every [Graph Edge](../glossary.md#graph-edge) represents exactly one legal [Move](../glossary.md#move) from its source canonical position to its target canonical position.

Incoming Graph Edges provide [Root](../glossary.md#root) context; outgoing Graph Edges provide [Line](../glossary.md#line) context.

Graph Edge identity is canonical `source + Move + target` and is independent of how the relationship became known. A Graph Edge is durable `ChartedGraph` state; temporary objects used for selection or presentation are not Graph Edges merely because they refer to one.

A Graph Edge may retain whether the relationship was explicitly materialized by the user when that fact changes product behavior, such as keeping the relationship navigable without current automatic-selection evidence. This is a durable behavioral property of the known relationship, not a general provenance ledger. Other discovery mechanisms do not require durable provenance merely to prevent deletion because ordinary application behavior does not delete established Graph Edges.

Graph Edges do not store Explorer game counts, move share, source-observation timestamps, source revisions, Salience, eligibility, family/depth membership, or other source/current-view state. Current Explorer evidence is joined to a Graph Edge through its source position and Move when a consumer needs that evidence.

### Resolve Move

[Resolve Move](../glossary.md#resolve-move) is the pure operation that interprets a legal Move from a canonical source position.

Given the source position and Move, it determines:

- the canonical target position;
- a playable FEN for that target;
- the Move's SAN notation;
- the Move's UCI notation.

Resolving a Move does not persist a `ChartedGraph` node or Graph Edge, change the current [Nodus](../glossary.md#nodus), or decide whether the relationship belongs in `ChartedGraph`.

In compact form:

`source position + Move -> canonical target + playable FEN + SAN + UCI`

The result can establish or validate the same directed chess relationship whether that relationship is used as an outgoing Line from its source or as incoming Root context for its target. Resolve Move works forward from source to target; it does not derive predecessor positions by running chess backward.

## Growth and retention

A position or relationship may become established through explicitly [materializing a Move](../glossary.md#materialize-a-move), transposition knowledge, or an admission decision based on observations from supported sources such as [`LichessGamesDB`, `MastersGamesDB`, or `PlayerGamesDB`](opening-explorer-databases.md). A move appearing in a source database is evidence from which an owning acquisition policy may decide to establish graph knowledge; source presence alone does not mechanically insert every returned move. Source-specific graph-admission policy is defined outside this component.

`ChartedGraph` grows monotonically during ordinary application behavior as Chessview establishes more legal positions and relationships. A later source observation changing statistics, omitting a move, falling below a threshold, or being evicted from cache does not retract already-established topology.

Population statistics and similar source evidence remain owned by their source/evidence path rather than copied onto Graph Edges. If current source evidence is unavailable, the relationship remains known while that evidence is unknown. Clearing refreshable source caches therefore does not alter `ChartedGraph` knowledge.

Repeated reconciliation of the same source observation should converge by inspecting actual graph state: relationships that are already established need no graph rewrite, while admissible missing relationships may still be established. No durable source-observation revision or graph-projection watermark is part of `ChartedGraph`.

Materializing a played Move delegates chess interpretation to Resolve Move, then ensures the corresponding durable Graph Edge and target position record exist and records explicit materialization when product behavior needs that distinction. Move materialization establishes graph knowledge only; it does not decide whether the target becomes the current Nodus or belongs in the current Constellation.

Established graph knowledge survives reloads. Ordinary application behavior has no Graph Edge deletion operation; database clearing for tests or maintenance is outside the `ChartedGraph` domain contract.

## Architecture boundary

[`PositionGraph`](../architecture/position-graph.md) is the current application-level Graph Edge access and mutation boundary beneath this model. It owns edge normalization, legal source/Move/target validation, exact mutation API semantics, concurrency coordination for graph mutation, and persistence mechanics. It does not own Explorer freshness, source-observation ordering, source evidence, or Constellation selection state.

[`PositionRepository`](../architecture/position-repository.md) separately owns canonical position records and their hydrated data facets. Source clients use those records for refreshable observations such as Explorer Readings; higher-level acquisition, materialization, and transposition workflows establish graph knowledge through `PositionGraph` without redefining `ChartedGraph` identity.

## Verification

Deterministic tests should cover:

- canonical identity merging FENs that differ only in halfmove/fullmove counters;
- relevant versus irrelevant en-passant identity;
- transposition merge behavior for positions reached by different move orders;
- Resolve Move producing the canonical target, playable FEN, SAN, and UCI for a legal Move;
- one legal Move relationship having one canonical Graph Edge identity regardless of how it became known;
- Graph Edges persisting topology without Explorer games/share/timestamp or current-view selection state;
- an explicitly materialized relationship retaining the behavioral distinction required for explicit navigation/selection;
- a previously established Graph Edge remaining durable when a later source observation omits it or source evidence is evicted;
- a previously established Graph Edge remaining durable when later evidence falls below a rule that would govern a still-unknown relationship;
- repeated reconciliation of an already-established relationship requiring no graph rewrite;
- materialization of a played legal Move establishing its canonical target and durable relationship without deciding the current Nodus or Constellation;
- established graph knowledge surviving reloads.

Exact API, normalization, graph-mutation concurrency, and persistence verification belongs to the [PositionGraph architecture](../architecture/position-graph.md). Source-cache and shared-load verification belongs to [`PositionRepository`](../architecture/position-repository.md) and the owning source client.

## Related components

- [Knowledge acquisition](knowledge-acquisition.md) admits new graph knowledge from graph-bearing observations without mirroring mutable source evidence onto Graph Edges.
- [Opening Explorer databases](opening-explorer-databases.md) defines the supported source populations whose observations may inform acquisition policy.
- [Evidence](evidence.md) interprets current source and engine observations without changing graph identity.
- [Constellation](constellation.md) combines known Graph Edges with currently available evidence into Candidates and visible relationships for the current coherent view.
- [Nodus](nodus.md) owns Recenter behavior and decides which canonical position organizes the current view.
