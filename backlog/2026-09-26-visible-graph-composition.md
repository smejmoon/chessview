# Do:

Finish the visible-graph composition refactor by moving Root and Line presentation onto the explicit node/relationship/family projection now emitted by both selectors.

# Because:

`docs/components/position-graph.md` requires one canonical position node with transpositions merged, while `docs/components/interface.md` requires every visible relationship into a convergence to remain legible. Selection has one shared transient composition model in `src/visible-graph.js`: canonical visible nodes are budgeted once, graph relationships have stable edge identity, and families carry direction-specific presentation state without duplicating persisted graph state.

Line and Root selection retain later relationships into an already-visible canonical position even when the visible-board budget is full. Reaching the budget prevents only creation of another canonical board; zero-cost relationship and family merges into an existing board continue. Per-family first-move `lineShare` remains on the visible relationship/family projection, while Root shallow-first and Line `depth + breadth` scheduling remain distinct.

Presentation has not yet been migrated. `src/main.js` still renders connectors from one node-owned `edge`, so a converged Line board can have all relationships in the explicit projection while the map still draws only one of them. `src/root-pgn.js` still reconstructs Root topology from rendered DOM depth/labels and secondary graph lookups.

# Edges:

Do not change Line discovery/network behavior or homogenize the distinct Root and Line scheduling policies. `backlog/2026-09-25-browser-composition-boundary.md` continues to own controller lifecycle and settlement. `backlog/2026-09-25-evidence-request-lifetime.md` continues to own evidence request lifetime and coalescing.

The visible projection is transient view state. IndexedDB remains the durable graph owner; the projection stores stable keys, visible relationships, family membership, distance, merge state, and presentation metadata only.

# Unsettled:

Choose the smallest renderer boundary that consumes `nodes`, `relationships`, and `families` directly while retaining direction-specific Root-left/Line-right and family-lane geometry.

Decide whether the temporary array-compatible selector result should disappear once all board/layout consumers use the explicit projection fields directly.

A generic family-frontier abstraction remains unearned unless common mechanics are still evident after rendering is migrated; do not generalize scheduling merely for symmetry.

# Complete:

Root and Line selection emit the same explicit visible-graph contract. A canonical position appears once while every visible relationship and family reaching it is retained, including relationships discovered after the canonical board fills the visible-board budget. Board budgeting counts that canonical board once. Deterministic tests cover Line and Root convergence at the saturation boundary, per-family inherited `lineShare`, family propagation through a shared descendant, stable node/edge/family identity, and the distinct frontier policies.

A shared map-rendering path consumes explicit visible nodes, relationships, families, and merge state; Line convergence visibly draws every retained connector; Root presentation no longer reconstructs graph meaning from DOM row depth, labels, rendered order, or secondary graph lookups that exist only to recover selection-known topology. Rendering tests cover one canonical board with every visible relationship, and the current branch's deterministic test/build verification succeeds before close.

# Steps:

Refactor `src/main.js` connector rendering to iterate explicit visible relationships rather than one node-owned edge, preserving per-family Line width.

Pass the explicit composition into Root presentation and remove DOM-derived relationship/depth/family reconstruction and graph re-queries that only recover selection-known topology.

Extract only the common board/connector/merge/navigation rendering that remains after direction-specific layout is preserved.

Add deterministic rendering coverage for Line and Root convergence, run the deterministic suite and build on the resulting branch, and verify the preview. If all completion conditions are satisfied, run Backlog Close.

# Sync:

After any implementation or verification step that changes what remains, and before ending an implementation pass, rewrite this entry around the factual work and verification still open; do not accumulate progress history. If `Complete:` is satisfied, run Backlog Close. If Close cannot pass its normal gates, leave the entry open with the blocking condition explicit.
