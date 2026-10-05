# Do:

Explore how ChessView could make Constellation feel more like a star map: show more chess structure than fits as full boards, make important places to look visually obvious, keep the Nodus surroundings understandable, reuse mature graph/visualization machinery where it helps, and make movement through the graph feel spatial rather than like loading separate diagrams.

Brainstorm several plausible directions for each question below, compare their UX and architectural tradeoffs, use concrete chess examples such as deep Lines, broad branches, transpositions, Roots, siblings, and move-order tricks, and inspect relevant prior art or third-party libraries where useful. The outcome of this entry is ideas for later work, not implementation here.

# Because:

The current Constellation can only show as much structure as can be rendered as boards. A star-map style could separate "this position belongs in the visible chess around the Nodus" from "this position deserves a full board right now": important positions may stay as boards while farther or lower-priority positions appear as stars or dots connected by subtler edges.

That may let users perceive the shape of chess before opening every position: whether a Line keeps going, a position is broad or forcing, several routes converge into a transposition, or move-order context branches away and later rejoins. The metaphor should guide information design rather than add decorative space styling.

# Unsettled:

1. **How should we show a much bigger chess graph without turning everything into boards?**

   Explore a visual grammar for full boards, smaller boards, stars/dots, faint distant positions, labels, and strong or subtle edges. Ask how much farther in breadth and depth the visible Constellation can extend while its shape still reads quickly. A forcing Line might continue as stars past the last board; a broad position might fan into many lightweight points instead of ending abruptly at board capacity.

2. **How should the map show where interesting chess continues?**

   Explore visual cues for "look here next" without collapsing different meanings into one signal. A position may be interesting because it is Notable, heavily played, tactically sharp, uncertain, transpositional, or because a rich subtree continues behind it. Consider what the chess equivalent of a bright star is, and keep popularity, evaluation, structural importance, and uncertainty distinguishable where that matters.

3. **How should the immediate surroundings of the Nodus be represented?**

   Explore the local visual grammar for Lines, deeper continuations, Root context, siblings, families/asterisms, and transpositions. Consider whether families need any explicit decoration or whether placement plus connecting paths are enough; how Roots and siblings explain move-order tricks; how convergence should look; and how the Nodus keeps visual priority without forcing a rigid left/right or lattice layout.

4. **Can third-party graph or star-map libraries solve the generic spatial problems while ChessView supplies the chess semantics?**

   Investigate libraries or engines for force-directed or hierarchical graphs, semantic zoom, collision avoidance, pan/zoom, spatial indexing, stable transitions, and custom rich nodes. Explore whether Chessground boards can be overlaid or embedded as custom nodes while the library handles geometry and motion. Prefer experiments that reveal what constraints ChessView actually needs—such as Nodus stability, past/future bias, family attraction, readable boards, and transposition convergence—before committing to a library or maintaining more custom layout code.

5. **How should users travel through the Constellation?**

   Explore recentering, hover inspection, semantic zoom, and spatial continuity. A star might open a full-board "telescope" preview without reflow; clicking it could promote that position into the Nodus; zooming out could reveal more stars while zooming in promotes stars into boards. Ask whether surviving positions can keep approximate spatial continuity so following a Line feels like moving through one chess sky rather than replacing one diagram with another.

# Edges:

This entry is exploratory. Do not choose production APIs, rewrite Constellation ownership, or implement a new renderer merely to make the exploration concrete. Constellation continues to own which canonical positions and relationships belong in the current surroundings; Interface owns how those selected positions are represented and placed.

`backlog/2026-10-01-constellation-zoom.md` is a narrower existing outcome about trading board scale for coverage. This exploration may later suggest rewriting, splitting, or replacing parts of that outcome—for example if semantic zoom becomes board-to-star promotion rather than only board resizing—but it does not implement or close zoom now.

Performance and loading of very large graphs are relevant when they change feasibility, but they are not the primary question yet. First determine what experience is worth building; later work can size the technical problem against the intended number of boards, stars, edges, labels, and transitions.

# Complete:

For each of the five questions, record multiple credible approaches with the important UX and architectural tradeoffs, concrete chess examples, and useful prior art or library findings where applicable. End with a short synthesis of the strongest product ideas and a set of clearly bounded candidate follow-up outcomes that can be tracked independently. Also state how those ideas affect the existing Constellation zoom outcome, if at all.

No implementation decision is required for this entry to complete; it succeeds when the exploration is rich enough to generate well-shaped later work rather than one prematurely chosen design.

# Sync:

After any implementation or verification step that changes what remains, and before ending an implementation pass, synchronize this entry. Also synchronize when an action completes or becomes unavailable, a blocking condition changes, or a judgment is settled. Rewrite around the factual work and verification still open; do not accumulate progress history. If an outcome's completion condition is satisfied, run Backlog Close for that outcome. If Close cannot pass its normal gates, leave the entry open with the blocking condition explicit.
