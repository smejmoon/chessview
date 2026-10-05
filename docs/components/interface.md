# Interface

## Purpose

Own Chessview's two-dimensional spatial presentation and the rendering integration between the [Nodus](nodus.md), [Constellation](constellation.md), [Rail](rail.md), and [Weather](weather.md).

Interface does not decide durable graph identity, acquire graph knowledge, select Constellation membership, calculate evidence meaning, or own current-view publication. The cross-component currentness/publication boundary is defined separately in [`docs/architecture/current-view.md`](../architecture/current-view.md).

## Requirements

- The Nodus is the primary large playable board. Prominent immediate Lines use the second presentation tier; remaining surrounding Constellation positions use the compact tier.
- Chessview presents one surroundings map rather than separate Root and Line layouts. Root boards and sibling move-order context are presented to the left of the Nodus; Line boards are presented to the right.
- The normal map is Line-first: Root/sibling context is off by default. A map control enables or disables that contextual layer; changing it requests same-Nodus Constellation recomposition so space is reallocated rather than merely hidden.
- The Nodus need not be fixed at the horizontal center. Interface may place it asymmetrically so the normally dominant Line region receives more room while preserving a coherent left-side context region when enabled.
- Root move cues point toward the Nodus; Line move cues identify the move that produced the displayed child position. Sibling context communicates the alternative move from a visible Root family.
- Immediate Line families remain spatially legible as families: descendants selected under one first move stay grouped with that first-move board instead of being flattened into an unrelated slot order. Root context follows the same rule: a Root and the selected siblings explained by that Root stay grouped together.
- Distinct immediate Root families remain visually distinguishable while their selected Constellation relationships remain distinct.
- A canonical position represented once in the Constellation is rendered once even when several visible paths converge there. Every selected relationship needed to communicate the convergence remains visible.
- At a visible convergence with more than one selected relationship, the shared board does not show one misleading board-level move cue; connectors carry the distinct Move meanings instead.
- In Line relationships, connector thickness encodes the first move's Prevalence from the Nodus, represented by rated-Explorer move share. Every deeper segment belonging to that Line inherits the same thickness; deeper local Prevalence does not change it.
- Connector color does not encode Prevalence. It reflects per-edge move-quality evidence supplied by [Evidence](evidence.md): strong moves use green, dubious moves amber, bad moves red, and unavailable/unknown evaluation stays neutral.
- Root rarity remains a separate presentation channel supplied by Evidence. Rare Roots may use a diamond, reduced emphasis, and dashed connectors; stronger rarity treatment may apply to very rare Roots. Rarity may change dash/opacity but not connector color or Line-Prevalence width.
- Siblings, cousins, and merged transpositions may occupy lateral context where useful without changing Root-left / Line-right direction semantics.
- One Interface-owned presentation-geometry decision derives the Nodus rectangle, board-size tiers, forward-Line slots, optional Root-context slots, and effective composition capacities from the actual rendered map rectangle. Browser viewport size alone is not a capacity proxy.
- The abstract Constellation constraint is the number of surrounding boards that the forward-Line region and optional Root-context region can legibly represent under that geometry. Pixel coordinates, sizes, slot rectangles, family grouping, and connector paths remain private to Interface.
- A material change in the effective presentation capacities is a Constellation input change. Interface requests same-Nodus recomposition so Constellation can decide the new shape and admit any newly relevant structural obligations. A map-rectangle change that affects only two-dimensional placement may use presentation-only redraw without recomposing Constellation.
- A trustworthy provisional Constellation remains visible and navigable while [Weather](weather.md) reports that structural refinement is still `Updating…`; presentation must not treat unsettled as unavailable.
- Same-Nodus presentation updates must not replace or disable the accepted Nodus Chessground merely because structure, Evidence, Rail, or Weather is refining. Drag/select move interaction on the accepted Nodus remains usable throughout `Updating…`; replacing the playable board is reserved for an actual Nodus/orientation/presentation-regime change that requires it.
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

- one surroundings map preserving Root-left / Line-right directional semantics;
- Root context being off by default and toggling it causing recomposition rather than DOM-only hiding;
- presentation constraints being derived from the actual rendered map rectangle, including Rail allocation, rather than `window.innerWidth * window.innerHeight`;
- one geometry owner deciding Nodus and surrounding-board placement for both structural directions;
- three presentation tiers: Nodus, prominent immediate Lines, and compact remaining surroundings;
- Line descendants remaining spatially grouped with their first-move family and Root siblings remaining grouped with their Root family;
- distinct immediate Root families remaining visually distinct;
- one rendered canonical board at a visible transposition with every selected connector preserved;
- a shared board with several relationships suppressing a misleading single board-level move cue;
- a trustworthy provisional Constellation remaining visible and interactive while Weather is still `Updating…`;
- repeated same-Nodus updates preserving the playable Nodus Chessground rather than recreating it under the user's move interaction;
- accepted refinement updating the visible Constellation without requiring the prior trustworthy view to disappear first;
- debounce/coalescing avoiding unnecessary visual fidgeting without concealing that structural refinement is ongoing or falsely presenting settlement;
- global orientation behavior;
- stable identity between rendered positions/connectors and their Constellation relationships;
- Line descendants inheriting the first move's Nodus Prevalence for connector-width semantics;
- move-quality color, Root-rarity treatment, and Line-Prevalence width remaining independent channels attached to the correct relationship;
- LichessEval requesting and issue states updating the source-status presentation without changing chess-evidence or Weather semantics, including responsive layouts where the idle label may be hidden;
- different effective presentation capacities causing same-Nodus Constellation recomposition without Interface independently changing graph identity or persistence;
- presentation-only map changes redrawing the accepted Constellation without starting acquisition or structural recomposition;
- normal presentation failure falling back to a degraded/unavailable surface without changing structural truth.

Manual verification should include dense Line Constellations, Root-context enabled with multiple Roots and siblings, a transposition, materially different desktop aspect ratios and Rail allocations, progressive refinement, Lichess engine acquisition success/failure, and evidence-rich positions where visual cues remain attached to the correct edge after recentering. It should confirm that the Nodus and Lines remain the dominant normal workspace, Line descendants remain recognizably grouped under their first-move family, contextual Roots and their siblings remain grouped and legible when enabled, the Nodus stays playable while the view is Updating, genuine convergence produces one shared board with every selected connector, and the presentation remains legible as actual map space changes without assuming a browser-wide board budget.
