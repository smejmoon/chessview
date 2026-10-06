# Lens

## Purpose

Own how accepted Chessview product state becomes an interactive visual experience without becoming a second owner of that product truth.

Lens combines presentation preferences with the current presentation environment to derive the geometry and effective composition constraints under which the current Nodus is shown. It also owns presentation-local interaction choices such as global board orientation, Guide visibility, Debug visibility, and other ephemeral UI state. Domain objects remain owned by their components: Nodus owns position-centered behavior and refinement demand, Constellation owns visible-subgraph composition and structural admission, Evidence owns semantic evidence, Rail owns its Line inventory/evidence surface, Weather owns readiness meaning, and current-view coordination owns publication/currentness.

`NodusRenderer` is Lens's rendering delegate. It owns DOM and Chessground mutation under the application root; it does not independently own presentation preferences or composition-capacity decisions.

## Responsibilities

- Own live presentation preferences such as global orientation, Guide visibility, and Debug visibility, while persisting durable user choices through `PreferenceStore`.
- Observe presentation environment such as the actual rendered map rectangle and browser fallback dimensions.
- Derive one presentation geometry from presentation preferences/environment plus the active Root/Line mode.
- Derive effective Constellation composition capacities from that geometry; capacities are derived values, not separately maintained state.
- Render accepted current-view values through renderer delegates and own ephemeral interaction state needed only for presentation, such as selection/drag/promotion UI, hover/focus, panel state, transient status animation, and renderer resource handles.
- Translate presentation gestures into application commands such as Recenter, mode change, flip, refresh, redraw, or recomposition rather than mutating domain truth directly.
- Distinguish presentation-only change from a material constraint change: the former redraws accepted state, while the latter requests same-Nodus recomposition.
- Never own graph/source knowledge, Constellation membership, semantic Evidence, Rail meaning, structural settlement truth, navigation history, or source acquisition lifecycle.

## Requirements

- The Nodus is the primary large playable board. Prominent immediate Lines use the second presentation tier; remaining surrounding Constellation positions use the compact tier.
- Chessview presents one surroundings map rather than separate Root and Line layouts. Root boards and sibling move-order context are presented to the left of the Nodus; Line boards are presented to the right.
- Root/Line mode is current-Nodus state, not a Lens preference. Lens consumes the active mode when deriving presentation geometry and constraints.
- All visible boards share one Lens-owned global orientation controlled by the flip action. Orientation changes presentation only; they do not replace the Nodus or start refinement.
- Guide and Debug are Lens-owned presentation preferences. Changing either requests redraw only.
- One Lens-owned geometry decision derives the Nodus rectangle, board-size tiers, usable upstream and downstream regions, and effective composition capacities from the actual rendered map rectangle. Browser viewport size alone is only a fallback before a rendered map rectangle exists.
- Geometry exposes usable regions and the board-size regime before composition; it does not precompute board slots. The abstract Constellation constraint remains the number of Line and optional Root/sibling boards those regions can legibly represent. Pixel coordinates, final node placement, family grouping, and connector paths remain presentation-private.
- Effective capacities are derived from the usable regions and current board-size policy rather than fixed total-board ceilings. After Constellation accepts membership, one topology-aware placement pass consumes the whole accepted Constellation. Root/sibling and Line roles constrain which side of the Nodus a node may occupy; they do not select separate Root and Line layout algorithms.
- A material change in effective presentation capacities is a Constellation input change and requests same-Nodus recomposition. A geometry change that affects only two-dimensional placement uses presentation-only redraw.
- A trustworthy provisional Constellation remains visible and navigable while Weather reports `Updating…`; presentation must not treat unsettled as unavailable.
- Same-Nodus presentation updates must not replace or disable the accepted Nodus Chessground merely because structure, Evidence, Rail, or Weather is refining.
- Evidence presentation follows the Evidence component rather than deriving chess meaning from DOM layout. Rail behavior follows Rail; Weather presentation follows Weather; position-centered navigation follows Nodus.
- Lens and its renderer delegates may retain resource handles needed to update or dispose rendered objects, but they must not keep a second mutable copy of current-view truth.
- Normal presentation failure fails closed to a degraded/unavailable surface rather than rewriting valid structural domain data or leaving stale success feedback visible.

## Verification

Deterministic/browser contract tests should cover:

- Lens initializing and persisting orientation, Guide, and Debug presentation preferences;
- presentation geometry and composition constraints being derived from the actual rendered map rectangle, with Root/Line mode affecting Root-context capacity;
- orientation, Guide, and Debug changes redrawing without replacing the current Nodus or starting acquisition;
- different effective presentation capacities causing same-Nodus Constellation recomposition;
- presentation-only geometry changes redrawing accepted state without structural recomposition;
- one geometry owner and one placement path deciding Nodus and surrounding-board placement for both structural directions, without a parallel Root layout;
- a trustworthy provisional Constellation remaining visible and interactive while Weather is `Updating…`;
- renderer resource state remaining presentation-local and never becoming current-view/domain truth;
- normal presentation failure falling back to a degraded surface without changing structural truth.
