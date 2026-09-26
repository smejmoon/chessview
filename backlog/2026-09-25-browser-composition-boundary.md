# Do:

Once evidence request lifetime exposes subscriber-specific obsolescence, pass current-Nodus participation into evidence loading without making a Nodus generation own a shared request, then run the deterministic composition suite on the exact branch tip.

# Blocked:

Evidence request lifetime must first expose a subscriber abstraction that lets one obsolete view stop participating without aborting equivalent work still needed by another subscriber; `backlog/2026-09-25-evidence-request-lifetime.md` owns that abstraction. Exact-tip deterministic verification also still requires a manual/test-capable CI run because branch Pages publication builds the application but does not execute `npm test`.

# Because:

`docs/components/interface.md` §Requirements, §Composition direction, and §Verification require stable Roots/Lines navigation, position-based history, stable graph identity in presentation, explicit current-view settlement, and one controller-owned render/navigation lifecycle.

`src/nodus-controller.js` owns current Nodus/view/orientation transitions, generation supersession, structural settlement, contributor sequencing, and commands-in/snapshot-out state. It now depends on domain-shaped boundaries rather than a generic browser object: `RouteLedger` owns ChessView route ↔ URL/history translation and native `popstate` restoration, while `PreferenceStore` owns durable view/orientation/debug/Guide choices. `LichessSession` separately owns the Lichess OAuth/access-token lifecycle, keeping authentication mechanics out of route and preference concerns.

`test/route-ledger.test.js` covers URL/history route reading, preference fallback when `view` is absent, push/replace round-trip, and native `popstate` translation. `test/nodus-controller.test.js` covers command/snapshot ownership, history restoration without synthetic navigation, stale-generation rejection, exact visible-composition handoff, encapsulated contributor capabilities, supplementary evidence independence, critical structural failure/recovery, and redraw-versus-refresh generation semantics. `test/preference-store.test.js` and `test/lichess-session.test.js` cover the new boundary semantics independently.

# Edges:

The explicit visible-graph model is consumed as the composition passed from the renderer through `NodusController` into Root and evidence contributors; graph selection and stable relationship identity remain owned by the visible-graph/model layer rather than this outcome.

`backlog/2026-09-25-evidence-request-lifetime.md` owns evidence-loader subscriber/coalescing semantics. NodusController deliberately does not pass its structural AbortSignal into evidence requests. Final evidence obsolescence integration should consume the independent subscriber abstraction from that outcome so superseding one view cannot abort useful coalesced work for another subscriber.

`RouteLedger` owns navigation persistence only; `PreferenceStore` owns durable user choices but not live application state; `LichessSession` owns authentication but not Lichess request scheduling. Shared `LichessGateway` serialization/rate-limit policy remains outside this outcome.

# Unsettled:

Decide the smallest evidence subscriber context NodusController should provide after `backlog/2026-09-25-evidence-request-lifetime.md` establishes that abstraction.

# Complete:

A single NodusController owns current-view state transitions and lifecycle. Native browser back/forward remains an external input through RouteLedger; application recentering, view changes, orientation/layout redraw, contributor execution, supersession, and settlement use explicit calls and scoped capabilities rather than synthetic browser events or DOM-derived current-view state.

Critical structural failures reach the lifecycle as failures. Supplementary evidence hydrates independently, has a compact local presentation-failure summary, and cannot block or downgrade structural readiness.

Deterministic tests cover commands/snapshot ownership, RouteLedger URL/history round-trip and native restoration, superseded generations, critical failure/recovery, explicit refresh/redraw behavior, supplementary evidence independence, durable preference semantics, Lichess session lifecycle, and preservation of the visible composition supplied to contributors.

Evidence loading consumes independent subscriber obsolescence semantics from `backlog/2026-09-25-evidence-request-lifetime.md` without binding shared request lifetime to a Nodus generation.

# Steps:

After the evidence-request-lifetime outcome lands, wire Nodus current-view obsolescence into evidence subscriber participation and verify same-position coalescing remains independent of any one generation.

Run the repository deterministic suite for the exact branch tip through the CI workflow or another test-capable repository mechanism; branch Pages publication remains build/preview evidence only.

# Sync:

After any implementation or verification step that changes what remains, and before ending an implementation pass, rewrite this entry around the factual work and verification still open; do not accumulate progress history. If `Complete:` is satisfied, run Backlog Close. If Close cannot pass its normal gates, leave the entry open with the blocking condition explicit.