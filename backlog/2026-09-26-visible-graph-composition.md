# Do:

Run the deterministic suite on the exact current `vivi` tip through an authoritative Node 24 execution path. If it passes, re-check the published branch preview and run Backlog Close; if it fails, repair the visible-composition or rendering regression it exposes.

# Blocked:

No authoritative deterministic-test execution is currently available for the task-branch tip. `.github/workflows/ci.yml` runs `npm test` on Node 24 for pull requests to `main`, pushes to `main`, or manual dispatch, but the connected GitHub surface in this session does not expose workflow dispatch. The connected remote development device is offline. Pages verifies install/build/publication only and therefore cannot satisfy the deterministic-test gate.

# Because:

`docs/components/position-graph.md` requires one canonical position node with transpositions merged, while `docs/components/interface.md` requires every visible relationship into a convergence to remain legible. Root and Line selection now share the transient composition in `src/visible-graph.js`: canonical visible nodes are budgeted once, graph relationships have stable edge identity, families carry direction-specific presentation state, and convergence remains direction-aware without duplicating persisted graph state.

Line and Root selection retain later relationships into an already-visible canonical position even when the visible-board budget is full. Line first-move `lineShare` is family-owned; a shared relationship can therefore retain several Line families without inventing one scalar share. The compatibility selector array remains only as an iterable node surface for existing board/list consumers; its relationship lookup helper is non-enumerable so it does not alter deterministic value equality.

Presentation now consumes the explicit composition. `src/map-render.js` plans and draws connectors from visible relationships: Root convergence draws every downstream relationship from one canonical board, while Line relationships are rendered per family occurrence so a shared continuation retains each family's inherited width. Paths are keyed by stable relationship identity, which also lets `src/eval-ui.js` decorate connector quality and rarity without relying on SVG/satellite array order.

`src/root-pgn.js` receives the same composition through the view-render event. Root depth, family membership, convergence, visible relationships, move cues, lane layout, and Root rail parentage now come from that projection rather than DOM labels/rendered order or secondary graph lookups. Its remaining incoming-graph reads serve full PGN ancestry and move-order transposition discovery beyond the bounded visible projection, not reconstruction of visible topology.

The exact code tip `c3224c0ceee5c920690f7fd3767be12a037a5fdc` completed the Pages install/build/publish workflow successfully. The branch preview is published under `previews/vivi-548831b7e4aec2af`. This is build/publication evidence, not deterministic-test evidence.

# Edges:

Do not change Line discovery/network behavior or homogenize the distinct Root and Line scheduling policies. `backlog/2026-09-25-browser-composition-boundary.md` continues to own controller lifecycle and settlement. `backlog/2026-09-25-evidence-request-lifetime.md` continues to own evidence request lifetime and coalescing.

The visible projection is transient view state. IndexedDB remains the durable graph owner; the projection stores stable keys, visible relationships, family membership, distance, convergence state, and presentation metadata only.

The shared renderer boundary is intentionally limited to connector planning/drawing. Root-left/Line-right placement and Root family-lane geometry remain direction-specific. No generic family-frontier or broad graph-renderer abstraction is justified by the remaining common mechanics.

Removing the array-compatible selector surface is not required for this outcome: presentation topology no longer depends on its legacy node-owned edge fields, and converting every board/list consumer to a wrapper object would add migration churn without changing visible-graph ownership. Revisit that compatibility surface only if a later consumer needs a non-array contract.

# Complete:

Root and Line selection emit the same explicit visible-graph contract. A canonical position appears once while every visible relationship and family reaching it is retained, including relationships discovered after the canonical board fills the visible-board budget. Board budgeting counts that canonical board once. Convergence state distinguishes true transposition merges from ordinary degree-two continuation, and shared Line relationships retain every family-specific inherited share through family identity.

A shared map-rendering path consumes explicit visible relationships, families, and merge state. Line convergence produces every retained relationship and each family-owned inherited width; Root convergence produces every downstream connector from one canonical board. Root presentation no longer reconstructs visible graph meaning from DOM row depth, labels, rendered order, or graph re-queries whose only purpose is recovering selection-known topology. Evidence decoration follows stable relationship identity rather than path order.

Deterministic coverage includes Line and Root convergence at the saturation boundary, non-merge continuation on both sides, per-family inherited `lineShare`, family propagation through a shared descendant, stable node/edge/family identity, distinct frontier policies, and renderer planning for one canonical board with every converging relationship and shared-family connector width. Before close, that deterministic suite must execute successfully on the exact branch state, and the exact branch build/preview must succeed.

# Steps:

Run `.github/workflows/ci.yml` or an equivalent authoritative Node 24 `npm test` execution against the exact `vivi` tip once such an execution path is available.

If tests pass, confirm the branch preview remains published for that exact state and run Backlog Close. If tests fail, repair the failing behavior, repeat exact-tip deterministic verification and build/preview verification, then close only when `Complete:` is satisfied.

# Sync:

After any implementation or verification step that changes what remains, and before ending an implementation pass, rewrite this entry around the factual work and verification still open; do not accumulate progress history. If `Complete:` is satisfied, run Backlog Close. If Close cannot pass its normal gates, leave the entry open with the blocking condition explicit.
