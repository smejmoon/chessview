# Do:

Connect the existing experimental 2.5D/3D star-map viewer to ChessView's **accepted, current-Nodus Constellation** instead of its manually assembled opening graph. Publish a branch preview in which the same actual canonical positions and Graph Edge relationships appear in both selectable camera modes and users can select a position to Recenter through ChessView's existing navigation path.

# Because:

The isolated [spatial visual lab](../experiments/star-map/README.md#interactive-25d--3d-star-field-lab-experimental) already renders legal chess examples and a genuine transposition in Three.js, but its graph, family coordinates, and read-only boards are independent of the application's current-view data. That can demonstrate depth and visual style, not whether this presentation helps investigate **real selected Roots, Lines, siblings, and canonical convergence**.

[Constellation](../docs/components/constellation.md#purpose) owns accepted current-view membership and relationships, while [Lens](../docs/components/lens.md#purpose) owns visual geometry and presentation interactions. The project decision in [star-map exploration](2026-10-05-constellation-star-map.md#settled-direction) is to **keep both 2.5D and 3D available during initial actual usage**. They must share the same graph and rendering path rather than become two independent implementations; neither mode has yet earned preference or removal.

# Unsettled:

- The branch-only `?star-map=1` integration now sends the accepted Current View composition to a same-origin Three.js iframe and routes selected nodes back through Current View Recenter. CI, type checks and Pages bundling passed at commit `2c911995b79fc38ebf81c16fdeb7bce3560ade6e`; the real application interaction has **not** yet been browser-verified. Exercise actual accepted projections, recenter/history, Roots, deep Lines, and convergence on the published preview before declaring this milestone complete.
- The live renderer currently uses a simple layer-and-family placement heuristic, not a measured layout. Inspect spatial overlap, orientation and telescope usability on the canonical scenario set; fix problems that block meaningful evaluation, without selecting a mature layout engine prematurely.
- Browser regression coverage currently establishes an isolated lab smoke test and a read-only projection topology test, but not live iframe message handling or a real authorization-to-accepted-Constellation interaction. Add that evidence or report a concrete environment blocker.

- Find the narrowest read-only projection or adapter that supplies the experimental viewer with actual accepted Constellation nodes, relationships, canonical keys, family/Root/Line roles, and available presentation-relevant fields without duplicating graph ownership or initiating source acquisition.
- Decide how the experimental viewer participates in real current-Nodus navigation and refresh, so clicking a visible star uses the existing Recenter action and establishes the newly accepted projection, rather than just highlighting a locally invented center.
- Establish a first practical placement for actual Constellation shapes, keeping the Nodus recognizable and preserving all represented move relationships. Sophisticated spatial optimization and a final engine choice are not prerequisites.

# Edges:

- The parent [star-map exploration](2026-10-05-constellation-star-map.md) still owns the broader visual grammar, interesting-position/landmark rules, layout alternatives, and the eventual usage-driven comparison of 2.5D versus 3D. This entry implements **one bounded real-graph evaluation milestone**, not a production renderer replacement or a decision to remove either mode.
- The existing [Constellation zoom outcome](2026-10-01-constellation-zoom.md) concerns scale-dependent capacity and recomposition; it is not a prerequisite for connecting an already accepted current Constellation to the experiment.
- Preserve ChessView's canonical position identity and transposition merging, Constellation selection, Lens presentation ownership, Current View publication, and Evidence/Weather meanings. Do not add a second graph, independent Lichess fetch pipeline, or independent domain-derived star scoring.
- The Nodus must remain identifiable and navigation must be real, but full playable Chessground integration, richer distant star admission beyond current selection, production-quality landmark promotion, mature 3D graph layout, and advanced camera continuity can be separate follow-up work. A simple temporary position preview or board texture is sufficient here.
- Work and verification remain on `10-12-star-map` until integration is explicitly authorized; normal ChessView remains unchanged by this experiment.

# Complete:

A published, browser-verified **branch-only preview** derives its displayed positions and move connections from ChessView's accepted current-view Constellation rather than hardcoded demo sequences. Switching between 2.5D and 3D preserves the same canonical nodes and relationships; selecting a position Recenter-navigates via the existing ChessView path to a corresponding accepted current view. Representative real opening scenarios exercise a broad Line family, deeper continuation, enabled Root/sibling context, and a transposition with one canonical destination and multiple incoming move paths. Automated checks or equivalent inspectable evidence establish that both modes render and navigate without introducing duplicate canonical positions or replacing accepted domain state.

The milestone may instead be resolved with a demonstrated boundary preventing the isolated viewer from consuming real accepted Constellations without violating existing ownership, together with a concrete safe handoff; an unconnected synthetic demo does **not** satisfy completion.
