# LichessGateway

`LichessGateway` is Chessview's application-issued HTTP boundary to Lichess. The observable request policy it must enforce is owned by [`docs/components/lichess-access.md`](../components/lichess-access.md) §Network boundary; this document owns where that boundary sits and what depends on it.

## Boundary

Rated Opening Explorer, Masters, cloud evaluation, OAuth token exchange, and future application-issued Lichess API requests go through `LichessGateway` rather than sending HTTP requests independently.

Top-level browser navigation to Lichess's OAuth authorization endpoint is a user-agent authorization handoff, not a gateway-managed application request. The token exchange that follows is inside the gateway boundary.

`LichessGateway` directly owns the transport coordination needed to enforce the application-wide Lichess request policy. Its queue, serialization, start spacing, effective transport-priority selection, 429 cooldown, queued cancellation, and browser-fetch dispatch are internal parts of this boundary rather than a separate architectural request-gate component.

## Work and HTTP request contract

ChessView scheduling metadata is application work state, not HTTP request state. The intended API therefore keeps browser `RequestInit` semantics intact and carries work metadata separately.

The generic application concept is **work demand**: a lifetime signal plus live urgency. Foreground/background remains the current urgency vocabulary. The concept is generic because the same caller lifetime and coalescing semantics exist before any Lichess request is constructed; it is not a second scheduler and it does not move queue ownership out of `LichessGateway`.

There are three distinct lifetimes:

1. A caller demand belongs to the caller that currently wants a result.
2. A coalesced producer context belongs to shared work. `PositionRepository` creates its own abort signal for that producer and derives live effective urgency from all current participants.
3. A transport operation is one HTTP request. A Lichess endpoint client forwards the producer context to the gateway only for that operation.

Those lifetimes must not be collapsed. In particular, an endpoint client may continue useful validation or persistence after a response has arrived even when the initiating view has disappeared, unless that work explicitly consumes the producer signal.

The target gateway shape is conceptually `request(input, requestInit, work)`, where `requestInit` is ordinary `RequestInit` and `work` carries the ChessView signal/urgency contract. Exact exported type names may be introduced during implementation, but browser `RequestInit.priority` must never be repurposed for ChessView urgency.

`LichessSession.authorizedRequest` follows the same separation: authentication modifies HTTP headers and delegates the request plus work metadata; it does not reinterpret urgency or lifetime.

## Cooldown and retry exposure

The gateway owns the cooldown clock. Higher layers should not reconstruct transport timing from a raw `cooldownUntil` timestamp.

Where a source policy needs to retry after a gateway-owned 429 cooldown, the gateway should expose a semantic retry gate (for example, a promise-like gate that is present only while retry is blocked). Explorer refinement can then classify a 429 as retryable using that gate without owning the cooldown duration, clock arithmetic, or sleep policy.

This keeps one source of truth for transport availability while preserving Current View's existing rule that it waits on a lower-owned gate rather than busy-retrying.

## Transport response contract

The gateway remains an HTTP boundary and may return the platform `Response`. Endpoint clients legitimately need status, headers/body parsing, and endpoint-specific interpretation, so wrapping every response in a second generic transport DTO would add indirection without removing policy.

Injection contracts should nevertheless depend on the smallest consumed capability. A session that only calls `gateway.request` accepts a request-capable gateway rather than the full concrete singleton shape; endpoint-provider test doubles likewise need only the response operations that provider consumes.

## Cancellation translation

`LichessGateway` is the boundary that has both the browser transport failure and the exact `AbortSignal` for that request. It may therefore translate an abort-shaped fetch rejection into semantic `ObsoleteWork` when that request signal is actually aborted, preserving the underlying failure as causal detail.

An abort-shaped transport error while the request signal remains live is not cancellation and remains a transport failure. Once the gateway has established `ObsoleteWork`, higher layers reason over that semantic condition rather than re-interpreting `error.name === 'AbortError'` or pairing arbitrary platform errors with unrelated lifetime state.

Queued requests that become obsolete before dispatch also terminate as `ObsoleteWork` and must not reach the network.

## Domain clients

Explorer, Masters, cloud-evaluation, and authentication clients own endpoint-specific behavior. They remain responsible for request parameters, response parsing and source validation, persistence fields and cache policy, authentication semantics, and deciding whether source data is fit to expose to the rest of Chessview.

They do not thereby own every downstream semantic interpretation of that data. In particular, [`LichessEval`](lichess-eval.md) owns whether cloud-eval data is usable, while [Evidence](../components/evidence.md) owns derived chess meaning such as move loss and move quality.

Position-backed clients use [`PositionRepository`](position-repository.md) for canonical node access and shared per-source-channel producer lifetime. That repository does not send Lichess traffic itself: the endpoint client still constructs and interprets its request, and the application-issued HTTP request still goes through `LichessGateway`.

The repository may expose a live effective priority for shared work as subscribers join or leave. The gateway observes that transport urgency only when selecting the next queued request; it does not own subscriber lifetime or current-view relevance.

## Dependency direction

Application and domain code depend on Lichess-backed clients and `PositionRepository`. Position-backed Lichess clients coordinate canonical records/shared source channel work through `PositionRepository` and depend on `LichessGateway` for transport. `LichessGateway` is the only application transport that performs those Lichess HTTP requests.

Higher layers do not bypass this direction with direct application-issued Lichess API access or a second request scheduler.

## Exclusions

The gateway coordinates transport access to Lichess; it is not a general application service. It does not decide move quality, Root rarity, Line selection, graph expansion, Rail presentation, OAuth UI/navigation, canonical-position identity, source channel freshness, shared parsed-result lifetime, or source-specific fallback.

Caching stays with the position repository/domain clients unless a concrete cross-client requirement earns moving some cache behavior into the gateway.

If required Lichess behavior no longer fits this boundary, revise this architecture and the owning request requirements rather than bypassing it.
