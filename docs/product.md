# Chessview product contract

[Chessview vision](vision.md) owns durable product direction; the [glossary](glossary.md) owns canonical term definitions. This document owns the conditions that must remain true across the product. Detailed behavior and verification belong to the component documents; unfinished outcomes belong in `backlog/`.

## Product usability bar

Feature criticality answers a different question from release scope. A supplementary or decorative feature may still be required, but its absence or failure must not make the core graph unusable or keep the current view permanently unsettled.

### Critical — the product is not usable without this

Chessview's core job is to establish and navigate a trustworthy position graph through a coherent current Constellation. The product is usable only when all of the following hold for the current view:

- the Nodus is a valid canonical chess position and legal moves can recenter it;
- graph identity and one-move edges are correct, including transposition merging;
- the Constellation is established well enough that the positions the visitor is expected to navigate are known and represented coherently;
- known Roots come from trustworthy incoming graph edges;
- Knowledge acquisition can obtain or reconcile graph information required to compose the current Constellation when persisted knowledge is insufficient;
- acquisition and visibility remain independent: Chessview may know more positions than the current Constellation shows, and visible-space limits do not become acquisition limits;
- Constellation composition preserves Root/Line direction, distinct branch/family structure until genuine canonical convergence, and the distinction between durable graph identity and the current projection;
- evidence explicitly required to decide current Constellation membership or ordering is treated as structural input for that decision rather than as merely decorative annotation;
- current-view critical structural work has reached a terminal outcome. Work that can still add, remove, or structurally rearrange the Constellation blocks successful Weather until it succeeds, establishes legitimate absence, fails explicitly, or becomes obsolete;
- recentering and browser history preserve position-centered navigation semantics.

A fresh network response is not inherently critical if existing persisted graph data is already sufficient to establish the Constellation. Conversely, rated Explorer or other selection evidence becomes critical when unresolved information prevents the current Constellation from being determined. Criticality follows the capability needed by the current view, not the endpoint that happened to run.

An explicit critical failure ends loading but does not make the product usable. If Chessview cannot establish the required visible structure, Weather must show a degraded/unavailable outcome rather than the normal success-style `Ready` / check state.

### Supplementary — useful meaning that must not block core usability

These features enrich an already usable graph and may continue loading after the Constellation is settled when they are not pending structural inputs to Constellation selection:

- cloud evaluation and Nodus evaluation;
- pawn-loss values and move-quality classification;
- Masters comparison data;
- rated-Lichess/engine and Masters/engine mismatch markers;
- Root rarity classification;
- fallback target-position evaluation when source MultiPV does not contain a move;
- opening names and ECO metadata;
- persisted evidence caches and other reuse that improve later visits without being necessary to navigate an established Constellation;
- guide affordances and other supporting UI that improve understanding but are not themselves the graph.

Failure of supplementary evidence reduces richness rather than usability. It should remain locally distinguishable from genuine absence, but it should not by itself keep Weather in `Updating…`, remove the normal settled check, or turn a structurally established Constellation into an unusable state.

### Decorative — presentation polish only

Decorative features may make Chessview easier or more pleasant to read, but removing them must not remove unique chess information or navigation capability. Examples include animation, fades, pulses, hover zoom, shadows, exact glyph/color/dash/opacity treatments, transient settled wording, and purely cosmetic spacing or grouping.

A treatment stops being decorative when it is the only way a required distinction is communicated. Root rarity, for example, is supplementary evidence while a particular visual treatment for that rarity is decorative; request failure versus genuine absence is meaningful and therefore cannot exist only as an optional cosmetic cue.

## Weather

Global Weather follows the critical structural layer, not completion of every supplementary request.

- `Updating…` means unresolved critical structural work can still materially change the Constellation or its structural associations.
- Normal `Ready` / subtle check means the critical visible structure has been established successfully, including legitimate empty or absent structure where applicable. Supplementary evidence may still be hydrating.
- A critical structural failure is terminal for loading but must use a degraded/unavailable global state rather than the normal success-style settled state.
- Supplementary failures remain visible at their local evidence surface and do not reopen or downgrade an otherwise successfully established view.
- Background work that cannot alter the current Constellation never blocks Weather.

## Cross-product commitments

- The graph is built from canonical chess positions connected by single legal [Moves](glossary.md#move) represented as directed [graph edges](glossary.md#graph-edge); transpositions merge.
- Rated standard Lichess Opening Explorer is the primary human-statistical source. Masters data is a comparison population, and adequate-depth Lichess cloud evaluation supplies engine evidence.
- Knowledge acquisition and Constellation composition are separate concerns: acquisition owns durable graph/evidence enrichment, while Constellation owns the coherent current-view projection.
- Automatic Constellation selection is currently bounded by usable rated Lichess Explorer frequency data. Rated frequency orders eligible candidates locally when they share the same source position; it is not one global rank across unrelated source positions. Rare candidates may remain eligible when engine quality or favorable human results make them significant.
- Missing, failed, or insufficient rescue evidence remains unknown and is not negative evidence for automatic Constellation selection.
- The visible Constellation is sized for available presentation space and legibility rather than a fixed product-level board count.
- The Nodus is a large playable board; surrounding boards are navigation surfaces. Root context is left of the Nodus and Line context is right of it.
- Recentring is position-based: a [Recenter](glossary.md#recenter) selects the next Nodus, while the URL identifies that Nodus rather than the path used to reach it; browser history may restore an earlier recorded Nodus without creating a new Recenter.
- Durable graph and evidence data persist in the browser independently of the current Constellation.
- Application-issued Lichess API requests are coordinated application-wide through `LichessGateway`; transport failure is not interpreted as absence of chess evidence.
- Production remains a static GitHub Pages deployment.

## Ownership

`docs/architecture/` owns independently maintained technical boundaries distinct from component behavior and verification.
