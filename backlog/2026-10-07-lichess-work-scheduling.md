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

# Decision:

ChessView will use a generic application work-demand contract rather than a Lichess-specific scheduling type. A caller demand carries lifetime plus foreground/background urgency. Coalescing creates a distinct shared producer context: `PositionRepository` owns the producer's abort signal and derives its live effective urgency from all current participants.

The shared context may be forwarded to a Lichess transport operation, but it is not identical to the HTTP request and does not automatically govern later validation or persistence. This preserves useful completion work whose semantics outlive a view while still allowing queued/in-flight transport to stop when shared demand disappears.

HTTP description and ChessView scheduling metadata will be separate. The target gateway/session API keeps ordinary browser `RequestInit` intact and passes work metadata separately; browser `RequestInit.priority` is therefore never redefined as ChessView foreground/background priority. The application term for this ordering signal is **urgency**.

`LichessGateway` remains the only application-issued Lichess HTTP scheduler and continues to own serialization, request-start spacing, queued urgency selection, exact-signal cancellation translation, 429 cooldown, and browser fetch dispatch. Introducing generic work demand does not introduce a second scheduling service.

`PositionRepository` owns aggregation of equivalent caller demand because it owns producer coalescing. Current View and other callers create their own demand; endpoint providers receive a repository-owned producer context; `LichessSession` forwards work metadata without interpreting it; `LichessGateway` consumes it only when coordinating the HTTP operation.

The gateway should expose cooldown as a semantic retry gate rather than a raw `cooldownUntil` clock value. Explorer refinement may wait on that lower-owned gate after a 429, but it should not own cooldown duration, clock arithmetic, or sleep policy.

The gateway continues to return platform `Response`. Endpoint clients legitimately own status/body parsing and endpoint-specific meaning, so a generic response DTO would not simplify the boundary. Injection surfaces should instead describe the smallest consumed capability. `createLichessSession` should gain an explicit minimal options contract in follow-up, including a request-only gateway surface and lightweight browser collaborators.

Implementation of the separated work argument and semantic retry gate is bounded follow-up in `backlog/2026-10-07-work-context-implementation.md`.

## Alternatives considered

Keeping the current `LichessRequestInit` shape is the smallest code change, but it permanently overloads a browser-owned field name and keeps application lifetime/scheduling semantics coupled to HTTP description.

Making the context Lichess-specific would avoid the DOM collision, but it would misplace semantics that already exist at `CurrentViewController` and `PositionRepository` before transport exists, and would make generic coalescing depend on a source-specific abstraction.

Using each caller's signal directly for a shared producer would make first-caller lifetime accidentally own equivalent later demand. Conversely, making shared producer lifetime unconditional would keep queued transport alive after all demand disappears. Repository-owned aggregation is the boundary that avoids both failures.

Wrapping `Response` in a new generic transport result would make endpoint clients reconstruct Fetch capabilities they already legitimately consume and would not solve the work/HTTP coupling.

Exposing `cooldownUntil` keeps clock arithmetic duplicated above the gateway; hiding all cooldown state would prevent higher-level retry coordination. A semantic gate preserves lower-layer ownership while exposing only the coordination capability the caller needs.

# Complete:

Record a durable decision, including a valid no-change decision, that defines the work/demand unit, lifetime and urgency ownership, coalescing semantics, HTTP-versus-scheduling boundary, gateway/session/client responsibilities, cooldown exposure, and transport response contract.

Compare the credible alternatives and their failure modes well enough that implementation no longer depends on unresolved architectural judgment. Update the authoritative architecture/component documentation with the settled model and create or reshape independently completable implementation outcomes if implementation remains. Any still-needed `createLichessSession` dependency-contract repair is explicitly included in that bounded follow-up rather than left in migration notes for rediscovery. No production-code change is required for this investigation itself to complete.

# Sync:

Use `backlog-tend` for routine maintenance of this outcome; see `skills/backlog-tend/SKILL.md`.
