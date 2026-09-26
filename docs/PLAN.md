# Chessview v1

## Goal

Build a static, browser-only chess opening explorer where a canonical chess position is the center of a spatial graph and nearby positions are rendered as smaller chessboards. The map should make continuations, known incoming positions, siblings/cousins, and transpositions visually understandable without turning the experience into a move-list dashboard.

## Product language

Chessview uses **Roots** and **Lines** as the canonical user-facing terms for the two directions around the current position:

- **Root** — a known position that reaches the current position by one legal move. A position may have multiple Roots when different move orders transpose into the same canonical position. When ancestry is expanded, the **Roots** view includes the upstream move-order tree feeding those immediate Roots.
- **Line** — a known position reached from the current position by one legal move. Deeper continuation positions belong to that Line as it extends forward.
- **Roots** answer **“How can this position be reached?”**
- **Lines** answer **“Where can play go from here?”**

These are product/UI terms. Implementation code may use graph terms such as `incoming` / `outgoing`, `source` / `target`, and predecessor / successor where those are clearer technically.

The right-side control and evidence surface is the **Rail**.

## Product usability bar

Feature criticality answers a different question from v1 scope. A supplementary or decorative feature may still be required for v1, but its absence or failure must not make the core graph unusable or keep the current view permanently unsettled.

### Critical — the product is not usable without this

Chessview's core job is to establish and navigate a trustworthy position graph. The product is usable only when all of the following hold for the current view:

- the center is a valid canonical chess position and legal moves can recenter it;
- graph identity and one-move edges are correct, including transposition merging;
- the visible Root/Line neighborhood is established well enough that the boards the visitor is expected to navigate are known and rendered;
- known Roots come from trustworthy incoming graph edges;
- Lines are populated from rated Lichess Explorer data when current cached graph knowledge is insufficient to establish them;
- automatic discovery applies the local qualification/sample rules and visible-board budget without collapsing the map into one dominant branch;
- Root/Line direction, board identity, and navigation target remain correct as the view changes;
- current-view structural work has reached a terminal outcome. Work that can still add, remove, or rearrange visible boards blocks structural readiness until it succeeds, establishes legitimate absence, fails explicitly, or becomes obsolete;
- recentering and browser history preserve position-centered navigation semantics.

A fresh network response is not inherently critical if existing persisted graph data is already sufficient to establish the visible neighborhood. Conversely, rated Explorer becomes critical when missing or stale graph knowledge means the current Lines cannot yet be determined. Criticality follows the capability needed by the current view, not the name of the endpoint that happened to run.

An explicit critical failure ends loading but does not make the product usable. If Chessview cannot establish the visible structural neighborhood, the global state must show a degraded/unavailable outcome rather than the normal success-style `Ready` / check state.

### Supplementary — useful product meaning that must not block core usability

These features enrich an already usable graph and may continue loading after the visible Root/Line structure is settled:

- cloud evaluation and center evaluation;
- pawn-loss values and move-quality classification;
- Masters comparison data;
- rated-Lichess/engine and Masters/engine mismatch markers;
- Root rarity classification;
- fallback target-position evaluation when source MultiPV does not contain a move;
- opening names and ECO metadata;
- persisted evidence caches and other reuse that improve later visits without being necessary to navigate the current established graph;
- readiness/status explanation, guide affordances, and other supporting UI that improve understanding but are not themselves the graph.

Failure of supplementary evidence reduces richness rather than usability. It should remain locally distinguishable from genuine absence, but it should not by itself keep the global view in `Updating…`, remove the normal settled check, or turn a structurally established graph into an unusable state.

### Decorative — presentation polish only

Decorative features may make Chessview easier or more pleasant to read, but removing them must not remove unique chess information or navigation capability. Examples include:

- animation, fades, pulses, hover zoom, shadows, and similar motion/polish;
- the exact glyph, color, dash, or opacity treatment used to present a signal whose underlying meaning is available elsewhere;
- transient wording such as the brief `Ready` label before it collapses to a subtle settled mark;
- purely cosmetic spacing, separators, and visual grouping.

A treatment stops being decorative when it is the only way a required distinction is communicated. For example, Root rarity is supplementary evidence, while a particular diamond/dash treatment for that rarity is decorative; request failure versus genuine absence is a meaningful distinction and therefore cannot be represented only by an optional decorative cue.

### Readiness consequence

Global readiness follows the critical structural layer, not the completion of every supplementary request.

- `Updating…` means unresolved critical structural work can still materially change which Root/Line boards are present or how they are structurally associated.
- Normal `Ready` / subtle check means the critical visible structure has been established successfully, including legitimate empty/absent structure where applicable. Supplementary evidence may still be hydrating.
- A critical structural failure is terminal for loading but must use a degraded/unavailable global state rather than the normal success-style settled state.
- Supplementary failures remain visible at their local evidence surface and do not reopen or downgrade an otherwise successfully established structural view.
- Background work that cannot alter the current visible neighborhood never blocks readiness.

## Cross-component commitments

- The graph is built from canonical chess positions connected by single legal moves; transpositions merge.
- Rated standard Lichess Opening Explorer is the primary human-statistical source. Masters data is a comparison population, and adequate-depth Lichess cloud evaluation supplies engine evidence.
- Automatic graph expansion is local to each source position: sufficiently sampled moves at or above 5% qualify for automatic discovery.
- The visible neighborhood is branch-balanced rather than dominated by one broad Line.
- The current position is a large playable board; surrounding boards are navigation surfaces. Root context is left of center and Line context is right of center.
- Recentring is position-based. The URL identifies the current position, not the path used to reach it.
- Discovered graph and evidence data persist in the browser.
- Application-issued Lichess API requests are coordinated application-wide through `LichessGateway`; transport failure is not interpreted as absence of chess evidence.
- Production remains a static GitHub Pages deployment.

## Components

Detailed requirements, implementation choices, tunables, and verification live with the component that owns them:

- [Position graph](components/position-graph.md) — canonical identity, legal edges, transpositions, and graph persistence.
- [Discovery](components/discovery.md) — Explorer reconciliation, automatic expansion, and branch-balanced neighborhood selection.
- [Lichess access](components/lichess-access.md) — OAuth, data endpoints, `LichessGateway`, request policy, and cache/failure semantics.
- [Evidence](components/evidence.md) — engine quality, Masters/Lichess comparison, Rail filtering, and Root rarity.
- [Interface](components/interface.md) — center/miniboard interaction, spatial layout, Rail, orientation, and URL navigation.
- [Delivery](components/delivery.md) — static build, deterministic CI, and GitHub Pages publication.

Architecture that needs an independently maintained boundary lives under `docs/architecture/`. In particular, [LichessGateway architecture](architecture/lichess-gateway.md) governs the Lichess network boundary.

## Maintaining the plan

`PLAN.md` owns the product goal, product language, product usability bar, cross-component commitments, and the component map. A component document owns the detailed requirements in its scope. When a change crosses components, update each affected owner rather than duplicating one component's detailed contract here.
