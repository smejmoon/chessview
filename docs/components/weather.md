# Weather

## Purpose

Own presentation of the current view's structural settlement/readiness state.

Weather observes and presents whether the active Constellation is [Settling](../glossary.md#settling), [Settled](../glossary.md#settled), or structurally unavailable. It does not define settlement, graph composition, or supplementary evidence meaning.

## Requirements

- Weather follows structural settlement of the active Constellation for the current view generation; a trustworthy published Constellation may remain visible and navigable while it is Settling.
- `Updating…` means the active Constellation is Settling because an admitted structural obligation can still change its shape or because a completed structural result still has to be incorporated. It does not mean that the currently shown trustworthy structure must be withheld or disabled.
- Normal `Ready` / subtle check means the active Constellation is Settled, including legitimate empty or absent structure where applicable.
- A completed structural result must be incorporated into the active Constellation before Weather may present it as Settled.
- A structural failure produces a degraded/unavailable state when it prevents Chessview from establishing trustworthy current structure. A structural obligation whose outcome has been resolved as unavailable no longer keeps the view Settling if no remaining admitted structural obligation can change the Constellation.
- Generic asynchronous, run-owned, or provider activity does not by itself make Weather `Updating…`. Only work participating in structural settlement of the active Constellation does.
- Supplementary engine, Masters, Rail, Evidence, inactive-sibling, and lookahead work may continue after structural settlement and must not reopen or downgrade a successfully established Weather state by itself.
- Supplementary failures remain local to their evidence surfaces and do not by themselves change global Weather.
- Readiness is scoped to the current view generation. Completion from obsolete work must not settle a newer view.
- Ongoing structural Settling must remain perceptible. Presentation may delay, debounce, or coalesce transient status and recomposition updates to avoid distracting fidgeting, but must not present an unsettled active Constellation as Settled merely to suppress motion.
- The normal acknowledgement stays subtle: delayed `Updating…`, a brief `Ready`, then a persistent low-emphasis settled check.
- Presentation failure must fail closed to a degraded/unavailable surface rather than leaving stale success feedback visible.

## Verification

Deterministic/browser contract tests should cover:

- a trustworthy provisional Constellation remaining visible and navigable while it is `Updating…`;
- structural recomposition republishing the current view without requiring the prior trustworthy result to disappear;
- admitted structural obligations moving Weather through `Updating…` to successful settlement;
- a completed structural result keeping Weather `Updating…` until that result is incorporated;
- legitimate empty structure settling successfully;
- failure to establish any trustworthy current structure producing a degraded/unavailable state;
- an unavailable structural outcome ceasing to block settlement once incorporated and no remaining admitted structural obligation can change the Constellation;
- supplementary engine/Masters evidence arriving, failing, or completing late without reopening successful Weather;
- generic run-owned or inactive-sibling work not driving Weather when it cannot change the active Constellation;
- obsolete generation completion being unable to settle the current view;
- fast cached structural work avoiding a distracting `Updating…` flash while still acknowledging successful settlement;
- coalesced/debounced structural recomposition avoiding unnecessary visual fidgeting without concealing that the active Constellation is still Settling;
- presentation failure replacing stale success feedback with a degraded/unavailable state.
