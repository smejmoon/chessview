# Lichess access

## Purpose

Own authentication, endpoint access, shared request policy, endpoint caches, and transport/failure semantics for Chessview's Lichess-backed data.

The architectural dependency boundary is defined separately in [`docs/architecture/lichess-gateway.md`](../architecture/lichess-gateway.md). Canonical position record and shared facet lifetime are defined in [`docs/architecture/position-repository.md`](../architecture/position-repository.md). Cloud-evaluation source usability is defined in [`docs/architecture/lichess-eval.md`](../architecture/lichess-eval.md). This component owns the observable request-policy requirements those boundaries must enforce.

## Data sources

- Rated standard Lichess Opening Explorer is the primary human-statistical source.
- Masters Opening Explorer is a separate comparison population.
- Lichess cloud evaluation supplies engine source data when `LichessEval` judges that data usable.

## Authentication

- Live rated Explorer access uses the visitor's Lichess authorization through browser OAuth2 Authorization Code + PKCE.
- No client secret or personal token is shipped in the static bundle.
- OAuth callback parameters and PKCE transaction state are consumed on both successful completion and terminal callback failure so reload can begin a clean sign-in.
- Browser navigation to Lichess's OAuth authorization endpoint is the user-agent authorization handoff and is outside the request scheduler.
- The OAuth token exchange is an application-issued Lichess API request and therefore goes through `LichessGateway`.

## Network boundary

All application-issued HTTP requests to Lichess APIs and services go through the application-wide `LichessGateway`, including rated Explorer, Masters, cloud evaluation, and OAuth token exchange. Top-level browser navigation to the OAuth authorization endpoint is not such a request.

The gateway must:

- allow at most one Lichess request in flight at a time;
- coordinate HTTP 429 cooldown across clients;
- wait at least one full minute after a 429 before subsequent Lichess API traffic resumes;
- prevent queued work from being sent after its `AbortSignal` becomes obsolete;
- preserve transport outcomes so domain clients can distinguish successful absence from failure to obtain data.

Position-backed endpoint clients may coalesce equivalent work for one canonical position and endpoint facet. One caller becoming obsolete must stop only that caller's participation without cancelling equivalent work still needed by another live caller. When every caller to shared queued work becomes obsolete, the shared producer must be cancelled so the queued request does not reach Lichess.

Endpoint clients retain responsibility for request parameters, parsing, source validation, persistence, cache policy, and deciding whether source data is fit to expose. Facets retain independent freshness; a position record is not globally fresh or stale. Downstream semantic meaning belongs to the component that owns that evidence or product decision rather than to transport by default.

## Cache and failure semantics

- Rated Explorer cache TTL: 24 hours.
- Masters cache TTL: 7 days.
- Cloud-evaluation cache TTL: 7 days.
- A supported cloud-eval `404` is successful absence and may be cached as such.
- A transport or HTTP failure is not successful absence.
- A non-null stale source value may be used when its endpoint client still judges it usable and a refresh fails.
- Cloud-eval retrieval details are not exposed as evaluation values. `LichessEval` returns usable evaluation or absence and exposes request/failure activity separately through its operational status channel.
- Authentication `401` handling remains endpoint/domain behavior, including clearing unusable authorization state.

## External constraint

The request policy is intended to satisfy Lichess's published API guidance: only one request at a time, and after HTTP 429 wait a full minute before resuming API usage. Lichess notes that underlying rate limits vary and can change. Re-verify the live guidance at <https://lichess.org/page/api-tips> before changing Chessview's transport policy.

## Verification

Deterministic tests should cover:

- OAuth callback success and terminal-failure cleanup;
- expired-token / HTTP 401 handling;
- cross-client serialization between rated Explorer, Masters, cloud evaluation, and other gateway users;
- a 429 from one client delaying later traffic from another client;
- cancellation of queued obsolete work before it reaches the network;
- one obsolete caller detaching from shared same-position work while another live caller still receives it;
- all callers becoming obsolete cancelling shared queued work before send;
- cloud-eval successful absence versus request failure at the provider operational boundary;
- stale usable cloud-eval fallback without exposing retrieval-state sentinels as evaluation data.

Manual verification should include a fresh authenticated browser session, an expired/revoked authorization session, and navigation during a real cooldown using already cached data.
