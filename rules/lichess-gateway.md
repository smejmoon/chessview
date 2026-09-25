**Preserve the LichessGateway boundary**

`docs/architecture/lichess-gateway.md` governs Chessview's Lichess network
boundary.

Before changing Lichess access, request scheduling, rate-limit handling, or a
Lichess-backed client, read that architecture and keep the change consistent
with it.

Do not introduce direct Lichess network access outside `LichessGateway`. If the
existing boundary no longer fits the required design, revise the governing
architecture rather than bypassing it.
