# Weather

## Purpose

Own the current view's structural lifecycle/readiness semantics and the user-facing status derived from them.

Weather describes whether the current view is still settling, successfully established, or terminally degraded. It does not own graph composition or supplementary evidence meaning.

## Requirements

- Weather follows critical structural work for the current view generation.
- `Updating…` means unresolved critical structural work can still materially change the Constellation or its structural associations.
- Normal `Ready` / subtle check means the critical visible structure has been established successfully, including legitimate empty or absent structure where applicable.
- A critical structural failure is terminal for loading but must produce a degraded/unavailable state rather than the normal success-style `Ready` / check state.
- Supplementary evidence may continue hydrating after structural readiness and must not reopen or downgrade a successfully established Weather state.
- Supplementary failures remain local to their evidence surfaces and do not by themselves change global Weather.
- Readiness is scoped to the current view generation. Completion from obsolete work must not settle a newer view.
- Background work that cannot alter the current Constellation does not block Weather.
- The normal acknowledgement stays subtle: delayed `Updating…`, a brief `Ready`, then a persistent low-emphasis settled check.
- Presentation failure must fail closed to a degraded/unavailable surface rather than leaving stale success feedback visible.

## Verification

Deterministic/browser contract tests should cover:

- critical structural work moving Weather through loading to successful settlement;
- legitimate empty structure settling successfully;
- critical failure ending loading without showing the normal success state;
- supplementary evidence arriving, failing, or completing late without reopening successful Weather;
- obsolete generation completion being unable to settle the current view;
- fast cached structural work avoiding a distracting `Updating…` flash while still acknowledging successful settlement;
- presentation failure replacing stale success feedback with a degraded/unavailable state.
