# Do:

Implement the documented Current View / refinement-run split before adding
structural Reading discharge.

Keep **Nodus** equal to its canonical product meaning: the one canonical
position currently organizing the map. Do not introduce a Nodus session object
or make Nodus own mode, accepted Constellation/Rail values, settlement,
presentation, navigation, source state, or refinement lifecycle.

Reshape the current-view implementation so the accepted trustworthy view around
the Nodus is separate from a replaceable **refinement run — “what are we
currently trying to improve”**. Current View owns active mode, the accepted
Constellation and Rail/publication state, and which asynchronous results may
become current. Its active refinement run owns run-local cancellation,
current-view source participation, retry waiting, successful-but-not-yet-
incorporated work, terminal unavailability, and recomposition scheduling.

Then let the run-local owner discharge a Constellation-admitted Explorer Reading
when the source/knowledge boundary reports that no usable Reading can be produced
by that run's structural obligation, without manufacturing chess Evidence or
teaching Constellation about provider state.

Constellation continues to expose its Reading frontier as structural admission:
another usable Reading at that position could still change constrained shape.
Current View combines that frontier with its active refinement run. A frontier
position keeps structural settlement open while its obligation is actively
working, waiting on a semantic retry gate, or has completed successfully but
still awaits incorporation. It stops blocking only after recomposition
incorporates/makes the obligation irrelevant, or after the lower boundary
reports terminal unavailability for that refinement run's structural obligation.

Use the live keyed participation designed with
`backlog/2026-10-04-refinement-participation-priority.md`: structural provenance
belongs to the current participant, while terminal unavailability belongs to the
current refinement run and admitted Reading position. Replanning must not
immediately reacquire a terminally discharged structural Reading in the same run,
but a replacement refinement run starts without that discharge and may try again
under normal source policy even while the Nodus remains the same.

Do not collapse a failed attempt into a final unavailable outcome. If the lower
boundary judges progress may still become possible automatically in this run,
the obligation is retryable and remains Settling. That boundary must either keep
retry policy inside the pending operation or expose a semantic retryable result
with the eligibility/wakeup condition it owns; the run resumes only when that
gate opens and the obligation is still current. Terminal unavailability means
that, after lower-owned fallback/recovery/retry policy is exhausted, no further
automatic progress is intended for this run's obligation.

# Because:

The canonical product term is already sufficient: Nodus is the canonical
position currently organizing the map. Treating “Nodus session” as the owner of
all state that happens to surround that position creates a second, broader
meaning and couples state with different change reasons and lifetimes.

The actual architectural distinction is between the accepted Current View and
the ephemeral refinement work trying to improve it. The trustworthy accepted
view should remain usable while refinement changes, retries, or fails. Structural
unavailability is run-local by definition, so it belongs to the refinement run,
not to Nodus or durable accepted chess/view state.

Presentation and browser navigation remain separate authorities. Lens owns live
orientation and presentation choices plus presentation environment and derived
geometry/constraints. `RouteLedger` owns the serialized `{center, view}` address,
private browser-entry metadata, restoration, and Back availability. URL
co-location does not make mode part of Nodus identity, and published orientation
or Back affordances do not make Current View their mutable owner.

The active accepted Constellation is the authority for whether missing Reading
knowledge could still change constrained shape, but it deliberately derives from
graph facts and semantic Evidence rather than acquisition history. A failed
attempt therefore leaves the same Reading frontier if composition is repeated
from unchanged facts.

Current View plus its active refinement run can make the coordination decision
Constellation cannot: a structurally relevant fact remains unknown, but the
current run either still has a progress path, is waiting for its lower-owned
retry gate, or has reached terminal unavailability.

# Edges:

This outcome does not require a new stateful Nodus abstraction. `docs/components/nodus.md`
now keeps Nodus to canonical-position identity and Recenter-facing product
semantics; `docs/architecture/current-view.md` assigns accepted view state and
refinement lifetime to Current View.

There is one semantically current Constellation around the one Nodus. Root/Line
mode is a Current View/composition input, not Nodus identity and not a Lens
preference. An implementation may cache another-mode derivation, but such a cache
is not another accepted semantic projection and does not independently own
settlement.

Keep presentation preferences/environment/constraints in Lens, browser
routing/history and Back availability in `RouteLedger`, source-facet state and
shared producer lifetime in `PositionRepository`, source-specific policy in
providers, transport policy in `LichessGateway`, and Constellation composition as
derived value unless concrete evidence requires moving one of those boundaries.

`docs/components/lichess-access.md` §Cache and failure semantics and the
source-provider contracts continue to own cache freshness, stale fallback,
successful absence, authentication handling, cooldown/transport consequences,
and retry timing they can decide locally. Current View/refinement-run code must
not classify retryability or terminality from HTTP status, UI strings, or raw
transport errors.

A retryable outcome crossing the provider/knowledge boundary is justified only
because the refinement run owns whether a live structural obligation can still
progress. It must carry a lower-owned eligibility/wakeup condition, or the lower
layer must keep the operation pending through its own retry policy; otherwise the
design would either busy-loop or leave an unresolvable Settling obligation.

The terminal boundary crossing is likewise semantic and narrow: after lower
layers exhaust the fallback/recovery/retry policy they own, structural Explorer
work may report unavailable-for-this-run. Ordinary exceptions such as graph
reconciliation/persistence failure are not automatically equivalent. Knowledge
Acquisition remains retryable when it has a usable Reading but cannot finish
establishing required graph knowledge.

`backlog/2026-10-04-refinement-participation-priority.md` owns live participant
replacement, priority, cancellation, detachment, retry-waiting, and the
distinction between stable producer identity and current-view demand. This
outcome owns the Current View/refinement-run placement needed before that
participation can drive settlement discharge.

Do not persist the discharge in `ChartedGraph`, PositionRepository, Evidence,
provider cache state, Lens, RouteLedger, Nodus identity, or the accepted
Constellation. It is refinement-run coordination state. A supplementary failure
does not create a structural discharge. If a Reading first failed while merely
supplementary and a later recomposition newly admits it structurally, the active
run must be free to create structural participation rather than inheriting a
discharge for an obligation that did not exist when the failure occurred.

Successful completion still follows the incorporation rule in
`docs/architecture/current-view.md`: completion dirties settlement, and the
obligation clears only after recomposition incorporates the result or makes it
irrelevant. No separate incorporation epoch is required for the unavailable
path.

# Unsettled:

- What concrete code shape should replace the current mixture of accepted-view
  state and run state inside `NodusController` while adding no unnecessary
  service/object boundary?
- Which existing `NodusController` fields are accepted Current View state versus
  replaceable refinement-run state, especially projection caches, Rail,
  revision/currentness, and recomposition queues?
- Where should final Settling/Settled derivation live so it is computed from the
  accepted Constellation frontier plus active-run participant phases rather than
  duplicated mutable truth?

# Complete:

The documented Nodus / Current View / refinement-run split is reflected in code
before structural unavailability is considered complete. Deterministic tests
then prove that:

- Nodus remains exactly one canonical position; mode, accepted Constellation/Rail
  state, refinement lifecycle, Lens state, and browser-history state remain
  outside its identity;
- refresh keeps the same Nodus and accepted trustworthy view while replacing the
  refinement run, while Recenter/history restoration to another canonical
  position replaces the Nodus and run;
- Root/Line mode switching keeps the same Nodus and does not create sibling
  semantic Nodus projection lifetimes;
- Lens-owned orientation/presentation state and RouteLedger-owned browser
  address/history state remain outside accepted-view identity;
- RouteLedger alone derives Back availability from private browser-entry metadata
  while the shareable URL contains only the canonical center and Root/Line mode;
- a failed supplementary task does not affect structural settlement;
- a Constellation-admitted Explorer Reading remains Settling while its structural
  obligation is active or retry-waiting and can still make progress;
- a retryable failure cannot be mistaken for terminal unavailability, and another
  attempt occurs only after the lower-owned retry gate opens while the obligation
  is still current;
- a semantic terminal-unavailable outcome for that structural obligation
  discharges only that refinement-run Reading obligation and allows Weather to
  settle when no other structural obligation remains;
- rated Reading Evidence remains unknown rather than becoming zero, negative,
  empty, or synthetic;
- arbitrary transport/HTTP/reconciliation exceptions are not reclassified by
  Current View into structural unavailability;
- graph reconciliation failure after obtaining a usable Reading remains retryable
  and does not silently discharge the structural obligation;
- a supplementary-unavailable attempt does not pre-discharge a structural
  obligation admitted only later in the same run;
- the unavailable discharge is not persisted as graph, Evidence, repository,
  provider, Lens, RouteLedger, Nodus, or accepted-Con\-stellation truth;
- a replacement refinement run is free to acquire the Reading again under normal
  source policy, including refresh while the same position remains the Nodus;
- replacing the Nodus/current view makes obsolete failures, retry gates, or
  unavailable outcomes from the old run unable to mutate the replacement;
- successful structural completion continues to require incorporation before
  settlement;
- the governing Current View, Nodus, Weather, Constellation, Lens, and applicable
  source/failure contracts agree with the implemented ownership split before the
  backlog outcome closes.

# Sync:

After any implementation or verification step that changes what remains, and
before ending an implementation pass, synchronize this entry. Also synchronize
when an action completes or becomes unavailable, a blocking condition changes,
or a judgment is settled. Rewrite around the factual work and verification
still open; do not accumulate progress history. If an outcome's completion
condition is satisfied, run Backlog Close for that outcome. If Close cannot pass
its normal gates, leave the entry open with the blocking condition explicit.
