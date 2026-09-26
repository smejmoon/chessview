# Chessview product contract

[Chessview vision](vision.md) owns the durable product direction and language. This document owns the conditions that must remain true across the product. Detailed behavior and verification belong to the component documents; unfinished outcomes belong in `backlog/`.

## Product usability bar

Feature criticality answers a different question from release scope. A supplementary or decorative feature may still be required, but its absence or failure must not make the core graph unusable or keep the current view permanently unsettled.

### Critical — the product is not usable without this

Chessview's core job is to establish and navigate a trustworthy position graph. The product is usable only when all of the following hold for the current view:

- the Nodus is a valid canonical chess position and legal moves can recenter it;
- graph identity and one-move edges are correct, including transposition merging;
- the visible Root/Line neighborhood is established well enough that the boards the visitor is expected to navigate are known and rendered;
- known Roots come from trustworthy incoming graph edges;
- Lines are populated from rated Lichess Explorer data when current cached graph knowledge is insufficient to establish them;
- automatic discovery applies the local qualification/sample rules and visible-board budget without collapsing the map into one dominant branch;
- Root/Line direction, board identity, and navigation target remain correct as the view changes;
- current-view structural work has reached a terminal outcome. Work that can still add, remove, or rearrange visible boards blocks structural readiness until it succeeds, establishes legitimate absence, fails explicitly, or becomes obsolete;
- recentering and browser history preserve position-centered navigation semantics.

A fresh network response is not inherently critical if existing persisted graph data is already sufficient to establish the visible neighborhood. Conversely, rated Explorer becomes critical when missing or stale graph knowledge means the current Lines cannot yet be determined. Criticality follows the capability needed by the current view, not the endpoint that happened to run.

An explicit critical failure ends loading but does not make the product usable. If Chessview cannot establish the visible structural neighborhood, the global state must show a degraded/unavailable outcome rather than the normal success-style `Ready` / check state.

### Supplementary — useful meaning that must not block core usability

These features enrich an already usable graph and may continue loading after the visible Root/Line structure is settled:

- cloud evaluation and Nodus evaluation;
- pawn-loss values and move-quality classification;
- Masters comparison data;
- rated-Lichess/engine and Masters/engine mismatch markers;
- Root rarity classification;
- fallback target-position evaluation when source MultiPV does not contain a move;
- opening names and ECO metadata;
- persisted evidence caches and other reuse that improve later visits without being necessary to navigate the established graph;
- readiness/status explanation, guide affordances, and other supporting UI that improve understanding but are not themselves the graph.

Failure of supplementary evidence reduces richness rather than usability. It should remain locally distinguishable from genuine absence, but it should not by itself keep the global view in `Updating…`, remove the normal settled check, or turn a structurally established graph into an unusable state.

### Decorative — presentation polish only

Decorative features may make Chessview easier or more pleasant to read, but removing them must not remove unique chess information or navigation capability. Examples include animation, fades, pulses, hover zoom, shadows, exact glyph/color/dash/opacity treatments, transient settled wording, and purely cosmetic spacing or grouping.

A treatment stops being decorative when it is the only way a required distinction is communicated. Root rarity, for example, is supplementary evidence while a particular visual treatment for that rarity is decorative; request failure versus genuine absence is meaningful and therefore cannot exist only as an optional cosmetic cue.

## Readiness

Global readiness follows the critical structural layer, not completion of every supplementary request.

- `Updating…` means unresolved critical structural work can still materially change which Root/Line boards are present or how they are structurally associated.
- Normal `Ready` / subtle check means the critical visible structure has been established successfully, including legitimate empty or absent structure where applicable. Supplementary evidence may still be hydrating.
- A critical structural failure is terminal for loading but must use a degraded/unavailable global state rather than the normal success-style settled state.
- Supplementary failures remain visible at their local evidence surface and do not reopen or downgrade an otherwise successfully established structural view.
- Background work that cannot alter the current visible neighborhood never blocks readiness.

## Cross-product commitments

- The graph is built from canonical chess positions connected by single legal moves; transpositions merge.
- Rated standard Lichess Opening Explorer is the primary human-statistical source. Masters data is a comparison population, and adequate-depth Lichess cloud evaluation supplies engine evidence.
- Automatic graph expansion is local to each source position: sufficiently sampled moves at or above 5% qualify for automatic discovery.
- The visible neighborhood is branch-balanced rather than dominated by one broad Line.
- The Nodus is a large playable board; surrounding boards are navigation surfaces. Root context is left of the Nodus and Line context is right of it.
- Recentring is position-based. The URL identifies the Nodus, not the path used to reach it.
- Discovered graph and evidence data persist in the browser.
- Application-issued Lichess API requests are coordinated application-wide through `LichessGateway`; transport failure is not interpreted as absence of chess evidence.
- Production remains a static GitHub Pages deployment.

## Ownership

`docs/vision.md` owns why Chessview exists and its canonical product language. This file owns cross-product conditions that must remain true. `docs/components/` owns exact component behavior and verification, while `docs/architecture/` owns independently maintained technical boundaries. `backlog/` owns work that is still intended but incomplete.
