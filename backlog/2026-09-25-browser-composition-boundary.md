# Do:

Finish browser composition so one application controller owns render/navigation lifecycle and Root/transposition/evidence contributors exchange stable node/edge keyed state instead of inferring application meaning from rendered DOM.

# Because:

`audits/2026-09-25-17-30-00-gpt-5.6-sol-chatgpt.md`, finding “UI composition is an implicit multi-writer DOM protocol,” records the original shared-DOM coupling. `docs/components/interface.md` §Requirements, §Composition direction, and §Verification require stable Roots/Lines navigation, position-based history, stable graph-edge identity in presentation, explicit current-view settlement, and a single controller-owned render/navigation lifecycle.

Current composition already has a single HTML application entrypoint and controller-issued View Cycle tokens/events for structural settlement. Supplementary evidence hydrates independently of readiness and Line discovery. Critical render/structure failure has an explicit degraded terminal state. Line neighborhood selection also now carries explicit inherited `lineShare` model state from the center move through descendants, so connector popularity width no longer has to be inferred from rendered labels.

The remaining composition problem is narrower: Root/evidence code still derives edge relationships from DOM labels/order in several places, connector-quality decoration still pairs path/satellite arrays by rendered index rather than stable edge identity, Rail navigation still synthesizes `popstate`, unexpected supplementary contributor exceptions can still be console-only at their local surface, and the real controller↔contributor seam still lacks automated contract coverage.

# Edges:

Branch-balanced discovery behavior is tracked separately in `backlog/2026-09-25-branch-balanced-discovery.md`; this outcome must preserve its graph-selection semantics but does not redesign discovery policy.

Evidence request lifetime and same-position request coalescing are tracked separately in `backlog/2026-09-25-evidence-request-lifetime.md`; this outcome may provide view-generation cancellation context, but it does not own Lichess request subscriber lifetime.

Shared `LichessGateway` serialization/rate-limit policy remains outside this outcome. Data-loading APIs may be adapted only as needed to expose explicit state to the controller.

# Unsettled:

Choose the smallest stable node/edge keyed composition model that removes the remaining DOM depth/label/index inference without creating a second hidden application state machine.

Choose the smallest integration-test seam that exercises real controller/contributor settlement, superseded navigation, critical failure/recovery, history/recentering, supplementary evidence arriving after readiness, and stable edge association without turning the suite into pixel/layout snapshots or adding a browser harness unless one is earned.

Decide whether unexpected supplementary presentation-code exceptions need a compact local unavailable summary beyond the existing source/evidence failure indicators; they must not downgrade an otherwise established structural view.

# Complete:

A single application owner controls the `#app` render/navigation lifecycle; core Root/evaluation composition no longer relies on `MutationObserver`, DOM row depth/label parsing, satellite/path array index pairing, or synthetic `resize`/`popstate` events to communicate application state.

Root, Line, transposition, and evaluation decorations associate through stable node/edge identifiers or equivalent explicit model references. Critical structural contributor failures produce an explicit degraded terminal state; supplementary evidence failures remain locally visible without blocking or downgrading structural readiness.

Deterministic automated tests exercise the real product-critical composition boundary, including structural readiness independent of supplementary evidence, superseded generations, critical failure/recovery, URL round-tripping, representative recenter/history behavior, late evidence hydration, and stable position/edge association.

# Steps:

Define the remaining stable node/edge keyed state passed from the controller to Root/evidence contributors and migrate DOM relationship inference onto it.

Replace synthetic navigation/lifecycle browser events with explicit controller APIs while preserving browser back/forward behavior.

Add focused composition-contract tests around the real controller/contributor seam, then remove obsolete DOM/synthetic-event coupling once those contracts pass.

Decide and implement any remaining local summary needed for unexpected supplementary presentation failures without coupling them back into global readiness.

# Sync:

After any implementation or verification step that changes what remains, and before ending an implementation pass, rewrite this entry around the factual work and verification still open; do not accumulate progress history. If `Complete:` is satisfied, run Backlog Close. If Close cannot pass its normal gates, leave the entry open with the blocking condition explicit.
