# Do:

Implement the work-demand boundary defined by [`docs/architecture/lichess-gateway.md`](../docs/architecture/lichess-gateway.md) §Work and HTTP request contract, [`docs/architecture/position-repository.md`](../docs/architecture/position-repository.md) §SourceChannel hydration and shared producer lifetime, and [`docs/components/lichess-access.md`](../docs/components/lichess-access.md) §Network boundary.

Introduce a generic application work-demand/context type for lifetime and live foreground/background urgency. Separate that metadata from browser `RequestInit` throughout `PositionRepository`, Explorer, Masters, cloud evaluation, `LichessSession`, and `LichessGateway`.

Replace raw `LichessGateway.cooldownUntil` exposure with a semantic retry/cooldown gate consumed by Explorer refinement.

Define the explicit minimal `createLichessSession` dependency contract as part of this migration instead of letting TypeScript infer it from concrete defaults.

# Because:

ChessView currently overloads `RequestInit.priority` with application scheduling meaning, forcing `LichessRequestInit` to omit and redefine a browser field. The architecture decision keeps HTTP request description and application work metadata independent while retaining one gateway-owned scheduler.

`PositionRepository` already names its shared-load state `SharedSourceChannelLoad` / `activeSourceChannelLoads`, coalesces equivalent callers, and guards deferred producer startup against obsolete demand. The remaining work is to type the shared producer context and caller demand consistently without repeating ad-hoc `signal`/`priority` shapes or making repository semantics Lichess-specific.

Explorer refinement currently reads the gateway's absolute cooldown clock and recreates timing/sleep behavior. A semantic gate keeps cooldown ownership inside the transport boundary.

# Edges:

Preserve all observable scheduling behavior: one Lichess request in flight, request-start spacing, foreground before background at the next available slot, FIFO within equal urgency, live promotion/demotion of queued shared work, queued cancellation when demand disappears, exact-signal abort translation, and shared post-429 cooldown.

Do not create another request scheduler. Generic work demand is metadata and lifetime coordination; `LichessGateway` remains the only owner of Lichess transport scheduling.

Do not equate caller demand, coalesced producer lifetime, and HTTP operation lifetime. `PositionRepository` must continue creating a producer-owned abort signal, and persistence or other useful completion work must remain uncancelled unless it explicitly consumes that signal. Preserve its cancellation guards: an already-aborted caller does not create or disturb shared work, and an abandoned producer must not start after its final participant detaches.

Keep gateway responses as `Response`; narrow dependency/test interfaces at their consumers instead of introducing a generic response wrapper.

Preserve zero-argument production construction for factories whose defaults provide complete behavior.

Preserve startup-owned Lichess authorization while changing the transport work API. `LichessSession.authorizedRequest` consumes an established token without initiating sign-in; bootstrap alone owns OAuth redirect, callback, and explicit retry. Do not reintroduce per-request authorization coordination.

# Complete:

A generic work-demand/context type exists outside the Lichess transport namespace and uses the term urgency for ChessView foreground/background ordering.

`RequestInit` reaches Fetch without ChessView-specific field redefinition. Gateway and session APIs receive HTTP options and work metadata separately.

Position-backed providers forward the repository-owned producer context into each Lichess transport operation, while callers retain independent participation signals.

The gateway exposes a semantic active retry gate for 429 cooldown and no longer requires Explorer refinement to read `cooldownUntil`, compute delays, or own cooldown sleeping.

Deterministic tests cover pre-aborted first/joining callers, cancellation before deferred producer startup, independent participant cancellation, live urgency promotion/demotion, queued cancellation, session forwarding, and semantic cooldown retry behavior. Typecheck, tests, and build pass.

# Sync:

Use `backlog-tend` for routine synchronization of this open outcome.
