# Weather

## Purpose

Own the current view's structural lifecycle/readiness semantics and the user-facing status derived from them.

Weather describes whether the current view is still settling, successfully established, or terminally degraded. It does not own graph composition or supplementary evidence meaning.

## Requirements

- Weather follows structural settlement for the current view generation; a trustworthy published Constellation may remain visible and navigable while that settlement is still in progress.
- `Updating…` means unresolved structural work can still materially change the published Constellation or its structural associations. It does not mean that the currently shown trustworthy structure must be withheld or disabled.
- Normal `Ready` / subtle check means the critical visible structure has settled successfully, including legitimate empty or absent structure where applicable.
- A structural failure produces a degraded/unavailable state when it prevents Chessview from establishing trustworthy current structure. Failure to obtain further refinement for an already trustworthy published view does not by itself invalidate that view.
- Supplementary evidence may continue hydrating after structural readiness and must not reopen or downgrade a successfully established Weather state.
- Supplementary failures remain local to their evidence surfaces and do not by themselves change global Weather.
- Readiness is scoped to the current view generation. Completion from obsolete work must not settle a newer view.
- Background work that cannot alter the current Constellation does not block Weather.
- Ongoing structural refinement must remain perceptible. Presentation may delay, debounce, or coalesce transient status and recomposition updates to avoid distracting fidgeting, but must not present an unsettled view as settled merely to suppress motion.
- The normal acknowledgement stays subtle: delayed `Updating…`, a brief `Ready`, then a persistent low-emphasis settled check.
- Presentation failure must fail closed to a degraded/unavailable surface rather than leaving stale success feedback visible.

## Verification

Deterministic/browser contract tests should cover:

- a trustworthy provisional Constellation remaining visible and navigable while structural work is still `Updating…`;
- structural refinement republishing the current view without requiring the prior trustworthy result to disappear;
- critical structural work moving Weather through loading to successful settlement;
- legitimate empty structure settling successfully;
- failure to establish any trustworthy current structure producing a degraded/unavailable state;
- failed further refinement preserving an already trustworthy published view while reaching a terminal unsettled dependency outcome;
- supplementary evidence arriving, failing, or completing late without reopening successful Weather;
- obsolete generation completion being unable to settle the current view;
- fast cached structural work avoiding a distracting `Updating…` flash while still acknowledging successful settlement;
- coalesced/debounced refinement avoiding unnecessary visual fidgeting without concealing that the view is still settling;
- presentation failure replacing stale success feedback with a degraded/unavailable state.
