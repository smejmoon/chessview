# LichessGateway

`LichessGateway` is Chessview's application-issued HTTP boundary to Lichess. The observable request policy it must enforce is owned by [`docs/components/lichess-access.md`](../components/lichess-access.md) §Network boundary; this document owns where that boundary sits and what depends on it.

## Boundary

Rated Opening Explorer, Masters, cloud evaluation, OAuth token exchange, and future application-issued Lichess API requests go through `LichessGateway` rather than sending HTTP requests independently.

Top-level browser navigation to Lichess's OAuth authorization endpoint is a user-agent authorization handoff, not a gateway-scheduled application request. The token exchange that follows is inside the gateway boundary.

## Domain clients

Explorer, Masters, cloud-evaluation, and authentication clients own the meaning of their data and endpoint-specific behavior. They remain responsible for request parameters, response parsing and validation, persistence fields and cache policy, authentication semantics, and chess-specific interpretation.

Position-backed clients use [`PositionRepository`](position-repository.md) for canonical node access and shared per-facet producer lifetime. That repository does not send Lichess traffic itself: the endpoint client still constructs and interprets its request, and the application-issued HTTP request still goes through `LichessGateway`.

## Dependency direction

Application and domain code depend on Lichess-backed clients and `PositionRepository`. Position-backed Lichess clients coordinate canonical records/shared facet work through `PositionRepository` and depend on `LichessGateway` for transport. `LichessGateway` is the only application transport that performs those Lichess HTTP requests.

Higher layers do not bypass this direction with direct application-issued Lichess API access.

## Exclusions

The gateway coordinates transport access to Lichess; it is not a general application service. It does not decide move quality, Root rarity, Line selection, graph expansion, Rail presentation, OAuth UI/navigation, canonical-position identity, facet freshness, or shared parsed-result lifetime.

Caching stays with the position repository/domain clients unless a concrete cross-client requirement earns moving some cache behavior into the gateway.

If required Lichess behavior no longer fits this boundary, revise this architecture and the owning request requirements rather than bypassing it.
