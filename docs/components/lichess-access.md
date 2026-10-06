# Lichess access

## Purpose

Own authentication, endpoint access, shared request policy, endpoint caches, and transport/failure semantics for Chessview's Lichess-backed data.

The architectural dependency boundary is defined separately in [`docs/architecture/lichess-gateway.md`](../architecture/lichess-gateway.md). Canonical position record and shared facet lifetime are defined in [`docs/architecture/position-repository.md`](../architecture/position-repository.md). Cloud-evaluation source usability is defined in [`docs/architecture/lichess-eval.md`](../architecture/lichess-eval.md). Opening Explorer source populations and their source-data peculiarities are cataloged in [Opening Explorer databases](opening-explorer-databases.md). This component owns the observable request-policy requirements those boundaries must enforce.

## Data sources

- `LichessGamesDB` is the aggregated rated-Lichess Opening Explorer population and the current primary human-statistical source.
- `MastersGamesDB` is the Masters Opening Explorer population and the current comparison population.
- `PlayerGamesDB` is the per-player Opening Explorer population; Chessview recognizes the source but does not currently consume it.
- Lichess cloud evaluation supplies engine source data when `LichessEval` judges that data usable.

## Exact Lichess endpoints used today

Chessview currently uses these Lichess endpoints:

| Purpose | Request | Current Chessview parameters / behavior | Official docs |
| --- | --- | --- | --- |
| OAuth authorization handoff | browser navigation to `https://lichess.org/oauth` | Authorization Code + PKCE; `response_type=code`, Chessview `client_id`, `redirect_uri`, `code_challenge_method=S256`, `code_challenge`, and `state`. This browser navigation is outside `LichessGateway`. | <https://lichess.org/api#tag/OAuth> |
| OAuth token exchange | `POST https://lichess.org/api/token` | `grant_type=authorization_code`, returned `code`, PKCE `code_verifier`, `redirect_uri`, and Chessview `client_id`; sent through `LichessGateway`. | <https://lichess.org/api#tag/OAuth> |
| `LichessGamesDB` | `GET https://explorer.lichess.org/lichess` | `variant=standard`, current `fen`, `moves=30`, `topGames=4`, `recentGames=8`; whatever representative-game references Lichess returns are retained for bounded Root-source discovery, while aggregate move/result counts remain the authoritative quantitative data. Requests are authenticated with the visitor's Bearer token through the shared `LichessSession` authorized-request path. | <https://lichess.org/api#tag/Opening-Explorer/operation/openingExplorerLichess> |
| `MastersGamesDB` | `GET https://explorer.lichess.org/masters` | current `fen`, `moves=30`, `topGames=0`; authenticated with the visitor's Bearer token through the same `LichessSession` authorized-request path. | <https://lichess.org/api#tag/Opening-Explorer/operation/openingExplorerMaster> |
| Cloud evaluation | `GET https://lichess.org/api/cloud-eval` | current `fen`, `variant=standard`, `multiPv=5`. A `404` means the position is absent from the cloud-eval database. | <https://lichess.org/api#tag/Analysis/operation/apiCloudEval> |

`PlayerGamesDB` maps to `GET https://explorer.lichess.org/player`, but Chessview does **not** currently issue that request. Its contract is documented in [Opening Explorer databases](opening-explorer-databases.md) for future use rather than listed as current traffic.

## Authentication

- Live rated Explorer and Masters access use the visitor's Lichess authorization through browser OAuth2 Authorization Code + PKCE.
- Authenticated application requests use one `LichessSession.authorizedRequest(...)` path. Source clients do not acquire tokens or construct Bearer headers independently.
- That session path completes or begins authorization as needed, attaches the current visitor Bearer token, delegates the HTTP request to `LichessGateway`, and clears the same stored token when Lichess rejects it with HTTP 401.
- Concurrent clients share one pending authorization attempt, so rated Explorer and Masters cannot independently start competing OAuth redirects for the same page session.
- No client secret or personal token is shipped in the static bundle.
- OAuth callback parameters and PKCE transaction state are consumed on both successful completion and terminal callback failure so reload can begin a clean sign-in.
- Browser navigation to Lichess's OAuth authorization endpoint is the user-agent authorization handoff and is outside the gateway-managed application transport boundary.
- The OAuth token exchange is an application-issued Lichess API request and therefore goes through `LichessGateway`.

## Network boundary

All application-issued HTTP requests to Lichess APIs and services go through the application-wide `LichessGateway`, including rated Explorer, Masters, cloud evaluation, and OAuth token exchange. Visitor-authorized source requests reach that gateway through `LichessSession.authorizedRequest(...)`; top-level browser navigation to the OAuth authorization endpoint is not such a request.

The gateway must:

- allow at most one Lichess request in flight at a time;
- apply Chessview's voluntary minimum interval between request starts; the current value is `LICHESS_REQUEST_MIN_INTERVAL_MS` in `src/config.ts` (250 ms);
- coordinate HTTP 429 cooldown across clients;
- wait at least one full minute after a 429 before subsequent Lichess API traffic resumes;
- prevent queued work from being sent after its `AbortSignal` becomes obsolete;
- when the next transport slot becomes available, send queued foreground work before queued background work while preserving FIFO order within the same effective urgency;
- translate browser abort-shaped request failures into semantic `ObsoleteWork` only when the exact request's own `AbortSignal` establishes that the request became obsolete;
- leave an abort-shaped transport failure with a live request signal classified as a genuine transport failure rather than cancellation;
- preserve transport outcomes so domain clients can distinguish successful absence from failure to obtain data.

These responsibilities are implemented inside `LichessGateway`; request scheduling is not a separate Chessview architectural boundary or service.

The voluntary start interval is Chessview pacing policy used to reduce burstiness between otherwise serial requests. It is not a Lichess-mandated rate limit and does not replace the full-minute post-429 cooldown. Its concrete value lives in `src/config.ts`; this document owns the behavior and distinction that value implements.

Priority is generic transport urgency only. The gateway does not decide which chess or current-view work is foreground. It observes the effective urgency supplied by callers when choosing the next queued request; an already in-flight request is not preempted.

Position-backed endpoint clients may coalesce equivalent work for one canonical position and endpoint facet. One caller becoming obsolete must stop only that caller's participation without cancelling equivalent work still needed by another live caller. The shared producer's effective urgency is the highest urgency among its live subscribers, so joining or leaving shared work may promote or demote a still-queued request without creating another producer. When every caller to shared queued work becomes obsolete, the shared producer must be cancelled so the queued request does not reach Lichess.

Endpoint clients retain responsibility for request parameters, parsing, source validation, persistence, cache policy, and deciding whether source data is fit to expose. Facets retain independent freshness; a position record is not globally fresh or stale. Downstream semantic meaning belongs to the component that owns that evidence or product decision rather than to transport by default.

## Cache and failure semantics

- Rated Explorer cache TTL: 24 hours.
- A persisted rated Explorer value is a fresh cache hit only when it was produced by the current Explorer request profile. Request-shape changes therefore trigger normal provider acquisition instead of asking Root or other consumers to infer compatibility from response contents.
- Lichess may legitimately return fewer top/recent games than requested; representative-game count is not a cache-completeness signal.
- Masters cache TTL: 7 days.
- Cloud-evaluation cache TTL: 7 days.
- A supported cloud-eval `404` is successful absence and may be cached as such.
- A transport or HTTP failure is not successful absence.
- A non-null stale source value may be used when its endpoint client still judges it usable and a refresh fails.
- Explorer structural refinement classifies source failure only after the Explorer provider has exhausted its own fresh/live/stale fallback path. It never manufactures an empty or negative Reading from failure.
- An Explorer HTTP 429 is retryable for the active refinement run only when `LichessGateway` exposes a future cooldown end. That cooldown is the semantic retry gate; Current View does not reconstruct the delay from the HTTP status.
- If no future retry gate exists, or another Explorer source failure remains after fallback, that source attempt is unavailable-for-this-run. A replacement refinement run may try again under normal freshness/source policy.
- Explorer source classification stops at the source-load boundary. Failure after a usable Reading has been obtained—such as graph reconciliation/persistence failure—is not source unavailability and remains retryable/visible through Knowledge Acquisition.
- Cloud-eval retrieval details are not exposed as evaluation values. `LichessEval` returns usable evaluation or absence and exposes request/failure activity separately through its operational status channel.
- `LichessSession` owns invalidating a visitor access token rejected with HTTP 401; endpoint/domain code still owns source-specific fallback, diagnostics, and user-facing interpretation of that response.

## External constraint

The request policy is intended to satisfy [Lichess's published API guidance](https://lichess.org/page/api-tips): only one request at a time, and after HTTP 429 wait a full minute before resuming API usage. Lichess notes that underlying rate limits vary and can change. Chessview's 250 ms voluntary start spacing is additional application policy, not a requirement stated by that guidance. Re-verify the live Lichess guidance before changing Chessview's transport policy.

## Verification

Deterministic tests should cover:

- OAuth callback success and terminal-failure cleanup;
- expired-token / HTTP 401 handling;
- malformed rated Explorer payloads not being cached or exposed as usable Explorer Readings;
- malformed cached Explorer values being treated as unusable rather than fresh source data;
- rated Explorer requests retaining the enlarged representative-game request needed by bounded Root-source discovery (`topGames=4`, `recentGames=8`);
- a legacy Explorer cache entry from another request profile causing provider acquisition even when its timestamp is fresh, while a current-profile persisted entry is reused without another request;
- cross-client serialization between rated Explorer, Masters, cloud evaluation, and other gateway users;
- default request-start spacing following `LICHESS_REQUEST_MIN_INTERVAL_MS` while remaining independent from the 429 cooldown;
- queued foreground work receiving the next available transport slot ahead of queued background work without preempting an in-flight request;
- live shared-producer demand promoting and demoting the effective urgency seen by queued transport;
- a 429 from one client delaying later traffic from another client;
- Explorer refinement exposing that future cooldown as a retry gate instead of immediately replaying the request;
- a 429 without a future cooldown gate not creating a busy retry loop;
- exhausted Explorer source failure becoming unavailable-for-this-run only after stale fallback has failed;
- Explorer source failure remaining unknown rather than producing synthetic chess Evidence;
- graph reconciliation failure after a usable Explorer Reading not being reclassified as source unavailability;
- cancellation of queued obsolete work before it reaches the network;
- an in-flight abort-shaped browser rejection becoming `ObsoleteWork` when its exact request signal is aborted;
- an abort-shaped transport failure with a live request signal remaining a genuine failure;
- one obsolete caller detaching from shared same-position work while another live caller still receives it;
- all callers becoming obsolete cancelling shared queued work before send;
- cloud-eval successful absence versus request failure at the provider operational boundary;
- stale usable cloud-eval fallback without exposing retrieval-state sentinels as evaluation data.

Manual verification should include a fresh authenticated browser session, an expired/revoked authorization session, and navigation during a real cooldown using already cached data.
