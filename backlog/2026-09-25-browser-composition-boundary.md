# Do:

Finish browser-history/URL verification for the Nodus composition boundary and, once evidence request lifetime exposes independent subscriber obsolescence, pass current-view participation into evidence loading without making a Nodus generation own a shared request.

# Because:

`docs/components/interface.md` §Requirements, §Composition direction, and §Verification require stable Roots/Lines navigation, position-based history, stable graph identity in presentation, explicit current-view settlement, and one controller-owned render/navigation lifecycle.

`src/nodus-controller.js` now owns Nodus/view/orientation/history transitions, generation supersession, structural settlement, contributor sequencing, and commands-in/snapshot-out state. `src/main.js` translates native browser inputs and UI intents into that controller; application recentering no longer synthesizes `popstate`, resize is a controller redraw, and `src/view-cycle.js` no longer exposes a browser-event protocol. Root preparation/decorating and evidence presentation receive explicit scoped current-view state rather than discovering current center/view from DOM. Unexpected evidence presentation failures add a local unavailable summary while remaining supplementary to structural readiness.

`test/nodus-controller.test.js` now exercises command/snapshot ownership, history restoration without synthetic navigation, stale-generation rejection, exact visible-composition handoff, encapsulated contributor capabilities, supplementary evidence independence, critical structural failure/recovery, and redraw-versus-refresh generation semantics.

# Edges:

The explicit visible-graph model is already consumed as the composition passed from the renderer through `NodusController` into Root and evidence contributors; graph selection and stable relationship identity remain owned by the visible-graph/model layer rather than this outcome.

`backlog/2026-09-25-evidence-request-lifetime.md` owns evidence-loader subscriber/coalescing semantics. NodusController deliberately does not pass its structural AbortSignal into evidence requests. Final evidence obsolescence integration should consume the independent subscriber abstraction from that outcome so superseding one view cannot abort useful coalesced work for another subscriber.

Shared `LichessGateway` serialization/rate-limit policy remains outside this outcome.

# Unsettled:

Determine whether URL round-trip and native back/forward need a small pure browser-adapter test seam beyond controller history-restoration coverage, or whether existing URL tests plus deployed preview verification establish that contract without duplicating it.

Decide the smallest evidence subscriber context NodusController should provide after `backlog/2026-09-25-evidence-request-lifetime.md` establishes that abstraction.

# Complete:

A single NodusController owns current-view state transitions and lifecycle. Native browser back/forward remains an external input; application recentering, view changes, orientation/layout redraw, contributor execution, supersession, and settlement use explicit calls and scoped capabilities rather than synthetic browser events or DOM-derived current-view state.

Critical structural failures reach the lifecycle as failures. Supplementary evidence hydrates independently, has a compact local presentation-failure summary, and cannot block or downgrade structural readiness.

Deterministic tests cover commands/snapshot ownership, browser-history restoration semantics, superseded generations, critical failure/recovery, explicit refresh/redraw behavior, supplementary evidence independence, and preservation of the visible composition supplied to contributors. URL round-trip/back-forward behavior is covered either by a focused adapter test or by equivalent existing deterministic and deployed-preview verification.

Evidence loading consumes independent subscriber obsolescence semantics from `backlog/2026-09-25-evidence-request-lifetime.md` without binding shared request lifetime to a Nodus generation.

# Steps:

Inspect existing URL/history coverage and add only the smallest missing browser-adapter seam needed for deterministic URL round-trip/back-forward verification.

Run the repository deterministic suite for the exact branch tip when the CI workflow can be invoked; branch Pages production builds verify bundling but do not run `npm test`.

After the evidence-request-lifetime outcome lands, wire Nodus current-view obsolescence into evidence subscriber participation and verify same-position coalescing remains independent of any one generation.

# Sync:

After any implementation or verification step that changes what remains, and before ending an implementation pass, rewrite this entry around the factual work and verification still open; do not accumulate progress history. If `Complete:` is satisfied, run Backlog Close. If Close cannot pass its normal gates, leave the entry open with the blocking condition explicit.