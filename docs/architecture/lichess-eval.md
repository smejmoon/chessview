# LichessEval

## Purpose

`LichessEval` is Chessview's application boundary for obtaining usable Lichess cloud evaluations for canonical positions.

Callers ask whether usable engine data is already available or ask the provider to obtain it. They do not decide whether that data should come from persistence, a fresh Lichess request, or a stale fallback.

## Responsibilities

`LichessEval` owns the source-facing quality and acquisition contract for Lichess cloud evaluation:

- canonical-position lookup for the cloud-eval facet;
- cloud-eval endpoint parameters and response parsing;
- source-payload validation;
- the minimum depth required before a cloud evaluation is exposed to the rest of Chessview;
- persistence fields and cache freshness policy;
- deciding whether an existing cached value is usable;
- deciding when a Lichess refresh is required;
- stale usable fallback when refresh fails or returns insufficient data;
- successful cloud-eval absence such as HTTP `404`;
- transport, HTTP, rate-limit, malformed-response, insufficient-source-data, and local-cache issues;
- shared per-position request lifetime through `PositionRepository`;
- routing every application-issued Lichess request through `LichessGateway`;
- aggregate operational status for Interface diagnostics and user-visible source activity.

The current minimum usable cloud-eval depth is `18`. A value below that threshold may be retained according to provider cache policy, but it is not exposed as a usable evaluation.

## Consumer API

`available(position)` returns an already stored usable evaluation or `null`. It never starts Lichess acquisition. This exists for callers such as initial Constellation composition that may use existing engine knowledge but must not make engine acquisition relevant merely by inspecting a candidate.

`get(position, { signal })` returns a usable evaluation or `null`. Once a caller has decided engine information is worth obtaining, `LichessEval` owns whether the result comes from current persistence, refresh, or stale fallback. The optional `AbortSignal` represents that caller's continued interest; shared producer lifetime remains owned by `PositionRepository`.

Neither method exposes freshness, cache age, request-failure sentinels, HTTP status, or retrieval strategy as evaluation data.

A valid usable Lichess response remains usable even if updating local persistence fails. In that case `get()` returns the source value and the operational channel reports a local-cache issue. Failure to persist successful absence likewise remains a cache issue rather than being reclassified as a Lichess transport failure.

`subscribe(listener)` publishes aggregate operational status separately from evaluation data. Status currently has:

- `activity`: `idle` or `requesting`;
- `pending`: count of provider requests currently participating in Lichess acquisition;
- `issue`: the provider issue reported by the most recently completed request, or `null` when that completion reported no issue.

Starting another request does not define a current-view batch or clear the prior completed outcome. Each request completion replaces `issue` with its own outcome. Status is source-operational rather than current-view state, so callers must not infer Nodus-generation settlement or per-view evidence completeness from it.

Issue kinds are `network`, `service`, `rate-limited`, `invalid-data`, `insufficient-data`, `refresh-failed`, and `storage`. An issue may report `fallback: 'cached'` when the provider still returned usable cached evaluation. Operational issues are diagnostics/source activity, not engine evidence.

## Boundary with Evidence

`LichessEval` decides whether Lichess cloud data is fit to provide. [Evidence](../components/evidence.md) decides what provided engine data means in chess terms.

`LichessEval` therefore does not own centipawn loss versus the best move, strong/dubious/bad quality, human/engine mismatch, Constellation rescue, Rail eligibility, connector treatment, or Weather settlement.

Missing provider output remains unknown to Evidence. A provider issue must never be converted into negative chess evidence.

## Boundary with LichessGateway and PositionRepository

`LichessGateway` owns application-wide HTTP scheduling and cooldown policy. `LichessEval` owns cloud-eval-specific request construction and interpretation of the source response.

`PositionRepository` owns canonical position records and shared per-facet producer lifetime. `LichessEval` owns the `cloudEval` and `cloudEvalFetchedAt` facet meaning and cache policy rather than exposing those persistence fields as a public evaluation API. Repository write failure is propagated to `LichessEval`, which decides whether source data can still be returned and how the local-cache issue is reported operationally.

## UX contract

Normal chess presentation consumes only usable evaluation or absence. Retrieval details must not be encoded as properties of individual moves.

Interface subscribes to operational status and renders it through the Lichess source indicator. Active acquisition is visibly distinct from idle source labeling, and provider issues such as rate limiting, network/service failure, unusable source data, local-cache failure, or a failed refresh are surfaced as source status rather than chess evidence. A usable cached fallback remains usable chess data while the operational channel can simultaneously report that refresh failed.

The source indicator reports provider activity and the most recently completed request outcome. It does not summarize every evaluation needed by the current Nodus and does not define a current-view generation.

Status rendering is observational: presentation failure must not interrupt acquisition or corrupt provider request state.

The operational indicator is independent from Weather. Supplementary engine acquisition must not make Weather unsettled merely because `LichessEval` is requesting or reporting an issue; Weather changes only when the caller has made that acquisition a structural dependency.
