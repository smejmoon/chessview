**Preserve the LichessGateway boundary**

`docs/architecture/lichess-gateway.md` governs where Chessview's Lichess transport boundary sits. `docs/components/lichess-access.md` §Network boundary governs the request policy that boundary must enforce.

Before changing Lichess API access, request scheduling, rate-limit handling, or a Lichess-backed client, read both owners and keep the change consistent with them.

Do not introduce application-issued Lichess HTTP/API requests outside `LichessGateway`. Browser navigation to Lichess's OAuth authorization endpoint is a user-agent handoff outside the scheduler; the OAuth token exchange remains inside the gateway.

If the existing boundary no longer fits the required design, revise the governing architecture and requirements rather than bypassing it.
