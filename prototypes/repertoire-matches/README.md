# Repertoire Lab · Chessview prototype

A **separate experimental page** for identifying titled Lichess players whose real opening choices overlap the currently logged-in player's repertoire.

## Use

Run `npm install && npm run dev` and visit `/prototypes/repertoire-matches/`, or open the deployed path `/chessview/prototypes/repertoire-matches/`. It uses Chessview's existing Lichess OAuth2/PKCE login, including the same session token; it does not implement a second authentication system. Press **Find similar players** after signing in.

Choose a recent-history window (6, 12 or 24 months) and cohort size (8, 16 or 30). The prototype exports up to 500 of the signed-in player's and 250 of each candidate's recent rated standard blitz/rapid/classical games, then builds separate White and Black opening profiles. Game exports are bounded to 3 MB each. Only the first 24 plies are analyzed; position choices begin at ply 2. A position is counted once per game per color. Broken or unsupported games are skipped. No personal game library is persisted.

Candidate discovery samples three Lichess top-100 leaderboards (blitz, rapid, classical), round-robins them, and keeps titled GM/WGM/IM/WIM/FM/WFM accounts rated 2200+ in the leaderboard discipline. The result is a **sample of strong Lichess players**, not a comprehensive grandmaster database. Candidates without available analyzed games are not ranked. The system reports coverage/decision agreement and sample sizes, rather than claiming a precise personality match.

## Meaning of the score

For each player color, compare the user's canonical positions where they made opening decisions with the candidate's sampled positions of that same color. Transpositions unify naturally because the same `canonicalPosition` identity is used. Each user position receives `ownVisits × depthWeight`, where the depth weight rises from 1 to 3.5 across the opening.

- **Coverage** = weighted user positions also observed in the candidate's repertoire / all weighted user positions.
- **Agreement** = at covered positions, the probability that independently sampled moves from the two players coincide, weighted by the user's visits and depth.
- **Similarity** = 70% coverage plus 30% covered-weighted move agreement, both relative to all user position weight.

The top shared positions link to Chessview by canonical FEN and to a real Lichess game showing the candidate's most common observed move. The board preview is read-only. Scores depend on sample size, player activity, and cohort selection, and must **not** be interpreted as precise estimates of lifetime repertoire similarity. The data describes sampled games only, not opening preparation or optimal play.

## Data and network boundaries

Every Lichess application request uses the existing `LichessGateway` (account/game exports through `LichessSession.authorizedRequest`; public leaderboards directly through the gateway). The existing request serialization, request spacing, priority, cancellation and shared HTTP 429 cooldown still apply. No application-issued requests bypass the gateway. OAuth navigation is the existing browser handoff.

Leaderboard failures are recorded and non-fatal unless the API indicates 401/429. Per-player export failures are shown as diagnostics, not zero games or zero overlap. HTTP 429 stops the comparison rather than enqueuing more calls behind a long cooldown. Cancel stops subsequent requests and preserves the matches that already finished.

Activity logs show account name, requested player names, HTTP statuses, durations, progress, accepted/rejected game counts, position counts, and scores. They are visible on the page and in the browser console. They never contain authentication tokens or full game text. A user may copy or clear the log.

## Validation

- `npm test` includes deterministic repertoire comparison tests.
- `npm run typecheck` includes all prototype TypeScript.
- `npm run build` emits a dedicated Vite HTML entry.
- Manual browser validation: OAuth callback and reuse, mixed-color user samples, comparing candidates, board inspector, transposition links, cancellation, and 401/429/network failures.

This prototype is read-only and does **not** modify the production Constellation, Rail, opening data cache, graph store, or top bar. There is no production navigation link yet.

API references:
- [User game export](https://lichess.org/api#tag/Games/operation/apiGamesUser)
- [Lichess leaderboard](https://lichess.org/api#tag/Users/operation/playerTopNbPerfType)
- [Lichess account](https://lichess.org/api#tag/Account/operation/accountMe)
