# Interface

## Purpose

Own Chessview's two-dimensional spatial presentation and the rendering integration between the [Nodus](nodus.md), [Constellation](constellation.md), [Rail](rail.md), and [Weather](weather.md).

Interface does not decide durable graph identity, acquire graph knowledge, select Constellation membership, calculate evidence meaning, or own current-view publication. The cross-component currentness/publication boundary is defined separately in [`docs/architecture/current-view.md`](../architecture/current-view.md).

## Requirements

- The Nodus is the primary large playable board; surrounding Constellation positions are smaller navigation boards.
- Root boards are presented to the left of the Nodus and Line boards to the right.
- Root move cues point toward the Nodus; Line move cues identify the move that produced the displayed child position.
- Distinct immediate Root families remain visually distinguishable while their selected Constellation relationships remain distinct.
- A canonical position represented once in the Constellation is rendered once even when several visible paths converge there. Every selected relationship needed to communicate the convergence remains visible.
- At a visible Root convergence with more than one selected downstream relationship, the shared board does not show one misleading board-level move cue; the connectors carry the distinct Move meanings instead.
- Ancestry above a visible Root merge stays visually shared instead of splitting back into duplicate copies of the same canonical positions.
- In Lines view, connector thickness encodes the first move's Prevalence from the Nodus, represented by rated-Explorer move share. Every deeper segment belonging to that Line inherits the same thickness; deeper local Prevalence does not change it.
- Connector color does not encode Prevalence. It reflects per-edge move-quality evidence supplied by [Evidence](evidence.md): strong moves use green, dubious moves amber, bad moves red, and unavailable/unknown evaluation stays neutral.
- Root rarity remains a separate presentation channel supplied by Evidence. Rare Roots may use a diamond, reduced emphasis, and dashed connectors; stronger rarity treatment may apply to very rare Roots. Rarity may change dash/opacity but not connector color or Line-Prevalence width.
- Siblings, cousins, and merged transpositions may occupy lateral context where useful without changing Root/Line direction semantics.
- Interface derives the presentation-space constraints needed to fit readable boards and relationships in the available viewport and supplies those constraints to Constellation composition. It does not convert a fixed desktop board count into a product rule.
- A material change in the effective presentation-space constraints is a Constellation input change. Interface requests same-Nodus recomposition so Constellation can decide the new shape and admit any newly relevant structural obligations. A viewport change that affects only two-dimensional placement may use presentation-only redraw without recomposing Constellation.
- A trustworthy provisional Constellation remains visible and navigable while [Weather](weather.md) reports that structural refinement is still `Updating…`; presentation must not treat unsettled as unavailable.
- Accepted current-generation refinements may add, remove, or rearrange visible boards and relationships. Interface may debounce or coalesce transient recompositions to avoid distracting fidgeting, but it must keep ongoing refinement perceptible through Weather and must not manufacture a settled state merely to suppress motion.
- All visible boards share one global orientation controlled by the flip action.
- Evidence presentation follows the Evidence component rather than deriving chess meaning from DOM layout.
- Lichess cloud-evaluation acquisition status is rendered as a separate source-status channel supplied by [`LichessEval`](../architecture/lichess-eval.md). Active acquisition and provider issues must be visible without being encoded as move quality or Weather. Compact responsive presentation may suppress the idle source label, but active acquisition and issues remain visible.
- Rail behavior follows the Rail component; Weather presentation follows the Weather component; position-centered navigation follows the Nodus component.
- `NodusRenderer` owns DOM and Chessground mutation under its application root. Presentation helpers receive that root explicitly and act only as renderer delegates; they do not discover elements from the global document.
- Presentation may retain resource handles needed to update or dispose rendered objects, but it must not keep a second mutable copy of current-view truth.
- Normal presentation failure must fail closed to a degraded/unavailable surface rather than rewriting valid structural domain data or leaving stale success feedback visible; failure of the degraded fallback itself is not swallowed.

## Verification

Deterministic/browser contract tests should cover:

- Root-left / Line-right directional semantics;
- distinct immediate Root families remaining visually distinct until genuine canonical convergence;
- one rendered canonical board at a visible transposition with every selected connector preserved;
- a merged Root board with several downstream relationships suppressing a misleading single board-level move cue;
- ancestry above a Root convergence remaining shared rather than duplicating canonical positions;
- a trustworthy provisional Constellation remaining visible and interactive while Weather is still `Updating…`;
- accepted refinement updating the visible Constellation without requiring the prior trustworthy view to disappear first;
- debounce/coalescing avoiding unnecessary visual fidgeting without concealing that structural refinement is ongoing or falsely presenting settlement;
- global orientation behavior;
- stable identity between rendered positions/connectors and their Constellation relationships;
- Line descendants inheriting the first move's Nodus Prevalence for connector-width semantics;
- move-quality color, Root-rarity treatment, and Line-Prevalence width remaining independent channels attached to the correct relationship;
- LichessEval requesting and issue states updating the source-status presentation without changing chess-evidence or Weather semantics, including responsive layouts where the idle label may be hidden;
- different effective presentation constraints causing same-Nodus Constellation recomposition without Interface independently changing graph identity or persistence;
- presentation-only viewport changes redrawing the accepted Constellation without starting acquisition or structural recomposition;
- normal presentation failure falling back to a degraded/unavailable surface without changing structural truth.

Manual verification should include dense Root and Line Constellations, a transposition, responsive layouts, progressive refinement, Lichess engine acquisition success/failure, and evidence-rich positions where visual cues remain attached to the correct edge after recentering. It should confirm that distinct Root families remain legible before convergence, that genuine convergence produces one shared board with every selected connector and no misleading single move cue, that useful provisional structure remains usable during visible refinement without distracting fidgeting, that engine-source activity/issues remain visible without changing Weather or move-quality channels, and that the presentation remains legible as available screen space changes without assuming a fixed number of surrounding boards.
