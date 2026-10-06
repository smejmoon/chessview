# Opening Explorer databases

## Purpose

Define the three Lichess Opening Explorer source populations that Chessview may consume, the names Chessview uses for them, and the source/data-shape peculiarities their clients must preserve.

`LichessGamesDB`, `MastersGamesDB`, and `PlayerGamesDB` are Chessview names for external Lichess datasets/populations. They are not local database implementations and do not describe IndexedDB storage.

This document catalogs source populations and source data. It does not decide which source observations may establish [ChartedGraph](charted-graph.md) topology; graph admission policy belongs elsewhere.

Chessview does not require the three databases to expose one artificially uniform local structure. A client should retain the source facts needed by its consumers while keeping request, cache, freshness, and failure lifecycle separate from those facts.

## LichessGamesDB

**External source:** Lichess Opening Explorer `GET https://explorer.lichess.org/lichess`.

**Official specification:** <https://github.com/lichess-org/api/blob/master/doc/specs/tags/openingexplorer/lichess.yaml>

`LichessGamesDB` is the aggregate population of rated games played on Lichess. It is not a "non-masters" database: master/titled players' rated Lichess games may also belong to this population. The defining property is the Lichess rated-game population.

The endpoint can filter by variant, position/path, speeds, rating groups, and date range. It can return a requested number of common moves plus optional top games, recent games, and history.

Its response data includes:

- optional opening metadata for the source position (`eco`, `name`);
- source-position result counts (`white`, `draws`, `black`);
- returned moves with UCI, SAN, average rating, move-specific result counts, an optional representative game, and optional opening metadata;
- optional top/recent game references and historical result buckets when requested.

Chessview currently requests standard chess for one position, up to 30 returned moves, and the full bounded representative-game payload used by Root bootstrap (up to four top games plus enough recent games for the source's bounded representative set). This is the current primary human-game population used by Chessview.

Chessview's **Explorer Reading** is the data-only source observation exposed from `LichessGamesDB`. A Reading contains source facts; fetch time, freshness/staleness, authentication, request state, and downstream reconciliation/projection state are not elements of the Reading. Optional opening metadata remains part of that source observation only. It is not canonical Nodus identity and is not mirrored onto the top-level position record because one canonical position may be reached through different opening histories. The current implementation persists the validated source value in the position record's Explorer facet and keeps its fetch timestamp separately.

## MastersGamesDB

**External source:** Lichess Opening Explorer `GET https://explorer.lichess.org/masters`.

**Official specification:** <https://github.com/lichess-org/api/blob/master/doc/specs/tags/openingexplorer/masters.yaml>

`MastersGamesDB` is Lichess's master-game population. Its filters differ from `LichessGamesDB`: it supports position/path and year range rather than Lichess speed/rating filters, and it can return common moves plus optional top master games.

Its response data includes:

- optional opening metadata for the source position;
- source-position result counts (`white`, `draws`, `black`);
- returned moves with UCI, SAN, average rating, move-specific result counts, an optional representative master game, and optional opening metadata;
- optional top master-game references.

Chessview currently requests up to 30 moves and no top games. The current client persists this source value as the Masters facet (`mastersExplorer`) with a separate fetch timestamp and uses it as a comparison population for evidence. This document does not require the Masters value to share the exact same local shape as an Explorer Reading.

## PlayerGamesDB

**External source:** Lichess Opening Explorer `GET https://explorer.lichess.org/player`.

**Official specification:** <https://github.com/lichess-org/api/blob/master/doc/specs/tags/openingexplorer/player.yaml>

`PlayerGamesDB` is the game population of one Lichess player. Requests identify the player and the color being studied and may additionally filter by variant, position/path, speeds, rated/casual mode, and date range.

Unlike the other two databases, the player endpoint is an on-demand indexed stream. It responds as newline-delimited JSON, can expose queue/indexing progress, immediately yields the currently indexed result, and may stream newer results until indexing is complete.

Its response data includes:

- optional opening metadata for the source position;
- indexing queue position;
- source-position result counts (`white`, `draws`, `black`);
- returned moves with UCI, SAN, average opponent rating, performance, move-specific result counts, an optional representative game, and optional opening metadata;
- optional recent-game references.

Chessview does not currently consume `PlayerGamesDB`, so it has no current persisted Player-games facet or product data structure. A future client must keep the endpoint's streaming/indexing lifecycle separate from whatever stable data value it exposes to Chessview consumers.

## Source-shape comparison

| Chessview name | Lichess endpoint | Population | Distinctive source behavior | Current Chessview use |
| --- | --- | --- | --- | --- |
| `LichessGamesDB` | `/lichess` | Aggregated rated Lichess games | Rating/speed/date filters; ordinary JSON; optional history/top/recent games | Primary human-game source; Explorer Reading |
| `MastersGamesDB` | `/masters` | Master games | Year filters; ordinary JSON; optional top master games | Comparison population for evidence |
| `PlayerGamesDB` | `/player` | One player's games for one color | Player/color required; rated/casual filters; streamed NDJSON with on-demand indexing | Not yet consumed |

## Client boundary

A database client owns the endpoint-specific request and response contract needed to obtain usable source data. In particular:

- it chooses endpoint-specific request parameters rather than forcing every database through one parameter set;
- it validates the source shape it exposes to Chessview;
- it keeps transport, authentication, streaming/indexing progress, cache freshness, stale fallback, and failure state outside data-only source observations;
- it may retain only source fields needed by Chessview rather than treating the complete wire response as the domain model;
- it does not decide graph admission, Constellation visibility, or semantic evidence meaning merely because those consumers use its data.

Transport serialization and cooldown remain owned by [`LichessGateway`](../architecture/lichess-gateway.md). Shared position-record/facet lifetime remains owned by [`PositionRepository`](../architecture/position-repository.md). Source-specific cache and failure requirements remain in [Lichess access](lichess-access.md).
