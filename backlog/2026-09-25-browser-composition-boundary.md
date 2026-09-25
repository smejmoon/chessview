# Do:

Finish browser composition so one application controller owns render/navigation lifecycle and Root/transposition/evidence contributors exchange stable node/edge keyed state instead of inferring application meaning from rendered DOM.

# Because:

`audits/2026-09-25-17-30-00-gpt-5.6-sol-chatgpt.md`, finding “UI composition is an implicit multi-writer DOM protocol,” records the original shared-DOM coupling. `docs/components/interface.md` §Requirements, §Composition direction, and §Verification require stable Roots/Lines navigation, position-based history, stable graph-edge identity in presentation, explicit current-view settlement, and a single controller-owned render/navigation lifecycle.

The lifecycle slice has now landed: `src/main.js` is the single HTML application entrypoint, controller-issued View Cycle tokens/events coordinate visible settlement, and Root/evidence contributors no longer use `MutationObserver` to discover when a render occurred. View Cycle now treats evidence work as supplementary: evidence may still receive generation-scoped tokens for stale-work identity, but it does not block or reopen successful structural readiness. The remaining composition problem is narrower: Root/evidence code still derives relationships from DOM labels/order in several places, Rail navigation still synthesizes `popstate`, critical structural contributor failure still needs an explicit degraded terminal path, unexpected supplementary contributor exceptions can still be console-only, and the real controller↔contributor seam still lacks automated contract coverage.

# Edges:

Branch-balanced discovery behavior is tracked separately in `backlog/2026-09-25-branch-balanced-discovery.md`; this outcome must preserve its graph-selection semantics but does not redesign discovery policy.

Evidence request lifetime and same-position request coalescing are tracked separately in `backlog/2026-09-25-evidence-request-lifetime.md`; this outcome may provide view-generation cancellation context, but it does not own Lichess request subscriber lifetime.

Shared `LichessGateway` serialization/rate-limit policy remains outside this outcome. Data-loading APIs may be adapted only as needed to expose explicit state to the controller.

# Unsettled:

Choose the smallest stable node/edge keyed composition model that removes remaining DOM depth/label/index inference without creating a second hidden application state machine.

Decide the smallest explicit terminal-failure contract for critical structural contributors so failure ends loading without producing the normal success-style `Ready` / check state. Supplementary evidence failure stays local and must not downgrade a structurally established view.

Choose the smallest integration-test seam that exercises real controller/contributor settlement, superseded navigation, explicit critical failure, history/recentering, and stable edge association without turning the suite into pixel/layout snapshots or adding a browser harness unless one is earned.

# Complete:

A single application owner controls the `#app` render/navigation lifecycle; core Root/evaluation composition no longer relies on `MutationObserver`, DOM row depth/label parsing, satellite/path array index pairing, or synthetic `resize`/`popstate` events to communicate application state.

Root, Line, transposition, and evaluation decorations associate through stable node/edge identifiers or equivalent explicit model references. Critical structural contributor failures produce an explicit degraded terminal state before that contributor is counted terminal; supplementary evidence failures remain locally visible without blocking or downgrading structural readiness.

Deterministic automated tests exercise the real product-critical composition boundary, including structural readiness independent of supplementary evidence, superseded generations, explicit critical failure, URL round-tripping, representative recenter/history behavior, and stable position/edge association.

# Steps:

Define the stable node/edge keyed state passed from the controller to Root/evidence contributors and migrate remaining DOM relationship inference onto it.

Replace synthetic navigation/lifecycle browser events with explicit controller APIs while preserving browser back/forward behavior.

Add an explicit degraded terminal path for critical structural contributor failure while keeping supplementary evidence failure local.

Add focused composition-contract tests around the real controller/contributor seam, then remove obsolete DOM/synthetic-event coupling once those contracts pass.

# Sync:

After any implementation or verification step that changes what remains, and before ending an implementation pass, rewrite this entry around the factual work and verification still open; do not accumulate progress history. If `Complete:` is satisfied, run Backlog Close. If Close cannot pass its normal gates, leave the entry open with the blocking condition explicit.
