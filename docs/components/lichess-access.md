# Lichess access

## Purpose

Own authentication, endpoint access, shared request policy, and transport/failure semantics for Chessview's Lichess-backed data. [Data stability](data-stability.md) owns the stability of source observations; [Position cache](../architecture/position-cache.md) owns the generic cache lifecycle.

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
- Application startup owns initial authorization: it consumes an OAuth callback, reuses a stored access token, or begins PKCE navigation before starting Current View source work. Terminal startup failures offer an explicit retry.
- Authenticated application requests use one `LichessSession.authorizedRequest(...)` path. It attaches an already-established Bearer token and delegates to `LichessGateway`; it rejects missing authorization rather than initiating OAuth navigation. Source providers never acquire tokens or redirect the browser.
- When Lichess returns HTTP 401 for the token actually still stored, `LichessSession` invalidates that token and notifies the application once. A later 401 for an already-replaced token must not invalidate newer credentials.
- The running application offers **Reconnect Lichess** through a user-initiated action, without replacing the accepted Constellation, Rail, or cached knowledge. Full-page OAuth navigation subsequently restores the route through the position URL.
- No client secret or personal token is shipped in the static bundle.
- OAuth callback parameters and PKCE transaction state are consumed on successful completion and terminal failure, including malformed successful JSON or token persistence failure. A failed persistence operation must not be reported as established authorization; retry starts a new OAuth exchange rather than replaying the old code.
- Browser navigation to Lichess's OAuth authorization endpoint is a user-agent handoff outside the gateway; OAuth token exchange stays inside `LichessGateway`.

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

Foreground/background is generic application work urgency, not browser Fetch priority. The gateway does not decide which chess or current-view work is foreground. It consumes the effective live urgency carried by separate work metadata when choosing the next queued request; an already in-flight request is not preempted. HTTP `RequestInit` remains reserved for browser request semantics.

Position-backed endpoint clients may coalesce equivalent work for one canonical position and endpoint facet. One caller becoming obsolete must stop only that caller's participation without cancelling equivalent work still needed by another live caller. The shared producer's effective urgency is the highest urgency among its live subscribers, so joining or leaving shared work may promote or demote a still-queued request without creating another producer. When every caller to shared queued work becomes obsolete, the shared producer must be cancelled so the queued request does not reach Lichess.

Endpoint clients retain responsibility for request parameters, parsing, source validation, and deciding whether source data is fit to expose. They supply the cache-relevant source policy; generic caching is executed by `PositionRepository` under [Position cache](../architecture/position-cache.md). Facets retain independent freshness; a position record is not globally fresh or stale. Downstream semantic meaning belongs to the component that owns that evidence or product decision rather than to transport by default.

## Source failures and endpoint-specific cache conditions

[Data stability](data-stability.md) owns how long observations remain useful, and [Position cache](../architecture/position-cache.md) owns generic cache freshness, background refresh, persistence, and diagnostics. Concrete refresh intervals remain in `src/config.ts`.

- Rated Explorer must match the requested population and required fields, including representative games used by Root discovery; a legacy Reading lacking them is not a compatible answer. A smaller returned top/recent-game list is not proof the response is incomplete.
- A cloud-eval HTTP 404 is successful *temporary* source absence, whereas a network/HTTP failure is not an absence observation.
- Explorer structural refinement never manufactures an empty or negative Reading when acquisition fails.
- An Explorer HTTP 429 may be retried within an active refinement run only when `LichessGateway` exposes an active semantic retry gate; Current View does not recreate cooldown timing. Without future retry eligibility or usable information, this source attempt is unavailable for the run.
- Failure after a usable Explorer Reading is obtained (for example graph reconciliation or persistence failure) is not source unavailability; Knowledge Acquisition owns that distinction.
- `LichessSession` invalidates the current visitor token rejected by HTTP 401; authorization recovery cannot erase retained chess knowledge.

## External constraint

The request policy is intended to satisfy [Lichess's published API guidance](https://lichess.org/page/api-tips): only one request at a time, and after HTTP 429 wait a full minute before resuming API usage. Lichess notes that underlying rate limits vary and can change. Chessview's 250 ms voluntary start spacing is additional application policy, not a requirement stated by that guidance. Re-verify the live Lichess guidance before changing Chessview's transport policy.

## Verification

Deterministic tests should cover:

- OAuth callback success, denial, malformed response, network and persistence failures clearing callback and PKCE state before explicit retry;
- startup-owned authorization and user-initiated retries without redirects from incidental source requests;
- rejected-token / HTTP 401 invalidation notifying the application once, retaining an already accepted view and cached navigation, and not invalidating a newer token after a stale 401;
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
