# Repertoire Lab · Chessview prototype

Experimental, isolated position-first repertoire matching at `prototypes/repertoire-matches/`.
Uses the existing Chessview Lichess OAuth session, canonical-position identity and
LichessGateway. Production Chessview's graph and navigation remain unchanged.

## How it works

1. The signed-in player's **own** rated standard Lichess games are exported
   once (up to 500, filtered to blitz/rapid/classical and the selected history period).
   Only the first 18 plies of each game are parsed. Different move orders reaching
   the same board are merged by canonical position key.
2. The player-facing sample is selected at approximately 8 and 10 plies of
   opening development: **White to move at plies 8 and 10; Black to move at
   plies 7 and 9** (zero-based ply index). At most five frequent positions per
   color/depth qualify, with at least three own games at each position.
   Thus there are at most 20 selected positions total.
3. For each selected position, rated aggregate Opening Explorer is searched
   with rating groups 2200 and 2500, and a month-rounded `since` filter matching
   the UI's history setting (12 months by default). The returned **top and recent
   game references** are only a partial discovery index. Identify strong players
   who were actually the right color at that position; resolve their titled
   accounts and ratings via the bounded authenticated `POST /api/users` request.
   Prefer accounts found at more selected positions, then higher rated accounts.
   **There is no generic leaderboard fallback.**
4. Each selected titled candidate is checked at **up to four positions** using
   the authenticated per-player Opening Explorer. Prefer positions where the
   aggregate Explorer found the account, then diversify by color and frequency.
   Each check reads at most 128 KB and has a 2.2-second overall timeout, including
   gateway queue time. Player Explorer returns an on-demand **NDJSON indexing
   stream**, not a completed lookup with every response. A complete observation
   requires natural stream end and `queuePosition = 0`.
5. Similarity uses Player Explorer's position totals and move frequencies.
   At least three **fully indexed** player games at a position are needed
   before move agreement is reported. Unqueried, timed-out, partially indexed
   and unavailable positions stay **unknown**, never silently zero.
   **No candidate games are downloaded or reconstructed.**

## Understanding scores

Rankings are **conservative evidence scores**, not estimates of lifetime
repertoire likeness. Each selected position is weighted by the signed-in
player's frequency and a small ply-depth adjustment. A candidate's checked
positions with at least three visits contribute position-overlap evidence;
agreement measures the frequency-weighted probability of choosing the same move
from that exact canonical position. Score is 65% confirmed-position weight plus
35% move-agreement weight, divided by **all** selected user-position weight.
Unqueried or incompletely indexed positions supply no positive evidence,
but are not interpreted as player absence.

The UI shows, separately for each color:
- **Checked:** weighted share of selected positions with complete indexing
- **Overlap:** weighted share of *checked* positions with 3+ candidate games
- **Agreement:** weighted move-choice agreement at confirmed positions
- **Count:** indexed positions, confirmed positions and incomplete positions

Because only four positions are checked per candidate, these are **partial
comparisons**. Agreement may be high even when overall evidence is scarce.
A complete zero at a checked position is genuine absence *within the
month-rounded Explorer population*; a partial zero is not.

## Network safety and diagnostics

All application-issued Lichess HTTP requests go through the single shared
`LichessGateway`: authenticated requests use
`LichessSession.authorizedRequest`. Existing serialization, minimum 250 ms
request-start spacing, queued cancellation and full-minute 429 cooldown remain
in force. Unauthorized (401) and rate-limited (429) responses halt discovery
or verification rather than silently manufacturing evidence.

Player Explorer returns up to 12 moves and no recent game references.
The aggregate Explorer returns at most four top and four recent references.
No downloaded candidate game collection exists in this version. Authentication
tokens, raw games and complete move lists are never included in the diagnostic
report.

## Run and share a test

Run `npm ci && npm run dev`, open `/prototypes/repertoire-matches/`, sign in
through the normal Chessview Lichess OAuth flow and select **Find matches**.
Or open the deployed page at
`https://smejmoon.github.io/chessview/prototypes/repertoire-matches/`.

Open collapsed **Diagnostics → Download JSON** or **Copy report**. Share the
`chessview-repertoire-report-YYYY-MM-DD.json` file. The
`schemaVersion` must equal **`repertoire-lab-5`**. The report contains
account names and positions, so review before distributing.

### `repertoire-lab-5` report fields

- `session`: settings, timings, state, initial own-game export counters,
  and recorded failures.
- `own`: accepted/rejected own-game sample, White/Black game totals and
  number of unique canonical positions.
- `openingSeeds`: selected canonical positions, routes, plies and own visits.
- `discoveryBranches`: accounts found, titled, selected, confirmed player
  counts and confirmed position observations per selected position.
- `candidates[]`: titled account and rating, `playerExplorer[]` snapshots
  with status (`complete`, `partial`, `timeout`, `unavailable`),
  queue position, game counts, up to twelve move frequencies and timings,
  `sides` with checked/overlap/agreement, `positions` with evidence
  status (`confirmed`, `rare`, `absent`, `partial`, `timeout`,
  `unavailable`, `not-checked`), and inspectable shared/different choices.
- `events`: timestamped auth, network, discovery, verification and scoring logs.

This design cannot discover every titled player in an opening: aggregate
Explorer exposes only a few representative games, not all accounts.
It also doesn't prove annual repertoire preferences when candidate positions
remain unqueried or incompletely indexed. The month-granularity `since`
filter is approximate relative to the exact timestamp on your own export.

## Verification

`npm test`, `npm run typecheck` and `npm run build` are executed by
Chessview's CI Verify workflow. Test the live OAuth, real Explorer indexing
completion, cancellation, report copying and board inspection in the browser
after deployment.

Official APIs: [aggregate Explorer](https://github.com/lichess-org/api/blob/master/doc/specs/tags/openingexplorer/lichess.yaml),
[player Explorer](https://github.com/lichess-org/api/blob/master/doc/specs/tags/openingexplorer/player.yaml),
[games export](https://lichess.org/api#tag/Games/operation/apiGamesUser).
