# LichessGateway

`LichessGateway` is Chessview's network boundary to Lichess. All requests to
Lichess services pass through it, including rated Opening Explorer, Masters,
and cloud evaluation.

## Ownership

`LichessGateway` owns transport behavior that must hold across Lichess-backed
clients:

- serialize Lichess traffic so at most one request is in flight at a time;
- coordinate rate-limit cooldown and backoff across all clients;
- cancel queued work that becomes obsolete before it is sent;
- execute requests and preserve abort, HTTP, and network failure outcomes;
- distinguish successful absence of data from failure to obtain data.

A rate-limit response observed through one client constrains subsequent Lichess
traffic from every client.

## Domain clients

Explorer, Masters, and cloud-evaluation clients own the meaning of their data.
They remain responsible for endpoint-specific parameters, response parsing and
validation, persistence and cache policy, and chess-specific interpretation.

They do not independently schedule or send Lichess network requests.

## Dependency direction

Application and domain code depend on Lichess-backed clients. Lichess-backed
clients depend on `LichessGateway`. `LichessGateway` performs the external
request.

Higher layers do not bypass this direction with direct Lichess access.

## Boundary

The gateway coordinates access to Lichess; it is not a general application
service. It does not decide move quality, Root rarity, Line selection, graph
expansion, Rail presentation, or other chess and product semantics.

Caching stays with domain clients unless a concrete cross-client requirement
earns moving some cache behavior into the gateway.

If required Lichess behavior no longer fits this boundary, revise this
architecture rather than bypassing it.
