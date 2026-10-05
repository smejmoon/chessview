# Do:

Let current-view coordination discharge a Constellation-admitted Explorer Reading for the current Nodus run when the source/knowledge boundary reports that no usable Reading can be produced by that run's structural obligation, without manufacturing chess Evidence or teaching Constellation about provider state.

Constellation continues to expose its Reading frontier as structural admission: another usable Reading at that position could still change constrained shape. Current view combines that frontier with run-local obligation phase. A frontier position keeps structural settlement open while its obligation is actively working, waiting on a semantic retry gate, or has completed successfully but still awaits incorporation. It stops blocking only after recomposition incorporates/makes the obligation irrelevant, or after the lower boundary reports terminal unavailability for that current-run structural obligation.

Use the live keyed participation designed with `backlog/2026-10-04-refinement-participation-priority.md`: structural provenance belongs to the current participant, while terminal unavailability belongs to the current run and admitted Reading position. Replanning must not immediately reacquire a terminally discharged structural Reading in the same run, but a replacement Nodus run starts without that discharge and may try again under normal source policy.

Do not collapse a failed attempt into a final unavailable outcome. If the lower boundary judges progress may still become possible automatically in this run, the obligation is retryable and remains Settling. That boundary must either keep retry policy inside the pending operation or expose a semantic retryable result with the eligibility/wakeup condition it owns; current view resumes only when that gate opens and the obligation is still current. Terminal unavailability means that, after lower-owned fallback/recovery/retry policy is exhausted, no further automatic progress is intended for this run's obligation.

# Because:

The active Constellation is the authority for whether missing Reading knowledge could still change constrained shape, but it deliberately derives from graph facts and semantic Evidence rather than acquisition history. A failed attempt therefore leaves the same Reading frontier if composition is repeated from unchanged facts.

Current view is the boundary that owns both the live Constellation-admitted demand and the lifetime of the attempt made on behalf of that demand. It can therefore make the distinct coordination decision Constellation cannot: a structurally relevant fact remains unknown, but this run either still has a progress path, is waiting for its lower-owned retry gate, or has reached a terminal unavailable outcome.

This preserves Constellation-owned structural admission without requiring Constellation to own acquisition lifecycle. Published Nodus/Weather settlement is resolved by combining Constellation admission with current-run obligation phase. Generic task completion or failure remains insufficient, and transient retry-waiting cannot be mistaken for final settlement.

# Edges:

`docs/components/lichess-access.md` §Cache and failure semantics and the source-provider contracts continue to own cache freshness, stale fallback, successful absence, authentication handling, cooldown/transport consequences, and retry timing they can decide locally. Current view must not classify retryability or terminality from HTTP status, UI strings, or raw transport errors.

A retryable outcome crossing the provider/knowledge boundary is justified only because current view owns whether a live structural obligation can still progress. It must carry a lower-owned eligibility/wakeup condition, or the lower layer must keep the operation pending through its own retry policy; otherwise the design would either busy-loop or leave an unresolvable Settling obligation. A 429 cooldown, for example, remains gateway/provider policy rather than a status code interpreted by current view.

The terminal boundary crossing is likewise semantic and narrow: after lower layers exhaust the fallback/recovery/retry policy they own, structural Explorer work may report unavailable-for-this-run. Ordinary exceptions such as graph reconciliation/persistence failure are not automatically equivalent. Knowledge Acquisition remains retryable when it has a usable Reading but cannot finish establishing required graph knowledge; such a failure must retain a progress/retry path rather than silently discharging the structural obligation merely because the combined acquisition task rejected.

`backlog/2026-10-04-refinement-participation-priority.md` owns live participant replacement, priority, cancellation, detachment, retry-waiting, and the distinction between stable producer identity and current-view demand. This outcome owns only the additional settlement effect when a live participant corresponds to a Constellation-admitted structural Reading and that Reading reaches terminal unavailability for the run.

Do not persist the discharge in `ChartedGraph`, PositionRepository, Evidence, or provider cache state. It is current-view coordination state. A supplementary failure does not create a structural discharge. If a Reading first failed while merely supplementary and a later recomposition newly admits it structurally, current view must be free to create structural participation rather than inheriting a discharge for an obligation that did not exist when the failure occurred.

Successful completion still follows `docs/architecture/current-view.md` §Settlement coordination: completion dirties settlement, and the obligation clears only after recomposition incorporates the result or makes it irrelevant. No separate incorporation epoch is required for the unavailable path.

Before this outcome closes, reconcile the governing settlement contracts with this ownership split. `docs/architecture/current-view.md`, `docs/components/nodus.md`, `docs/components/weather.md`, and the relevant Constellation settlement wording must agree that Constellation owns structural admission/frontier, while current view resolves the current-run lifecycle of those admitted obligations for published Nodus/Weather settlement. Remove or narrow any statement that still requires Nodus/Weather settlement to equal raw Constellation frontier state when an admitted obligation has been terminally discharged for the run. Update source-provider/failure-boundary documentation as needed if a semantic retryable or unavailable result becomes part of that boundary contract.

# Complete:

Deterministic tests prove that:

- a failed supplementary task does not affect structural settlement;
- a Constellation-admitted Explorer Reading remains Settling while its structural obligation is active or retry-waiting and can still make progress;
- a retryable failure cannot be mistaken for terminal unavailability, and another attempt occurs only after the lower-owned retry gate opens while the obligation is still current;
- a semantic terminal-unavailable outcome for that structural obligation discharges only that current-run Reading obligation and allows Weather to settle when no other structural obligation remains;
- rated Reading Evidence remains unknown rather than becoming zero, negative, empty, or synthetic;
- arbitrary transport/HTTP/reconciliation exceptions are not reclassified by current view into structural unavailability;
- graph reconciliation failure after obtaining a usable Reading remains retryable and does not silently discharge the structural obligation;
- a supplementary-unavailable attempt does not pre-discharge a structural obligation admitted only later in the same run;
- the unavailable discharge is not persisted as graph, Evidence, repository, or provider truth;
- a replacement Nodus run is free to acquire the Reading again under normal source policy;
- obsolete failures, retry gates, or unavailable outcomes cannot mutate or discharge an obligation in a replacement run;
- successful structural completion continues to require incorporation before settlement;
- the governing Current View, Nodus, Weather, Constellation, and applicable source/failure contracts are reconciled with the implemented admission-versus-lifecycle ownership split before the backlog outcome closes.

# Sync:

After any implementation or verification step that changes what remains, and before ending an implementation pass, synchronize this entry. Also synchronize when an action completes or becomes unavailable, a blocking condition changes, or a judgment is settled. Rewrite around the factual work and verification still open; do not accumulate progress history. If an outcome's completion condition is satisfied, run Backlog Close for that outcome. If Close cannot pass its normal gates, leave the entry open with the blocking condition explicit.
