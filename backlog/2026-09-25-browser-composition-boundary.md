# Do:

Finish browser composition so one application controller owns render/navigation lifecycle and Root, Line, transposition, and evidence contributors receive explicit current-view state through controller APIs instead of coordinating through rendered DOM or synthetic browser events.

# Because:

`audits/2026-09-25-17-30-00-gpt-5.6-sol-chatgpt.md`, finding “UI composition is an implicit multi-writer DOM protocol,” records the original shared-DOM coupling. `docs/components/interface.md` §Requirements, §Composition direction, and §Verification require stable Roots/Lines navigation, position-based history, stable graph-edge identity in presentation, explicit current-view settlement, and a single controller-owned render/navigation lifecycle.

Current composition already has one HTML application entrypoint and controller-issued View Cycle tokens/events for structural settlement. Supplementary evidence hydrates independently of readiness and Line discovery, and critical render/structure failure has an explicit degraded terminal state. The remaining lifecycle boundary is still implicit in places: Rail navigation synthesizes `popstate`, contributor refresh can still depend on browser/DOM events rather than explicit controller calls, unexpected supplementary contributor exceptions can remain console-only at their local surface, and the real controller↔contributor seam lacks automated contract coverage.

# Edges:

`backlog/2026-09-26-visible-graph-composition.md` owns the shared Root/Line visible-graph contract, canonical convergence representation, stable node/edge rendering identity, and removal of DOM-derived graph relationships. This outcome consumes that explicit model at the controller/contributor boundary rather than recreating graph selection or presentation semantics. Controller integration should be based on that contract once it is established.

`backlog/2026-09-25-evidence-request-lifetime.md` owns evidence-loader subscriber/coalescing semantics. This outcome owns current-view generation/lifecycle context and may define that controller surface independently, but final evidence integration and superseded-generation coverage should consume the subscriber abstraction produced there rather than binding request lifetime directly to one view's `AbortSignal`.

Shared `LichessGateway` serialization/rate-limit policy remains outside this outcome. Data-loading APIs may be adapted only as needed to expose explicit state to the controller.

# Unsettled:

Choose the smallest explicit controller API for recentering, browser back/forward restoration, contributor refresh, orientation/layout refresh, and current-view settlement without creating a second hidden application state machine.

Choose the smallest integration-test seam that exercises real controller/contributor settlement, superseded navigation, critical failure/recovery, history/recentering, supplementary evidence arriving after readiness, and stable node/edge association without turning the suite into pixel/layout snapshots or adding a browser harness unless one is earned.

Decide whether unexpected supplementary presentation-code exceptions need a compact local unavailable summary beyond the existing source/evidence failure indicators; they must not downgrade an otherwise established structural view.

# Complete:

A single application owner controls the `#app` render/navigation lifecycle. Browser back/forward remains native, while application-initiated recentering, refresh, layout/orientation updates, and contributor settlement use explicit controller APIs rather than synthetic `resize`/`popstate` or equivalent DOM/browser events as an internal protocol.

Root, Line, transposition, and evaluation contributors receive explicit current-view model references and generation context from the controller. Critical structural contributor failures produce an explicit degraded terminal state; supplementary evidence failures remain locally visible without blocking or downgrading structural readiness.

Deterministic automated tests exercise the real product-critical composition boundary, including structural readiness independent of supplementary evidence, superseded generations, critical failure/recovery, URL round-tripping, representative recenter/history behavior, late evidence hydration, explicit contributor refresh, and stable position/edge association supplied by the visible-graph model.

# Steps:

Consume the explicit visible-graph contract produced by `backlog/2026-09-26-visible-graph-composition.md` and define the controller/contributor API around current-view generation, navigation, refresh, and settlement.

Replace synthetic navigation/lifecycle browser events with explicit controller calls while preserving native browser back/forward behavior and current URL semantics.

Once `backlog/2026-09-25-evidence-request-lifetime.md` supplies independent subscriber lifetime semantics, wire current-view obsolescence into evidence participation without making one view own a shared same-position request.

Route structural and supplementary contributor settlement/failure through the controller boundary without coupling supplementary evidence back into global readiness.

Add focused composition-contract tests around the real controller/contributor seam, remove obsolete synthetic-event/implicit-lifecycle coupling, and decide any remaining local summary needed for unexpected supplementary presentation failures.

# Sync:

After any implementation or verification step that changes what remains, and before ending an implementation pass, rewrite this entry around the factual work and verification still open; do not accumulate progress history. If `Complete:` is satisfied, run Backlog Close. If Close cannot pass its normal gates, leave the entry open with the blocking condition explicit.
