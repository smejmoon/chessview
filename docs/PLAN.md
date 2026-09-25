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

`PLAN.md` owns the product goal, product language, cross-component commitments, and the component map. A component document owns the detailed requirements in its scope. When a change crosses components, update each affected owner rather than duplicating one component's detailed contract here.
