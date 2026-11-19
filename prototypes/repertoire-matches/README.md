# Repertoire Lab · Chessview prototype

A compact, isolated experiment for discovering **titled Lichess players whose actual games contain the signed-in player's opening branches**. It uses the existing Chessview Lichess OAuth2/PKCE session, `LichessSession`, `LichessGateway`, canonical position identity and chessground. No second login, server, local game database, or production Constellation/Rail change.

## Run and test

Run `npm install && npm run dev` and open `/prototypes/repertoire-matches/`, or use the Pages path `/chessview/prototypes/repertoire-matches/` after successful deployment. Sign in with Lichess and click **Find matches**. Defaults: last 12 months, 12 candidates. Optional samples: 8 or 20 players; history: 6 or 24 months.

The page uses a narrow header and toolbar, dense sidebar results, and a read-only position inspector. Compare **Different choices** or **Common positions**; select a position to see its board and links to the Chessview Nodus and a candidate's Lichess game. Diagnostics stay collapsed by default.

### After every test: transfer evidence

Open **Diagnostics**, then either:

- **Copy report**: paste the JSON into a new ChessView chat.
- **Download JSON**: attach the `chessview-repertoire-report-YYYY-MM-DD.json` file to the chat.
- **Copy log**: fallback to the chronological text trace.

Prefer the structured JSON report. It includes schema version `repertoire-lab-3`, test settings and timestamps, account name, bounded game-export counters and byte sizes, skipped-game reasons, color-specific sample sizes, frequent opening seeds, candidate discovery sources/branch hits, branch-by-branch user/candidate game counts, evidence status, supported positions, scored positions, disagreements, failed calls, and chronological log events. The report contains **no OAuth tokens, raw game export or full move histories**. It **does** contain account names, canonical positions, and opening routes; review before sharing.

For quality feedback, describe which displayed opening similarities are relevant or misleading and whether player matches differ between White and Black.

## Discovery

1. Export up to 500 recent rated standard blitz/rapid/classical games from the logged-in account.
2. Parse the opening prefix (first **18 plies**) into White and Black choices, including White's first move and Black's first response. Reject malformed games transactionally, accounting for a specific skip reason. Canonical positions merge transpositions.
3. Choose up to **four frequent opening-position seeds per color**, at plies 4–11, diversifying the first four move plies when possible.
4. Query the rated Lichess Opening Explorer at each seed, restricted to rating groups 2200 and 2500, and take up to four top and eight recent game references per position. Find players of the matching color from those games. Resolve candidate titles/current profiles in a bounded `POST /api/users` call (Explorer titles are a fallback when lookup fails). Prefer candidates who appear across more selected opening branches.
5. Only if that pool is insufficient, fill from titled 2200+ Lichess blitz/rapid/classical leaderboards, explicitly marking such candidates as **Leaderboard fallback**.
6. Export up to **140 recent games** per selected candidate and compare them to the user's sampled position choices. Candidate sampling is intentionally smaller than in v1 to reduce download time, at the expense of statistical confidence.

The user export and player exports honor the local sample limit even if the API returns extra records. The difference between requested, received and used records is logged as `overflow`. No entire game list is persisted.

## Ranking and interpretation

- Opening branches are the selected frequent canonical positions (up to four per color). Each sampled game belongs to its **deepest reached** selected branch, preventing double counting. Transpositions converge by canonical position identity. Positions before the branch root, including universal first moves, are excluded.
- **Coverage** is the fraction of the user's weighted decisions at or after that branch root also observed with at least three candidate visits. **Agreement** is the probability of the same move on those supported positions.
- Branch percentages require at least three candidate games reaching the branch and two user games. Otherwise the UI shows **Sparse sample** or **Not observed**, not an invented zero or a precise agreement.
- Per-color score weights confirmed branch coverage and agreement at 65%/35% by the user's branch game counts. Unconfirmed branches contribute no evidence, but retain their weight in the displayed score if other branches are confirmed. A side with no confirmed branches displays **—**. Combined score uses both sides. These are sample scores, not lifetime-repertoire probabilities.
- Sidebar rank uses the **better of White or Black scores**, clearly marked `best side`; the main panel shows both separate scores, coverage, agreement, and game counts.
- **Different choices** highlights shared positions where the players' most frequent moves differ, while **Common positions** shows their highest-weight overlaps.

This is descriptive overlap from **samples**, not an evaluation of move quality, chess strength, or lifetime opening preference. Matching an early position does not imply matching an entire named opening. Sparse seeds, inactive master accounts, and missing representative games can limit discovery. Lichess Opening Explorer's game arrays are partial references, not an exhaustive candidate index. Historical over-the-board grandmasters are not covered.

## Network and diagnostics policy

All application-issued Lichess HTTP requests pass through the shared `LichessGateway`: game exports, user-profile lookup **and Opening Explorer discovery** use `LichessSession.authorizedRequest` to attach the current Lichess Bearer token; public leaderboards use the gateway directly. Earlier versions inadvertently sent unauthenticated Opening Explorer requests and failed with HTTP 401. The existing global one-request-at-a-time queue, voluntary >=250 ms spacing, background urgency, obsolete-request cancellation and 429 full-minute cooldown apply.

A nonfatal Explorer/leaderboard failure appears in the report; 401/429 stops discovery. A candidate export failure is recorded but doesn't invent a zero-score match. Cancelling a run preserves the report and completed results.

Logging is intentionally verbose but kept out of the main page. The console mirrors events and the downloadable report retains up to 700 events; the expanded on-page log displays the latest 160. No auth tokens or full game text are logged.

## Verification

- `npm test`: deterministic matcher tests for first moves, both colors, actual opening seeds, rejected-game reasons, disagreements, transpositions and empty profiles.
- `npm run typecheck`: includes prototype TypeScript through the existing `tsconfig.json`.
- `npm run build`: retains the dedicated Vite HTML entry.
- Browser checks: OAuth callback and reuse; title lookup and possible CORS failure; different opening seeds; selecting candidates while new results arrive; position orientation; report copy/download; cancellation and 429.

This is still an **experimental prototype**. It does not change production Chessview navigation, graph admission rules, or persistent chess evidence.

External API specifications: [game export](https://lichess.org/api#tag/Games/operation/apiGamesUser), [Opening Explorer](https://github.com/lichess-org/api/blob/master/doc/specs/tags/openingexplorer/lichess.yaml), [batch user lookup](https://github.com/lichess-org/api/blob/master/doc/specs/tags/users/api-users.yaml).

### Report schema `repertoire-lab-3`

`openingSeeds` identifies the canonical branch roots. Each `candidates[].branches[]` entry contains `side`, `key`, `route`, `userGames`, `candidateGames`, `candidateSideGames`, `userPositions`, `observedPositions`, `supportedPositions`, `evidence` (`confirmed`, `sparse`, `not-observed`), nullable `coverage`, `agreement`, `score`, and up to eight supporting `choices`. `candidates[].sides` summarizes each color. Null means insufficient evidence; zero means observed but no supported coverage. Counts are from bounded recent-game exports and are not lifetime claims.
