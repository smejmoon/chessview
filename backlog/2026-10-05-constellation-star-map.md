# Do:

Explore how ChessView can present a larger coherent Constellation as a mixed board/star map without losing canonical identity, meaningful chess structure, or usable navigation. Compare layout/viewport technology on representative chess graphs before choosing implementation machinery. This is exploratory work, not a renderer rewrite.

# Because:

Full boards consume the space that could show the continuation and breadth of chess. Distinguishing whether a canonical position belongs to the visible graph from whether it deserves a board allows a deeper Line, more siblings, and converging move orders to appear at once.

# Settled direction:

- **One star = one canonical chess position.** Stars are not collapsed branches or summary aggregates; the same canonical position occurs once even when multiple move orders reach it. Connections correspond to actual Graph Edges.
- Keep the playable **Nodus** prominent. Nearby positions normally earn boards, but automatically promote important distant positions to landmark boards when their chess meaning warrants it. The intervening Line can remain stars.
- Landmark choices should respect meaningful alternatives and distinct evidence signals; proximity, play frequency, quality, uncertainty, and structural convergence are not interchangeable. Unknown evidence is not negative evidence.
- Every visible star can be inspected as a **read-only floating telescope** near the hovered star. It may temporarily obscure neighbors; do not move the graph or introduce a broad collision-avoidance system. Prefer simple viewport-edge flipping. The telescope does not play moves or change the Nodus.
- **Click a star to Recenter immediately**; moves are played from the new Nodus. A satellite landmark board remains a Recenter target. The telescope is transient rather than another navigable graph state.
- Favor continuity of surviving nearby positions between Nodus projections over a permanent universal coordinate system. The specific camera motion is not settled.

# Technology evidence:

- [Lens](../docs/components/lens.md) currently derives board-based capacities and places surrounding boards through [presentation-geometry.ts](../src/presentation-geometry.ts). [NodusRenderer](../src/nodus-renderer.ts) uses Chessground for the Nodus and satellite boards and recreates satellites on redraw. [Constellation](../docs/components/constellation.md) remains owner of selected canonical positions and relationships. Replacing the board-capacity-only constraint is a meaningful domain/presentation integration problem, not just adding dot elements.
- The reproducible, **non-production** [Graphviz layout probe](../experiments/star-map/README.md) covers a long forcing Line, broad branches, convergence, upstream Roots and siblings, and a before/after recenter. Layered layout succeeded in arranging mixed-size nodes; on recenter, anchoring one shared node still left other nodes displaced by ~15–99 layout points. Automatic re-layout by itself does not ensure geographic continuity.
- ELK.js and current Dagre are promising **layout** candidates; Dagre now documents dynamic layout support, so it deserves a genuine runtime comparison rather than dismissal as static-only. D3 Zoom can manage the camera independently. Browser Graphviz via WebAssembly is another possible layout engine. Sigma/Cytoscape may bring rendering machinery that existing SVG + DOM does not yet need.
- A generic browser smoke test showed a near-star, pointer-transparent read-only overlay and independent click without graph reflow, but **not** a real Chessground integration. The GitHub Actions experiment successfully installed pinned ELK.js 0.12.0 and Dagre 3.1.1 and ran the same six fixtures. Both preserved all nodes/edges, with zero overlaps or backward directed edges. ELK.js was horizontally more compact in several fixtures; Dagre completed sooner in this single small un-warmed run, which does not support production performance claims. Both moved shared nodes on recenter (up to 100 px with destination anchored). Results, constraints, and the rendered gallery are recorded in the probe report. Realistic graph scale, continuity-preserving options and Chessground integration remain unverified; no library is selected.
- See [probe findings and reproductions](../experiments/star-map/README.md). The experiment does not define a library choice or a new contract.

# Still to explore:

1. **Bigger graph grammar:** how Constellation admits more actual stars with legible connectors, and how many distant nodes are useful rather than mere density. Compare individual stars, faded peripheral stars, and view limits; no aggregate-star shortcut.
2. **Interesting continuation:** compare automatic landmark allocation by proximity baseline, Line-relative significance, tactical/evidence cues, and transposition centrality. Preserve distinct signal meanings and coherent sibling breadth.
3. **Nodus neighborhood:** test Root/sibling placement, separate early Line families, converging paths, and move-order tricks, including whether any family shading adds value beyond connectors/placement.
4. **Technology:** use the verified ELK.js/Dagre baseline to examine continuity-preserving constraints/dynamic layout, family attraction, routed edge legibility, and larger, more realistic chess graphs. Assess browser bundle size and runtime under meaningful graph counts. Then test real Chessground boards alongside SVG stars/edges and a zoom/camera layer. Consider Sigma/Cytoscape or Graphviz WASM only if a measured need emerges.
5. **Movement:** compare quick recenter with modest spatial continuity against camera travel; inspect what retained positions can actually keep stable after changing the Nodus. Preview placement beyond simple nearby/edge-flip behavior need not be optimized in advance.

# Edges:

Do not implement a production renderer, commit to an external API, redefine canonical position identity, or move graph membership into Lens. Constellation owns which positions/Graph Edges constitute the accepted surroundings; Lens owns geometry, presentation constraints, node representation, and preview interaction. Preserve the existing ChartedGraph, Evidence, Current View, and Weather boundaries.

[The existing zoom outcome](2026-10-01-constellation-zoom.md) remains open. Star/board semantic zoom may later reshape it, but this exploration does not replace its contract or close it. First determine a useful visual experience; quantify large-graph loading/rendering only where it changes feasibility.

# Complete:

For each of the five areas, record credible competing approaches, chess examples and meaningful tradeoffs. Compare useful third-party prior art and produce a short synthesis with independently bounded candidate follow-up outcomes. Say explicitly whether the narrower Constellation zoom outcome should remain, split, or change. A production implementation decision is not required.

# Sync:

After any implementation or verification step that changes what remains, and before ending an implementation pass, synchronize this entry using Backlog Tend. Also synchronize when an action completes or becomes unavailable, a blocking condition changes, or a judgment is settled. Rewrite around factual work and verification still open; do not accumulate progress history. If the completion condition is satisfied, run Backlog Close; if Close cannot pass its normal gates, leave the entry open with the blocking condition explicit.
