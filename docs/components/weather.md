# Weather

## Purpose

Own presentation of the current view's structural settlement/readiness state.

Weather presents the structural readiness derived by [Current View](../architecture/current-view.md) from the accepted Constellation and the active refinement run. It does not define settlement, graph composition, source failure policy, or supplementary evidence meaning.

## Requirements

- A trustworthy accepted Constellation may remain visible and navigable while the same spatial projection is structurally Settling.
- `Updating…` means an admitted structural obligation has live work, is waiting on a legitimate retry gate, or has a successful result whose settlement recomposition is still pending. It does not mean that the currently shown trustworthy structure must be withheld or disabled.
- Normal `Ready` / subtle check means no admitted structural obligation currently blocks the accepted projection. The accepted Constellation may still expose a Reading frontier whose matching attempt is unavailable or whose earlier successful attempt has already had its settlement recomposition drained; the still-unknown chess fact is not converted into Evidence or removed from the frontier merely to make Weather Ready.
- A successful structural result must remain Updating while Current View marks its incorporation as pending. The participant's `satisfied` phase alone is not a readiness rule: once the corresponding settlement recomposition has been attempted, a still-recorded satisfied participant does not by itself keep Weather Updating.
- A semantic terminal-unavailable outcome stops only the matching run-local structural obligation from blocking readiness. A replacement refinement run starts without that discharge and may make the same frontier position Updating again.
- A structural failure produces a degraded/unavailable state when it prevents Chessview from establishing trustworthy current structure at all. Failure to improve an already trustworthy accepted projection is not by itself global degradation.
- Generic asynchronous, run-owned, or provider activity does not by itself make Weather `Updating…`. Only Current View's structural-readiness derivation controls the primary status.
- Supplementary engine, Masters, Rail, Evidence, and lookahead work may continue after structural settlement and must not reopen or downgrade a successfully established Weather state by itself.
- Supplementary failures remain local to their evidence surfaces and do not by themselves change global Weather.
- Readiness is scoped to the active refinement run/current projection. Completion, retry gates, or unavailable outcomes from obsolete work must not settle a replacement view.
- Root/Line mode change or Nodus change establishes a different spatial projection; Weather may therefore return to establishment even though Nodus-scoped Rail or other independent values remain usable.
- Ongoing structural Settling must remain perceptible. Presentation may delay, debounce, or coalesce transient status and recomposition updates to avoid distracting fidgeting, but must not present an unresolved live structural obligation as Ready merely to suppress motion.
- The normal acknowledgement stays subtle: delayed `Updating…`, a brief `Ready`, then a persistent low-emphasis settled check.
- Presentation failure must fail closed to a degraded/unavailable surface rather than leaving stale success feedback visible.

`failed` and `unplanned` structural participation remain explicit coordination diagnostics, but neither is an automatic-progress witness. They do not keep primary Weather `Updating…` by themselves and must not be reinterpreted as semantic source unavailability. `unplanned` is evaluated only after synchronous Current View planning has had the opportunity to attach structural participation; the transient interval before planning is not a publishable Ready state. A later refresh, replacement run, or changed plan may create new live work.

## Development diagnostics

Weather may expose several independent measures at once when Debug is enabled so lifecycle behavior can be inspected without forcing every distinction through the primary Ready/Updating state.

Debug diagnostics are intentionally terse but self-explaining: each aggregate measure remains independently hoverable/focusable with a short explanation of what it counts. The strip should remain legible as a development surface without competing with primary Weather state.

The current diagnostic surface may include:

- accepted structure lifecycle (`idle`, `loading`, `ready`, or `failed`);
- the derived Settling boolean and Constellation Reading-frontier size;
- current frontier participation counts for `working`, retry-waiting, satisfied, unavailable, failed, and unplanned structural obligations;
- the subset of successful structural participation whose settlement recomposition is still incorporation-pending;
- structurally tagged participants whose Reading is no longer present in the accepted frontier;
- active and total supplementary refinement participation.

These measures are observations, not new authorities. In particular, `satisfied` records execution phase while `incorporationPending` records whether that successful result still has an automatic settlement step left. Showing `failed 1`, `unplanned 1`, or a nonzero frontier does not by itself define source unavailability or chess knowledge.

Debug diagnostics stay aggregate. Do not expose task keys, canonical-position identities, provider names, source payloads, transport state, retry timestamps, or run/revision tokens through Weather. Normal non-Debug Weather remains the compact product status rather than becoming a permanent engineering dashboard.

## Verification

Deterministic/browser contract tests should cover:

- a trustworthy accepted Constellation remaining visible and navigable while its same projection is `Updating…`;
- refresh and material-capacity/new-knowledge recomposition republishing the same projection without requiring the prior trustworthy result to disappear;
- changing Root/Line mode or Nodus establishing new spatial structure rather than presenting the old projection under new inputs;
- admitted structural obligations moving Weather through live work/retry waiting to successful incorporation;
- a retryable structural outcome remaining `Updating…` until its lower-owned gate permits another attempt;
- a successful structural result keeping Weather `Updating…` while incorporation is pending, then ceasing to block solely because the satisfied phase remains after the settlement pass;
- a semantic terminal-unavailable outcome ceasing to block the matching run-local obligation without manufacturing Evidence or changing Constellation's Reading frontier;
- refresh being free to make that same Reading obligation `Updating…` again in a replacement run;
- legitimate empty structure settling successfully;
- failure to establish any trustworthy current structure producing a degraded/unavailable state;
- supplementary engine/Masters evidence arriving, failing, or completing late without reopening successful Weather;
- generic run-owned work not driving Weather when it cannot change the accepted Constellation;
- obsolete completion, retry gates, and unavailable outcomes being unable to settle the current view;
- fast cached structural work avoiding a distracting `Updating…` flash while still acknowledging successful settlement;
- coalesced/debounced structural recomposition avoiding unnecessary visual fidgeting without concealing unresolved structural work;
- no Ready publication occurring between Reading-frontier admission and synchronous refinement-participation reconciliation;
- failed and unplanned structural coordination remaining visible in Debug while primary Weather is Ready when no working, retry-waiting, or incorporation-pending witness remains;
- Debug Weather reporting aggregate frontier/phase/incorporation/supplementary measures supplied by Current View without exposing per-task or per-position identity;
- disabling Debug removing the diagnostic readout without changing structural readiness;
- presentation failure replacing stale success feedback with a degraded/unavailable state.
