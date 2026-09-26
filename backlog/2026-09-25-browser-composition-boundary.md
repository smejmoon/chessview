# Do:

Once evidence request lifetime exposes subscriber-specific obsolescence, connect that subscriber capability to the value-returning evidence source without making a Nodus revision own a shared request, then run the deterministic composition suite on the exact branch tip.

# Blocked:

Evidence request lifetime must first expose a subscriber abstraction that lets one obsolete view stop participating without aborting equivalent work still needed by another subscriber; `backlog/2026-09-25-evidence-request-lifetime.md` owns that abstraction. Exact-tip deterministic verification also still requires a manual/test-capable CI run because branch Pages publication builds the application but does not execute `npm test`.

# Because:

`docs/components/interface.md` §Composition direction records the binding composition rule: commands enter the controller; domain contributors return values; the controller publishes one immutable current view; presentation consumes it. The same component still requires stable Roots/Lines navigation, position-based history, stable graph identity, generation-scoped structural readiness, and supplementary evidence that cannot downgrade established structure.

`src/nodus-controller.js` is the sole publication boundary. Its public snapshot contains current `center`, `mode`, orientation, derived back availability, and immutable structural/evidence lifecycle values; internal revision and history-depth mechanics are not exposed. Structural/evidence sources receive explicit inputs and return values. Superseded source results are rejected before publication rather than relying on contributors to settle lifecycle tokens or mutate shared rendered state.

Presentation is now a separate lifecycle-aware port. `NodusController` calls presenter `start` for a new current-view lifecycle and `update` for later publications without exposing revision identity. `src/nodus-presenter.js` owns that lifecycle edge and fail-closed presentation policy; `src/view-status.js` derives delayed `Updating…`, brief `Ready`, and check acknowledgement from structural state while resetting timing on each presenter start. `src/nodus-renderer.js`, `src/root-presentation.js`, and `src/eval-ui.js` own DOM/Chessground presentation only. A normal renderer failure is replaced by a degraded/unavailable fallback rather than changing valid structural domain state or leaving success presentation visible.

`src/nodus-structure.js` owns current visible graph projection, persisted node enrichment for the returned structural value, neighborhood selection, and Root row metadata. Reusable Root transposition graph enrichment is isolated in `src/root-enrichment.js`: target-equivalent callers share one producer, while each view can detach its wait with its own AbortSignal without cancelling the producer or a replacement caller. This producer policy is intentionally different from metered evidence work because Root enrichment persists reusable graph state.

`src/evidence-source.js` owns evidence acquisition/derivation and returns evidence keyed by stable relationship identity. `src/main.js` is composition wiring and does not mirror current Nodus/view/orientation/loading/error state into a second mutable application-state object.

`RouteLedger` owns ChessView route ↔ URL/history translation and native restoration; `PreferenceStore` owns durable choices without becoming live view state; `LichessSession` owns Lichess authentication. These boundaries remain independent of Nodus publication.

`test/nodus-controller.test.js` covers immutable view publication, command/effect ownership, presenter lifecycle edges, native-history restoration semantics, stale source rejection, value-returning contributor contracts, supplementary evidence independence, structural failure/recovery, redraw-versus-refresh behavior, and Lines discovery remaining structurally loading until terminal. `test/view-status.test.js` covers presentation-derived readiness timing including same-status replacement lifecycles. `test/nodus-presenter.test.js` covers fail-closed rendering and non-swallowed fallback failure. `test/root-enrichment.test.js` covers independent participation in target-shared Root enrichment. RouteLedger, PreferenceStore, and LichessSession retain their focused boundary tests.

# Edges:

The visible-graph selectors continue to own stable node/relationship/family identity. `nodus-structure.js` normalizes their result into the immutable structural value published by `NodusController`; presentation consumes that value rather than returning composition back into the controller.

`src/root-enrichment.js` owns reusable Root transposition producer lifetime, not current-view publication. A view signal only detaches that view from waiting; producer completion may outlive every current subscriber because the result is durable graph enrichment. This must not be generalized into evidence cancellation policy.

`backlog/2026-09-25-evidence-request-lifetime.md` owns evidence-loader subscriber/coalescing semantics. The current evidence source receives a view-scoped AbortSignal only to stop obsolete derivation between awaits; it deliberately does not pass that signal into shared cloud-eval/Masters loaders because their current in-flight maps still let the first caller effectively own shared request lifetime. Final integration must replace that limitation with independent subscriber participation and cancel queued metered work when no live subscriber remains.

`RouteLedger` owns navigation persistence only; `PreferenceStore` owns durable user choices but not live application state; `LichessSession` owns authentication but not Lichess request scheduling. Shared `LichessGateway` serialization/rate-limit policy remains outside this outcome.

# Unsettled:

Decide the smallest subscriber capability that `EvidenceSource` should receive after `backlog/2026-09-25-evidence-request-lifetime.md` establishes independent shared-request participation, while keeping revision identity and publication decisions private to `NodusController`.

# Complete:

A single NodusController owns current-view transitions and is the only boundary that can publish asynchronous structural/evidence results as current. Native browser back/forward remains an external RouteLedger input. Contributors return domain values rather than rendering, settling controller tokens, synthesizing browser events, or discovering current state from shared DOM/module globals.

The published Nodus view is immutable and contains current Nodus/mode/orientation plus accepted structural/evidence values. Navigation depth, revision identity, persistence mechanisms, request scheduling, DOM handles, and Chessground instances remain outside it. Presentation consumes that view through explicit lifecycle start/update edges and may retain presentation resources only.

Critical structural failures publish failed structural state. Supplementary evidence hydrates independently, has a compact local presentation-failure summary, and cannot block or downgrade structural readiness. Readiness acknowledgement timing is derived in presentation rather than stored as competing application truth, and replacement views reset timing even when the structural status string remains `loading`.

Normal rendering failure fails closed to a degraded/unavailable presentation without rewriting valid structural domain data; failure of the degraded fallback is surfaced rather than swallowed.

Reusable Root transposition enrichment has target-shared producer lifetime independent of a view revision, while obsolete callers can stop waiting without cancelling enrichment still useful to a replacement view.

Deterministic tests cover immutable view publication, RouteLedger URL/history round-trip and native restoration, superseded work, critical failure/recovery, refresh/redraw behavior, supplementary evidence independence, presenter lifecycle boundaries, presentation-derived readiness timing, fail-closed rendering, target-shared Root enrichment, durable preference semantics, Lichess session lifecycle, and stable visible composition handoff.

Evidence loading consumes independent subscriber obsolescence semantics from `backlog/2026-09-25-evidence-request-lifetime.md` without binding shared request lifetime to a Nodus revision.

# Steps:

After the evidence-request-lifetime outcome lands, replace evidence source's view-level abort checks with the subscriber participation contract and verify same-position coalescing remains useful to a newer view after an older view becomes obsolete.

Run the repository deterministic suite for the exact branch tip through the CI workflow or another test-capable repository mechanism; branch Pages publication remains build/preview evidence only.

# Sync:

After any implementation or verification step that changes what remains, and before ending an implementation pass, rewrite this entry around the factual work and verification still open; do not accumulate progress history. If `Complete:` is satisfied, run Backlog Close. If Close cannot pass its normal gates, leave the entry open with the blocking condition explicit.
