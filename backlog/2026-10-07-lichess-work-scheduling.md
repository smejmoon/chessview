# Do:

Investigate and settle how ChessView should represent and schedule work that may consume the shared Lichess transport.

Compare the current design—where `signal` and ChessView scheduling `priority` travel alongside Fetch request options—with cleaner alternatives. In particular, evaluate whether work lifetime and live urgency should have an explicit demand/work context that is separate from HTTP `RequestInit`, and whether that concept should be generic application work rather than Lichess-specific.

Carry the still-supported TypeScript migration repair into the same decision: `createLichessSession` currently leaves its injectable options bag untyped, so TypeScript infers dependency contracts from the concrete defaults. Define the intended minimal session dependency surface as part of the decision and bounded follow-up work rather than requiring injected collaborators to mimic concrete singleton or browser-global shapes. Zero-argument production construction may remain valid where defaults provide the complete behavior.

Produce a durable architectural decision and bounded follow-up work. This outcome is investigation and decision-making; it does not require implementing the chosen design.

# Because:

`LichessGateway` is already the single application-issued HTTP boundary to Lichess and owns serialization, request-start spacing, queued urgency selection, 429 cooldown, queued cancellation, and browser fetch dispatch. Endpoint clients own endpoint parameters, parsing, validation, caching, persistence, and source-specific fallback.

The scheduling inputs do not currently have the same boundary clarity. `CurrentViewController` creates lifetime and foreground/background demand, `PositionRepository` coalesces equivalent producers and derives an effective live priority from their subscribers, endpoint clients pass that state onward, and `LichessGateway` consumes it when selecting queued work. Those semantics are real, but the contract is repeated rather than named.

The HTTP and work concepts are also coupled in the type surface: TypeScript 6's DOM `RequestInit.priority` describes browser fetch priority, while ChessView uses `priority` for its own foreground/background scheduler. `LichessRequestInit` therefore has to omit the browser field before adding ChessView's different meaning. Lichess session/Masters typing also exposed weakly expressed transport response expectations.

The current gateway factory already has explicit `GatewayOptions`, `GatewayLog`, and request types, so the earlier migration suspicion about its placeholder callback/default inference no longer describes the source. `createLichessSession`, however, still destructures an unannotated `= {}` options bag. Its tests inject a request-only gateway and lightweight browser collaborators, which is evidence that the public injection contract should describe the capabilities the session consumes rather than inherit the full concrete types of its defaults.

This investigation exists to settle the architecture rather than preserve compiler-driven shapes accidentally.

# Edges:

Preserve the established architectural constraint that `LichessGateway` is the only application-issued HTTP boundary to Lichess. Do not introduce a second public request scheduler merely to make types look cleaner; if scheduling is factored internally, ownership of serialization, spacing, cooldown, cancellation, and dispatch must remain singular.

Preserve current observable Lichess behavior while evaluating the design: shared producer lifetime, live foreground/background ordering for queued work, FIFO within equal urgency, cancellation before dispatch when all demand disappears, exact-signal abort translation, and shared post-429 cooldown.

`PositionRepository` is not a Lichess transport component. Its shared-producer lifetime and urgency aggregation may justify a generic work/demand abstraction, but the investigation must not make repository semantics Lichess-specific.

Likewise, an HTTP request is not automatically the unit of work. Distinguish caller demand, coalesced producer demand, and transport operations where their lifetimes differ. Persistence or other useful completion work must not become cancellable merely because the initiating view disappeared unless its semantics already require that.

`WorkContext`, `urgency`, a semantic cooldown gate, and a separated HTTP/work argument shape are candidate designs, not accepted architecture. A well-supported decision to keep a smaller version of the current design is a valid result.

Do not reopen migration suspicions that current source no longer supports merely because they were recorded during conversion. In particular, the gateway callback contract is explicit, promotion/recenter parameter bags now describe their actual fields, and Root enrichment's empty factory call is backed by complete defaults. This outcome owns only Lichess contract repairs that remain real after source validation.

# Unsettled:

- What is the precise unit of demand that carries lifetime and urgency, and when does coalescing create a new shared demand rather than merely forwarding a caller's context?
- Should ChessView have a generic work/demand context such as `AbortSignal` plus live urgency, or is a narrower Lichess-specific contract preferable?
- Which component creates, aggregates, forwards, and consumes that context across Current View, `PositionRepository`, Explorer/Masters/cloud eval, `LichessSession`, and `LichessGateway`?
- Should HTTP request description and work scheduling metadata be separate API arguments/types so Fetch `RequestInit` keeps only browser HTTP semantics?
- Should the gateway expose raw cooldown clock state such as `cooldownUntil`, or a more semantic retry/cooldown gate to higher layers?
- What transport response/error surface must the gateway guarantee so domain clients do not reconstruct or weakly infer Fetch contracts?
- What explicit minimal dependency interfaces should `createLichessSession` expose for gateway, location/history/storage/crypto access, redirect, and logging, and which of those collaborators are intentionally providers rather than direct values?
- Is foreground/background the right semantic distinction, and should the concept be named priority, urgency, or something else?
- Which remaining option/default shapes disappear naturally once the boundary is settled, and which are independent API-design problems?

# Complete:

Record a durable decision, including a valid no-change decision, that defines the work/demand unit, lifetime and urgency ownership, coalescing semantics, HTTP-versus-scheduling boundary, gateway/session/client responsibilities, cooldown exposure, and transport response contract.

Compare the credible alternatives and their failure modes well enough that implementation no longer depends on unresolved architectural judgment. Update the authoritative architecture/component documentation with the settled model and create or reshape independently completable implementation outcomes if implementation remains. Any still-needed `createLichessSession` dependency-contract repair is explicitly included in that bounded follow-up rather than left in migration notes for rediscovery. No production-code change is required for this investigation itself to complete.

# Sync:

Use `backlog-tend` for routine maintenance of this outcome; see `skills/backlog-tend/SKILL.md`.
