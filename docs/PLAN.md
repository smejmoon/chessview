# Chessview v1 — goals, requirements, and plan

## Goal

Build a static, browser-only chess opening explorer where a canonical chess position is the center of a spatial graph and nearby positions are rendered as smaller chessboards. The map should make continuations, known incoming positions, siblings/cousins, and transpositions visually understandable without turning the experience into a move-list dashboard.

## Product requirements

- Large playable central Chessground board.
- Miniature Chessground boards for navigation only.
- Rated standard Lichess Opening Explorer is the statistical source.
- No engine analysis in v1.
- Graph nodes are canonical chess positions; every edge is exactly one legal move.
- Position identity includes pieces, side to move, castling rights, and only relevant en-passant state; halfmove/fullmove counters are ignored.
- Transpositions merge into the same node.
- Automatic expansion follows moves with >= 5% of games at their immediate source position.
- Automatic expansion stops on very small samples using one easily tunable sample-floor constant.
- Sub-5% moves are aggregated into an "other moves" share rather than expanded.
- No arbitrary opening-depth cap; the practical bound is the local visible-board budget and sample floor.
- Visible neighborhood uses a branch-balanced selection with a desktop maximum of 19 surrounding boards and smaller responsive budgets.
- Known incoming nodes bias upward; outgoing nodes bias downward; siblings/cousins/transpositions can sit laterally.
- Clicking a miniature board recenters immediately.
- Playing a legal move on the center recenters even when that move is below the auto-expansion threshold.
- All visible boards share one global orientation with a flip control.
- URL identifies the current position, not the path used to reach it.
- Discovered graph data persists in IndexedDB.
- Static production build deploys to GitHub Pages.

## Technical choices

- Vite + vanilla ES modules keeps the UI small and static.
- `chess.js` owns legal move generation and FEN handling.
- `chessground` renders the playable center board and navigation mini-boards.
- IndexedDB stores nodes, edges, and explorer metadata.
- The browser calls `https://explorer.lichess.ovh/lichess` directly.
- GitHub Actions builds and deploys `dist/` to GitHub Pages.

## Graph discovery model

1. Load/recover the center position from the URL.
2. Merge the center into IndexedDB by canonical position key.
3. Fetch Opening Explorer statistics for the center when stale/missing.
4. Add legal explorer continuations as graph edges, merging child positions by canonical key.
5. Mark moves >= 5% as auto-expandable when the source sample is >= the configured sample floor.
6. Recursively inspect qualifying branches only while useful slots remain. This keeps the rule local to each source position rather than cumulative from the center.
7. Build the visible neighborhood from:
   - known incoming positions,
   - branch-balanced outgoing continuations,
   - useful deeper descendants,
   - siblings/cousins reachable through known parents,
   - merged transpositions already discovered.
8. Render a layered directional map and keep stable branch ordering from persisted/local layout hints.

## Branch-balanced selection

- Reserve some budget for known incoming context.
- Give each qualifying first-level outgoing branch a fair first slot before spending extra capacity deeper.
- Spend remaining capacity round-robin across branches, preferring narrow qualifying continuations before adding excessive breadth from one bushy branch.
- Keep selection deterministic by stable move/key ordering so branches do not randomly swap sides after recentering.

## Tunable v1 constants

- Automatic move threshold: `0.05`.
- Automatic expansion sample floor: initially `80` games.
- Surrounding-board budget: responsive, capped at `19`.
- Explorer cache TTL: 24 hours.

These are implementation constants rather than product commitments, except for the 5% local threshold.

## Test plan

Deterministic unit tests cover:

- canonical FEN identity and ignored counters;
- relevant vs irrelevant en-passant identity;
- transposition merge behavior;
- local 5% qualification;
- branch-balanced selection determinism and capacity limits;
- URL round-tripping.

Manual/real-data verification should include:

- a broad opening such as the initial position / common king-pawn openings;
- a narrow forcing line where local percentages stay high at successive nodes;
- a practical transposition, e.g. positions reachable by different move orders in common Indian/English structures.

## Delivery sequence

1. Establish project/build/deploy scaffolding.
2. Implement canonical chess-state and graph persistence primitives.
3. Implement Lichess explorer client and progressive graph discovery.
4. Implement branch-balanced neighborhood selection.
5. Build Chessground center-board interaction and mini-board navigation.
6. Add directional spatial layout, edges, labels, omitted-share annotation, orientation control, responsive sizing, and transitions.
7. Add deterministic tests.
8. Verify production build through CI and adjust any build/runtime issues.
