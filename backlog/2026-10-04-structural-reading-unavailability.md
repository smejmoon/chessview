# Do:

Finish identifying what should fill the **Nodus session — “what is current”** role. Adjacent ownership is explicit: [Lens](../docs/components/lens.md) owns presentation-only state/preferences such as orientation, Guide, and Debug plus presentation environment and derived geometry/constraints; `RouteLedger` owns browser address/history mechanics and Back availability, serializing only canonical center plus Root/Line mode in the URL and keeping private browser-entry ancestry metadata outside Nodus state. Neither belongs to Nodus-session identity. The remaining session question is the owner whose lifetime is the user's current Nodus: canonical center, active Root/Line mode, accepted trustworthy Constellation projection(s), Rail/Evidence presentation values, and published structural readiness/Weather state that should survive refresh or failed refinement.

Use that ownership result to separate the durable session from a **refinement run — “what are we currently trying to improve”**. Run-local cancellation, live source-work participation, retry waiting, successful-but-not-yet-incorporated work, terminal unavailability, and recomposition scheduling should die with the refinement attempt rather than with the accepted Nodus view. Do not implement structural Reading discharge until this session/run boundary has one natural owner.

Then let the run-local owner discharge a Constellation-admitted Explorer Reading when the source/knowledge boundary reports that no usable Reading can be produced by that run's structural obligation, without manufacturing chess Evidence or teaching Constellation about provider state.

Constellation continues to expose its Reading frontier as structural admission: another usable Reading at that position could still change constrained shape. The Nodus-session/current-view owner combines that frontier with its active refinement run. A frontier position keeps structural settlement open while its obligation is actively working, waiting on a semantic retry gate, or has completed successfully but still awaits incorporation. It stops blocking only after recomposition incorporates/makes the obligation irrelevant, or after the lower boundary reports terminal unavailability for that refinement run's structural obligation.

Use the live keyed participation designed with `backlog/2026-10-04-refinement-participation-priority.md`: structural provenance belongs to the current participant, while terminal unavailability belongs to the current refinement run and admitted Reading position. Replanning must not immediately reacquire a terminally discharged structural Reading in the same run, but a replacement refinement run starts without that discharge and may try again under normal source policy even when the accepted Nodus session remains the same.

Do not collapse a failed attempt into a final unavailable outcome. If the lower boundary judges progress may still become possible automatically in this run, the obligation is retryable and remains Settling. That boundary must either keep retry policy inside the pending operation or expose a semantic retryable result with the eligibility/wakeup condition it owns; the run resumes only when that gate opens and the obligation is still current. Terminal unavailability means that, after lower-owned fallback/recovery/retry policy is exhausted, no further automatic progress is intended for this run's obligation.

# Because:

The current architecture still conflates two lifetimes inside `NodusController`/Current View: the accepted Nodus-centered view that should remain usable while refinement changes or fails, and the ephemeral work attempting to improve that view. Structural unavailability is run-local by definition, so placing it correctly depends first on identifying the durable owner of “what is current” and the child lifetime of refinement work.

Presentation and browser navigation no longer muddy that ownership question. Lens is authoritative for live orientation and presentation choices and derives composition constraints from presentation conditions. `RouteLedger` is authoritative for the URL-addressable `{center, view}` route, private browser-entry metadata, restoration, and Back availability. `NodusController` may publish Lens orientation and RouteLedger's `canGoBack` affordance, but it maintains neither a second orientation truth nor browser-history depth/state. The Nodus-session investigation can therefore focus on product/current-view state rather than absorbing unrelated UI or history state.

The active Constellation is the authority for whether missing Reading knowledge could still change constrained shape, but it deliberately derives from graph facts and semantic Evidence rather than acquisition history. A failed attempt therefore leaves the same Reading frontier if composition is repeated from unchanged facts.

Whichever boundary owns the Nodus session also owns the accepted Constellation and publication lifetime; its active refinement run owns the attempt made on behalf of Constellation-admitted demand. Together they can make the coordination decision Constellation cannot: a structurally relevant fact remains unknown, but the current run either still has a progress path, is waiting for its lower-owned retry gate, or has reached terminal unavailability.

This preserves Constellation-owned structural admission without requiring Constellation to own acquisition lifecycle. Published Nodus/Weather settlement is resolved from the accepted Constellation plus active-run obligation phase. Generic task completion or failure remains insufficient, and transient retry-waiting cannot be mistaken for final settlement.

# Edges:

The Nodus-session investigation is about ownership and lifetime, not introducing another stateful service by default. Keep presentation preferences/environment/constraints in Lens, browser routing/history and Back availability in `RouteLedger`, source-facet state and shared producer lifetime in `PositionRepository`, source-specific policy in providers, transport policy in `LichessGateway`, and Constellation composition as derived value unless concrete evidence requires moving one of those boundaries.

Root/Line mode is Nodus/current-view state even though `RouteLedger` serializes it in the URL and Lens consumes it as presentation context when deriving geometry and capacities. URL serialization does not make `RouteLedger` the semantic owner of mode, just as Lens consumption does not make Lens the owner. A material Lens capacity change may request same-Nodus recomposition; this does not make Lens an owner of Constellation shape or Nodus identity.

`docs/components/lichess-access.md` §Cache and failure semantics and the source-provider contracts continue to own cache freshness, stale fallback, successful absence, authentication handling, cooldown/transport consequences, and retry timing they can decide locally. The Nodus-session/refinement-run layer must not classify retryability or terminality from HTTP status, UI strings, or raw transport errors.

A retryable outcome crossing the provider/knowledge boundary is justified only because the refinement run owns whether a live structural obligation can still progress. It must carry a lower-owned eligibility/wakeup condition, or the lower layer must keep the operation pending through its own retry policy; otherwise the design would either busy-loop or leave an unresolvable Settling obligation. A 429 cooldown, for example, remains gateway/provider policy rather than a status code interpreted by current view.

The terminal boundary crossing is likewise semantic and narrow: after lower layers exhaust the fallback/recovery/retry policy they own, structural Explorer work may report unavailable-for-this-run. Ordinary exceptions such as graph reconciliation/persistence failure are not automatically equivalent. Knowledge Acquisition remains retryable when it has a usable Reading but cannot finish establishing required graph knowledge; such a failure must retain a progress/retry path rather than silently discharging the structural obligation merely because the combined acquisition task rejected.

`backlog/2026-10-04-refinement-participation-priority.md` owns live participant replacement, priority, cancellation, detachment, retry-waiting, and the distinction between stable producer identity and current-view demand. This outcome owns the session/run placement needed before that participation can drive the additional settlement effect for a Constellation-admitted structural Reading that reaches terminal unavailability.

Do not persist the discharge in `ChartedGraph`, PositionRepository, Evidence, provider cache state, Lens, or RouteLedger. It is refinement-run coordination state. A supplementary failure does not create a structural discharge. If a Reading first failed while merely supplementary and a later recomposition newly admits it structurally, the active run must be free to create structural participation rather than inheriting a discharge for an obligation that did not exist when the failure occurred.

Successful completion still follows the incorporation rule in `docs/architecture/current-view.md`: completion dirties settlement, and the obligation clears only after recomposition incorporates the result or makes it irrelevant. No separate incorporation epoch is required for the unavailable path.

Before this outcome closes, reconcile the governing current-view/session contracts with the chosen ownership split. `docs/architecture/current-view.md`, `docs/components/nodus.md`, `docs/components/weather.md`, and the relevant Constellation settlement wording must agree on which owner represents the durable current Nodus view, which owner represents a refinement run, that Constellation owns structural admission/frontier, and that published settlement combines accepted structure with active-run lifecycle. Update source-provider/failure-boundary documentation as needed if a semantic retryable or unavailable result becomes part of that boundary contract.

# Unsettled:

- Which existing or reshaped abstraction should own the Nodus session — “what is current” — and therefore the accepted current-view lifetime now that Lens and RouteLedger are explicitly outside it?
- Which current-view state belongs to that session versus to a replaceable refinement run, especially active mode, accepted Constellations, Rail/Evidence presentation values, Weather/settlement, revision/currentness, and recomposition machinery?
- Does a refresh of the same Nodus replace only the refinement run while preserving the session and its accepted trustworthy view, and do Recenter/history restoration replace the session itself?
- Once that boundary is chosen, where should final Settling/Settled derivation live so it is derived from Constellation frontier plus active-run phases rather than duplicated mutable truth?

# Complete:

The session/run ownership question is resolved and reflected in code/docs before structural unavailability is implemented. Deterministic tests then prove that:

- Lens-owned orientation/presentation state and RouteLedger-owned browser address/history state remain outside Nodus-session identity;
- RouteLedger alone derives Back availability from private browser-entry metadata while the shareable URL contains only the canonical center and Root/Line mode;
- a failed supplementary task does not affect structural settlement;
- a Constellation-admitted Explorer Reading remains Settling while its structural obligation is active or retry-waiting and can still make progress;
- a retryable failure cannot be mistaken for terminal unavailability, and another attempt occurs only after the lower-owned retry gate opens while the obligation is still current;
- a semantic terminal-unavailable outcome for that structural obligation discharges only that refinement-run Reading obligation and allows Weather to settle when no other structural obligation remains;
- rated Reading Evidence remains unknown rather than becoming zero, negative, empty, or synthetic;
- arbitrary transport/HTTP/reconciliation exceptions are not reclassified by the session/run owner into structural unavailability;
- graph reconciliation failure after obtaining a usable Reading remains retryable and does not silently discharge the structural obligation;
- a supplementary-unavailable attempt does not pre-discharge a structural obligation admitted only later in the same run;
- the unavailable discharge is not persisted as graph, Evidence, repository, provider, Lens, or navigation truth;
- a replacement refinement run is free to acquire the Reading again under normal source policy, including refresh of the same Nodus session;
- replacing the Nodus session makes obsolete failures, retry gates, or unavailable outcomes from the old run unable to mutate the new session;
- successful structural completion continues to require incorporation before settlement;
- the governing Current View/Nodus-session, Nodus, Weather, Constellation, Lens, and applicable source/failure contracts are reconciled with the implemented ownership splits before the backlog outcome closes.

# Sync:

After any implementation or verification step that changes what remains, and before ending an implementation pass, synchronize this entry. Also synchronize when an action completes or becomes unavailable, a blocking condition changes, or a judgment is settled. Rewrite around the factual work and verification still open; do not accumulate progress history. If an outcome's completion condition is satisfied, run Backlog Close for that outcome. If Close cannot pass its normal gates, leave the entry open with the blocking condition explicit.
