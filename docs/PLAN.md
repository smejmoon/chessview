# Chessview v1 — goals, requirements, and plan

## Goal

Build a static, browser-only chess opening explorer where a canonical chess position is the center of a spatial graph and nearby positions are rendered as smaller chessboards. The map should make continuations, known incoming positions, siblings/cousins, and transpositions visually understandable without turning the experience into a move-list dashboard.

## Product terminology

Chessview uses **Roots** and **Lines** as the canonical user-facing terms for the two directions around the current position:

- **Root** — a known position that reaches the current position by one legal move. A position may have multiple Roots when different move orders transpose into the same canonical position. When ancestry is expanded, the **Roots** view includes the upstream move-order tree feeding those immediate Roots.
- **Line** — a known position reached from the current position by one legal move. Deeper continuation positions belong to that Line as it extends forward.
- **Roots** therefore answer **“How can this position be reached?”**
- **Lines** answer **“Where can play go from here?”**

These are product/UI terms. Implementation code may still use graph terms such as `incoming` / `outgoing`, `source` / `target`, and predecessor / successor where those are clearer technically.

The right-side control and evidence surface is the **Rail**.

## Product requirements

- Large playable central Chessground board.
- Miniature Chessground boards for navigation only.
- Rated standard Lichess Opening Explorer is the primary human-statistical source; Masters data is used as a separate comparison population.
- Live Explorer access uses the visitor's Lichess authorization through browser OAuth2 Authorization Code + PKCE; no client secret or personal token is shipped in the static bundle.
- Cached Lichess cloud evaluations enrich visible positions when adequate-depth data is available. The central position shows absolute evaluation; Root/Line moves show pawn loss versus the best move instead.
- Move-quality display uses one engine grammar: under 0.5 pawn loss is strong, 0.5–1.0 is dubious, and 1.0+ is bad. Human-result markers appear only when Masters or Lichess results materially disagree with that engine signal.
- The Rail keeps sufficiently sampled plausible moves even when unpopular. Bad moves are normally suppressed, but popular mistakes above 5% remain selectable.
- Root rarity is a separate, non-color signal. With meaningful human evidence, Root moves below 5% are marked rare and below 1% very rare; rarity is not inferred from synthetic/manual zero-share edges or tiny source samples.
- Graph nodes are canonical chess positions; every edge is exactly one legal move.
- Position identity includes pieces, side to move, castling rights, and only relevant en-passant state; halfmove/fullmove counters are ignored.
- Transpositions merge into the same node.
- Automatic expansion follows moves with >= 5% of games at their immediate source position.
- Automatic expansion stops on very small samples using one easily tunable sample-floor constant.
- Sub-5% moves are aggregated into an "other moves" share rather than expanded automatically.
- No arbitrary opening-depth cap; the practical bound is the local visible-board budget and sample floor.
- Visible neighborhood uses a branch-balanced selection with a desktop maximum of 19 surrounding boards and smaller responsive budgets.
- Roots provide incoming context; Lines provide forward continuations; siblings/cousins/transpositions can sit laterally.
- Root boards sit to the left of the current position; Line boards sit to the right. Root move cues point toward the current position, while Line move cues show the move that produced the displayed child position.
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
- IndexedDB stores nodes, edges, explorer metadata, Masters data, and cached cloud evaluations.
- The browser authenticates with Lichess using OAuth2 Authorization Code + PKCE and calls `https://explorer.lichess.org/lichess` with the resulting bearer token.
- OAuth callback parameters and PKCE transaction state are consumed on both success and terminal callback failure so a reload can start a clean sign-in.
- Explorer network requests are globally serialized. After HTTP 429, all new Explorer requests pause for at least 60 seconds before resuming; obsolete discovery work is cancelled when the viewed center changes.
- GitHub Actions builds and deploys `dist/` to GitHub Pages.

## Graph discovery model

1. Load/recover the center position from the URL.
2. Merge the center into IndexedDB by canonical position key.
3. Complete or initiate the visitor's Lichess OAuth2 PKCE authorization when no usable access token exists.
4. Fetch Opening Explorer statistics for the center when stale/missing through the global serialized request gate.
5. Reconcile the source position's Explorer-derived edge set against the latest response, deleting stale automatic edges while preserving explicitly explored/manual edges.
6. Add legal explorer continuations as graph edges, merging child positions by canonical key.
7. Mark moves >= 5% as auto-expandable when the source sample is >= the configured sample floor.
8. Recursively inspect qualifying branches only while useful slots remain. This keeps the rule local to each source position rather than cumulative from the center.
9. Stop obsolete discovery when the user recenters. If Lichess returns HTTP 429, stop branch discovery and hold all subsequent Explorer network traffic for at least one minute.
10. Build the visible neighborhood from:
   - known Roots (incoming positions),
   - branch-balanced Lines (outgoing continuations),
   - useful deeper Line descendants,
   - siblings/cousins reachable through known Roots,
   - merged transpositions already discovered.
11. Render a layered directional map and keep stable branch ordering from persisted/local layout hints.

## Branch-balanced selection

- Reserve some budget for known Root context.
- Give each qualifying first-level Line a fair first slot before spending extra capacity deeper.
- Spend remaining capacity round-robin across Lines, preferring narrow qualifying continuations before adding excessive breadth from one bushy branch.
- Keep selection deterministic by stable move/key ordering so Lines do not randomly swap sides after recentering.

## Tunable v1 constants

- Automatic move threshold: `0.05`.
- Automatic expansion sample floor: initially `80` games.
- Rail human-sample floor: `100` games.
- Engine display minimum depth: `18`.
- Dubious-move threshold: `0.5` pawn loss.
- Bad-move threshold: `1.0` pawn loss.
- Popular-bad Rail retention threshold: `0.05`.
- Rare Root threshold: below `0.05` of games at the immediate source position.
- Very-rare Root threshold: below `0.01`, only with a meaningful source sample and observed move games.
- Surrounding-board budget: responsive, capped at `19`.
- Explorer cache TTL: 24 hours.
- Eval/Masters cache TTL: 7 days.
- Explorer 429 cooldown: at least 60 seconds.

These are implementation constants rather than product commitments, except for the 5% local automatic-expansion threshold and the established visual semantics where the UI depends on them. The request-serialization and 429 cooldown behavior follows Lichess API requirements rather than product tuning.

## Test plan

Deterministic unit tests cover:

- canonical FEN identity and ignored counters;
- relevant vs irrelevant en-passant identity;
- transposition merge behavior;
- local 5% qualification;
- branch-balanced selection determinism and capacity limits;
- URL round-tripping;
- OAuth callback success and terminal-failure cleanup;
- expired-token / HTTP 401 handling;
- global Explorer request serialization and 60-second 429 cooldown;
- cancellation of stale discovery work;
- Explorer edge reconciliation, including stale automatic-edge removal and manual-edge preservation;
- move-quality thresholds and minimum eval depth;
- Rail-worthy filtering and human-result mismatch behavior;
- Root rarity thresholds and evidence gating.

Manual/real-data verification should include:

- a broad opening such as the initial position / common king-pawn openings;
- a narrow forcing line where local percentages stay high at successive nodes;
- a practical transposition, e.g. positions reachable by different move orders in common Indian/English structures;
- a position with both common and rare Root move orders so rarity markings can be checked against Explorer evidence;
- an authenticated fresh browser session and an expired/revoked authorization session;
- real navigation after a rate-limit response to confirm the UI remains usable from cached data during cooldown.

## Delivery sequence

1. Establish project/build/deploy scaffolding.
2. Implement canonical chess-state and graph persistence primitives.
3. Implement Lichess OAuth2 PKCE authorization, Explorer client, request pacing, and progressive graph discovery.
4. Implement branch-balanced neighborhood selection.
5. Build Chessground center-board interaction and mini-board navigation.
6. Add directional spatial layout, edges, labels, omitted-share annotation, orientation control, responsive sizing, and transitions.
7. Add deterministic tests for graph, auth, persistence, Explorer request-control, and evidence-layer behavior.
8. Verify production build through CI and adjust any build/runtime issues.
