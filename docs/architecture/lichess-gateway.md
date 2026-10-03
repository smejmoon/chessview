# LichessGateway

`LichessGateway` is Chessview's application-issued HTTP boundary to Lichess. The observable request policy it must enforce is owned by [`docs/components/lichess-access.md`](../components/lichess-access.md) §Network boundary; this document owns where that boundary sits and what depends on it.

## Boundary

Rated Opening Explorer, Masters, cloud evaluation, OAuth token exchange, and future application-issued Lichess API requests go through `LichessGateway` rather than sending HTTP requests independently.

Top-level browser navigation to Lichess's OAuth authorization endpoint is a user-agent authorization handoff, not a gateway-managed application request. The token exchange that follows is inside the gateway boundary.

`LichessGateway` directly owns the transport coordination needed to enforce the application-wide Lichess request policy. Its queue, serialization, start spacing, effective transport-priority selection, 429 cooldown, queued cancellation, and browser-fetch dispatch are internal parts of this boundary rather than a separate architectural request-gate component.

## Cancellation translation

`LichessGateway` is the boundary that has both the browser transport failure and the exact `AbortSignal` for that request. It may therefore translate an abort-shaped fetch rejection into semantic `ObsoleteWork` when that request signal is actually aborted, preserving the underlying failure as causal detail.

An abort-shaped transport error while the request signal remains live is not cancellation and remains a transport failure. Once the gateway has established `ObsoleteWork`, higher layers reason over that semantic condition rather than re-interpreting `error.name === 'AbortError'` or pairing arbitrary platform errors with unrelated lifetime state.

Queued requests that become obsolete before dispatch also terminate as `ObsoleteWork` and must not reach the network.

## Domain clients

Explorer, Masters, cloud-evaluation, and authentication clients own endpoint-specific behavior. They remain responsible for request parameters, response parsing and source validation, persistence fields and cache policy, authentication semantics, and deciding whether source data is fit to expose to the rest of Chessview.

They do not thereby own every downstream semantic interpretation of that data. In particular, [`LichessEval`](lichess-eval.md) owns whether cloud-eval data is usable, while [Evidence](../components/evidence.md) owns derived chess meaning such as move loss and move quality.

Position-backed clients use [`PositionRepository`](position-repository.md) for canonical node access and shared per-facet producer lifetime. That repository does not send Lichess traffic itself: the endpoint client still constructs and interprets its request, and the application-issued HTTP request still goes through `LichessGateway`.

The repository may expose a live effective priority for shared work as subscribers join or leave. The gateway observes that transport urgency only when selecting the next queued request; it does not own subscriber lifetime or current-view relevance.

## Dependency direction

Application and domain code depend on Lichess-backed clients and `PositionRepository`. Position-backed Lichess clients coordinate canonical records/shared facet work through `PositionRepository` and depend on `LichessGateway` for transport. `LichessGateway` is the only application transport that performs those Lichess HTTP requests.

Higher layers do not bypass this direction with direct application-issued Lichess API access or a second request scheduler.

## Exclusions

The gateway coordinates transport access to Lichess; it is not a general application service. It does not decide move quality, Root rarity, Line selection, graph expansion, Rail presentation, OAuth UI/navigation, canonical-position identity, facet freshness, shared parsed-result lifetime, or source-specific fallback.

Caching stays with the position repository/domain clients unless a concrete cross-client requirement earns moving some cache behavior into the gateway.

If required Lichess behavior no longer fits this boundary, revise this architecture and the owning request requirements rather than bypassing it.
