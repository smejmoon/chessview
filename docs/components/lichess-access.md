# Lichess access

## Purpose

Own authentication, endpoint access, shared request policy, endpoint caches, and transport/failure semantics for Chessview's Lichess-backed data.

The architectural dependency boundary is defined separately in [`docs/architecture/lichess-gateway.md`](../architecture/lichess-gateway.md). This component owns the observable request-policy requirements that boundary must enforce.

## Data sources

- Rated standard Lichess Opening Explorer is the primary human-statistical source.
- Masters Opening Explorer is a separate comparison population.
- Lichess cloud evaluation supplies cached engine evidence when adequate-depth data is available.

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

Endpoint clients retain responsibility for request parameters, parsing, validation, persistence, cache policy, and chess-specific meaning.

## Cache and failure semantics

- Rated Explorer cache TTL: 24 hours.
- Masters cache TTL: 7 days.
- Cloud-evaluation cache TTL: 7 days.
- A supported cloud-eval `404` is successful absence and may be cached as such.
- A transport or HTTP failure is not successful absence.
- A non-null stale evidence value may be used when a refresh fails; when no evidence exists, failure remains explicit.
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
- cloud-eval successful absence versus request failure;
- stale evidence fallback without converting failure into absence.

Manual verification should include a fresh authenticated browser session, an expired/revoked authorization session, and navigation during a real cooldown using already cached data.
