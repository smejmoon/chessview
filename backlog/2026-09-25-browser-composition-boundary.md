# Do:

Once evidence request lifetime exposes subscriber-specific obsolescence, connect that subscriber capability to the value-returning evidence source without making a Nodus revision own a shared request, then run the deterministic composition suite on the exact branch tip.

# Blocked:

Evidence request lifetime must first expose a subscriber abstraction that lets one obsolete view stop participating without aborting equivalent work still needed by another subscriber; `backlog/2026-09-25-evidence-request-lifetime.md` owns that abstraction. Exact-tip deterministic verification also still requires a manual/test-capable CI run because branch Pages publication builds the application but does not execute `npm test`.

# Because:

`docs/components/interface.md` §Composition direction now records the binding composition rule: commands enter the controller; domain contributors return values; the controller publishes one immutable current view; presentation consumes it. The same component still requires stable Roots/Lines navigation, position-based history, stable graph identity, generation-scoped structural readiness, and supplementary evidence that cannot downgrade established structure.

`src/nodus-controller.js` is now the sole publication boundary. Its public snapshot contains current `center`, `mode`, orientation, derived back availability, and immutable structural/evidence lifecycle values; internal revision and history-depth mechanics are not exposed. Structural/evidence sources receive explicit inputs and return values. Superseded source results are rejected before publication rather than relying on contributors to settle lifecycle tokens or mutate shared rendered state.

`src/nodus-structure.js` owns current visible graph assembly, Root transposition preparation, persisted node enrichment, and Root PGN row metadata. `src/evidence-source.js` owns evidence acquisition/derivation and returns evidence keyed by stable relationship identity. `src/nodus-renderer.js`, `src/root-presentation.js`, and `src/eval-ui.js` consume published values and own DOM/Chessground presentation only. `src/main.js` is composition wiring and no longer mirrors current Nodus/view/orientation/loading/error state into a second mutable application-state object. Structural `loading`/`ready`/`failed` is application truth; `src/view-status.js` derives delayed `Updating…`, brief `Ready`, and check acknowledgement as presentation behavior.

`RouteLedger` owns ChessView route ↔ URL/history translation and native restoration; `PreferenceStore` owns durable choices without becoming live view state; `LichessSession` owns Lichess authentication. These boundaries remain independent of Nodus publication.

`test/nodus-controller.test.js` now covers immutable view publication, command/effect ownership, native-history restoration semantics, stale source rejection, value-returning contributor contracts, supplementary evidence independence, structural failure/recovery, redraw-versus-refresh behavior, and Lines discovery remaining structurally loading until terminal. `test/view-status.test.js` covers presentation-derived readiness timing. RouteLedger, PreferenceStore, and LichessSession retain their focused boundary tests.

# Edges:

The visible-graph selectors continue to own stable node/relationship/family identity. `nodus-structure.js` normalizes their result into the immutable structural value published by `NodusController`; presentation consumes that value rather than returning composition back into the controller.

`backlog/2026-09-25-evidence-request-lifetime.md` owns evidence-loader subscriber/coalescing semantics. The current evidence source receives a view-scoped AbortSignal only to stop obsolete derivation between awaits; it deliberately does not pass that signal into shared cloud-eval/Masters loaders because their current in-flight maps still let the first caller effectively own shared request lifetime. Final integration must replace that limitation with independent subscriber participation.

`RouteLedger` owns navigation persistence only; `PreferenceStore` owns durable user choices but not live application state; `LichessSession` owns authentication but not Lichess request scheduling. Shared `LichessGateway` serialization/rate-limit policy remains outside this outcome.

# Unsettled:

Decide the smallest subscriber capability that `EvidenceSource` should receive after `backlog/2026-09-25-evidence-request-lifetime.md` establishes independent shared-request participation, while keeping revision identity and publication decisions private to `NodusController`.

# Complete:

A single NodusController owns current-view transitions and is the only boundary that can publish asynchronous structural/evidence results as current. Native browser back/forward remains an external RouteLedger input. Contributors return domain values rather than rendering, settling controller tokens, synthesizing browser events, or discovering current state from shared DOM/module globals.

The published Nodus view is immutable and contains current Nodus/mode/orientation plus accepted structural/evidence values. Navigation depth, revision identity, persistence mechanisms, request scheduling, DOM handles, and Chessground instances remain outside it. Presentation consumes that view and may retain presentation resources only.

Critical structural failures publish failed structural state. Supplementary evidence hydrates independently, has a compact local presentation-failure summary, and cannot block or downgrade structural readiness. Readiness acknowledgement timing is derived in presentation rather than stored as competing application truth.

Deterministic tests cover immutable view publication, RouteLedger URL/history round-trip and native restoration, superseded work, critical failure/recovery, refresh/redraw behavior, supplementary evidence independence, presentation-derived readiness timing, durable preference semantics, Lichess session lifecycle, and stable visible composition handoff.

Evidence loading consumes independent subscriber obsolescence semantics from `backlog/2026-09-25-evidence-request-lifetime.md` without binding shared request lifetime to a Nodus revision.

# Steps:

After the evidence-request-lifetime outcome lands, replace evidence source's view-level abort checks with the subscriber participation contract and verify same-position coalescing remains useful to a newer view after an older view becomes obsolete.

Run the repository deterministic suite for the exact branch tip through the CI workflow or another test-capable repository mechanism; branch Pages publication remains build/preview evidence only.

# Sync:

After any implementation or verification step that changes what remains, and before ending an implementation pass, rewrite this entry around the factual work and verification still open; do not accumulate progress history. If `Complete:` is satisfied, run Backlog Close. If Close cannot pass its normal gates, leave the entry open with the blocking condition explicit.
