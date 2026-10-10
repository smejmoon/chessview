# Do:

Implement the work-demand boundary defined by [`docs/architecture/lichess-gateway.md`](../docs/architecture/lichess-gateway.md) §Work and HTTP request contract, [`docs/architecture/position-repository.md`](../docs/architecture/position-repository.md) §Facet hydration and shared producer lifetime, and [`docs/components/lichess-access.md`](../docs/components/lichess-access.md) §Network boundary.

Introduce a generic application work-demand/context type for lifetime and live foreground/background urgency. Replace the remaining ad-hoc `signal`/`priority` shapes and separate that metadata from browser `RequestInit` throughout `PositionRepository`, Explorer, Masters, cloud evaluation, `LichessSession`, and `LichessGateway`.

Replace raw `LichessGateway.cooldownUntil` exposure with a semantic retry/cooldown gate consumed by Explorer refinement.

Define the explicit minimal `createLichessSession` dependency contract as part of this migration instead of letting TypeScript infer it from concrete defaults.

# Because:

The position-cache consolidation is complete: `PositionRepository` now owns compatible-observation reuse, shared producer lifetime, last-participant cancellation, and live effective foreground/background priority. The remaining mismatch is at the work/transport seam rather than the cache lifecycle.

ChessView still overloads `RequestInit.priority` with application scheduling meaning, forcing `LichessRequestInit` to omit and redefine a browser field. Explorer, Masters, and cloud evaluation also import or reconstruct Lichess-specific priority types even though the producer lifetime and urgency originate at the generic repository boundary.

Explorer refinement still reads the gateway's absolute `cooldownUntil` clock and recreates timing/sleep behavior. A semantic gate keeps cooldown ownership inside the transport boundary.

# Edges:

Preserve all observable scheduling behavior: one Lichess request in flight, request-start spacing, foreground before background at the next available slot, FIFO within equal urgency, live promotion/demotion of queued shared work, queued cancellation when demand disappears, exact-signal abort translation, and shared post-429 cooldown.

Do not create another request scheduler. Generic work demand is metadata and lifetime coordination; `LichessGateway` remains the only owner of Lichess transport scheduling.

Do not reopen the completed position-cache lifecycle while migrating the work contract. Caller participation, repository-owned producer lifetime, and one HTTP operation remain distinct. `PositionRepository` continues to create the producer-owned abort signal and aggregate live urgency; persistence and other useful completion work remain uncancelled unless they explicitly consume that context.

Keep gateway responses as `Response`; narrow dependency/test interfaces at their consumers instead of introducing a generic response wrapper.

Preserve zero-argument production construction for factories whose defaults provide complete behavior.

Preserve the explicit authorization boundary now implemented by `LichessSession`: application startup and explicit reconnect own OAuth navigation; source requests never redirect; `authorizedRequest` attaches an established token and 401 continues to clear it and notify authorization-loss listeners. Work-context plumbing must not reintroduce authorization acquisition into source calls.

# Complete:

A generic work-demand/context type exists outside the Lichess transport namespace and uses the term urgency for ChessView foreground/background ordering.

`RequestInit` reaches Fetch without ChessView-specific field redefinition. Gateway and session APIs receive HTTP options and work metadata separately.

Position-backed providers forward the repository-owned producer context into each Lichess transport operation, while callers retain independent participation signals.

The gateway exposes a semantic active retry gate for 429 cooldown and Explorer refinement no longer reads `cooldownUntil`, computes transport delays, or owns cooldown sleeping.

`createLichessSession` has an explicit minimal dependency contract while retaining zero-argument production construction and the existing explicit authorization/reconnect behavior.

Deterministic tests cover live urgency promotion/demotion, queued cancellation, session work-context forwarding, semantic cooldown retry behavior, and preservation of the explicit authorization boundary. Typecheck, tests, and build pass.

# Sync:

Use backlog-tend for routine synchronization.
