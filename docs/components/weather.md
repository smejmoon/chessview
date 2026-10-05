# Weather

## Purpose

Own presentation of the current view's structural settlement/readiness state.

Weather presents the structural readiness derived by [Current View](../architecture/current-view.md) from the accepted Constellation and the active refinement run. It does not define settlement, graph composition, source failure policy, or supplementary evidence meaning.

## Requirements

- A trustworthy accepted Constellation may remain visible and navigable while Current View is structurally Settling.
- `Updating…` means an admitted structural obligation can still change the accepted Constellation, is waiting on a legitimate retry gate, or a completed structural result still has to be incorporated. It does not mean that the currently shown trustworthy structure must be withheld or disabled.
- Normal `Ready` / subtle check means no admitted structural obligation still blocks the accepted current view. The accepted Constellation may still expose a Reading frontier whose matching obligation was semantically unavailable for this refinement run; that unknown chess fact is not converted into Evidence or removed from the frontier merely to make Weather Ready.
- A completed structural result must be incorporated into the accepted Constellation, or made irrelevant by recomposition, before Weather may present Ready.
- A semantic terminal-unavailable outcome stops only the matching run-local structural obligation from blocking readiness. A replacement refinement run starts without that discharge and may make the same frontier position Updating again.
- A structural failure produces a degraded/unavailable state when it prevents Chessview from establishing trustworthy current structure at all. Failure to improve an already trustworthy accepted view is not by itself global degradation.
- Generic asynchronous, run-owned, or provider activity does not by itself make Weather `Updating…`. Only live work corresponding to Constellation-admitted structural obligations participates.
- Supplementary engine, Masters, Rail, Evidence, and lookahead work may continue after structural settlement and must not reopen or downgrade a successfully established Weather state by itself.
- Supplementary failures remain local to their evidence surfaces and do not by themselves change global Weather.
- Readiness is scoped to the active refinement run/current view. Completion, retry gates, or unavailable outcomes from obsolete work must not settle a replacement view.
- Ongoing structural Settling must remain perceptible. Presentation may delay, debounce, or coalesce transient status and recomposition updates to avoid distracting fidgeting, but must not present an unresolved live structural obligation as Ready merely to suppress motion.
- The normal acknowledgement stays subtle: delayed `Updating…`, a brief `Ready`, then a persistent low-emphasis settled check.
- Presentation failure must fail closed to a degraded/unavailable surface rather than leaving stale success feedback visible.

## Development diagnostics

Weather may expose several independent measures at once when Debug is enabled so lifecycle behavior can be inspected without forcing every distinction through the primary Ready/Updating state.

The current diagnostic surface may include:

- accepted structure lifecycle (`idle`, `loading`, `ready`, or `failed`);
- the derived Settling boolean and Constellation Reading-frontier size;
- current frontier participation counts for `working`, retry-waiting, satisfied, unavailable, failed, and unplanned structural obligations;
- structurally tagged participants whose Reading is no longer present in the accepted frontier;
- active and total supplementary refinement participation.

These measures are observations, not new authorities. Showing `failed 1`, `unplanned 1`, or a nonzero frontier does not by itself decide whether Weather should be Updating; the primary state still follows Current View's structural-readiness derivation. During development the measures may deliberately expose a surprising or stuck combination so the owning contract can be corrected rather than hidden behind a cleaner label.

Debug diagnostics stay aggregate. Do not expose task keys, canonical-position identities, provider names, source payloads, transport state, retry timestamps, or run/revision tokens through Weather. Normal non-Debug Weather remains the compact product status rather than becoming a permanent engineering dashboard.

## Verification

Deterministic/browser contract tests should cover:

- a trustworthy provisional Constellation remaining visible and navigable while Weather is `Updating…`;
- structural recomposition republishing the current view without requiring the prior trustworthy result to disappear;
- admitted structural obligations moving Weather through `Updating…` to successful incorporation;
- a retryable structural outcome remaining `Updating…` until its lower-owned gate permits another attempt;
- a completed structural result keeping Weather `Updating…` until that result is incorporated or made irrelevant;
- a semantic terminal-unavailable outcome ceasing to block the matching run-local obligation without manufacturing Evidence or changing Constellation's Reading frontier;
- refresh being free to make that same Reading obligation `Updating…` again in a replacement run;
- legitimate empty structure settling successfully;
- failure to establish any trustworthy current structure producing a degraded/unavailable state;
- supplementary engine/Masters evidence arriving, failing, or completing late without reopening successful Weather;
- generic run-owned work not driving Weather when it cannot change the accepted Constellation;
- obsolete completion, retry gates, and unavailable outcomes being unable to settle the current view;
- fast cached structural work avoiding a distracting `Updating…` flash while still acknowledging successful settlement;
- coalesced/debounced structural recomposition avoiding unnecessary visual fidgeting without concealing unresolved structural work;
- Debug Weather reporting the aggregate frontier/phase/supplementary measures supplied by Current View without exposing per-task or per-position identity;
- disabling Debug removing the diagnostic readout without changing structural readiness;
- presentation failure replacing stale success feedback with a degraded/unavailable state.
