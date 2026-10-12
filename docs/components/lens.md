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

## Visual grouping and topbar

The **topbar** is the global application shell. It groups Chessview identity (brand and start link), source connectivity (Lichess network/engine status), product-facing current-view readiness (Weather), navigation (Back), and global presentation controls (Guide, Debug, orientation flip). In Debug mode only, it also shows read-only `ConstellationState` (Map, Settling, Reading frontier) alongside the global indicators but outside Weather's live announcement region. It never computes readiness, selects Constellation positions, or hosts an Explorer inventory. On narrow screens, the measurements can use a compact second topbar row with horizontal keyboard scrolling, without covering the map.

The **Constellation canvas** is the primary spatial navigation surface, centered on the playable Nodus with Roots and siblings upstream to its left, visible Lines downstream to its right, and graph connections/convergence between them. Its **map controls** switch Root context and present Root coverage/discovery, not global readiness. The satellite boards are selected spatial context, not an exhaustive inventory.

The **Rail** supports study beside the map. Its compact current-position context precedes **Opening Explorer**, the primary independently scrollable, exhaustive immediate-Line inventory. Explorer shows supplied frequency and Evidence for navigable source and explicit-only Lines; its inventory is independent of which Lines receive visible Constellation boards. **Rail Debug**, when enabled, is subordinate and collapsible below Explorer. It contains `FrontierWork`, `EnrichmentFlow`, developer maintenance controls, and separately scrollable event history. Its aggregate measures observe Current View and never own structural settlement.

The **Guide/legend** explains evidence marks and visual relationships, without producing those facts. **Weather** alone supplies user-facing structural readiness; service/engine status and developer diagnostics are separate concerns. Global Debug/Guide toggles change presentation only and must not hide the Nodus or restart acquisition.

## Debug observability

Debug explains aggregate Current View facts rather than defining another lifecycle or controlling Weather. Present its measurements in the existing Rail Debug surface, separate from Weather's user-facing status and live announcements, in three named groups:

- **`ConstellationState`** — accepted Constellation structure lifecycle (`idle`, `loading`, `ready`, `failed`), Current View's derived `settling` flag, and admitted Reading-frontier size. These answer what map is accepted and whether its structural obligations remain live.
- **`FrontierWork`** — structural participation counts: `working`, `satisfied`, `incorporationPending`, `unavailable`, `failed`, `unplanned`, and `detached`. These explain the active run's structural coordination. A satisfied participant may remain recorded after incorporation is drained; failed/unplanned participants are diagnostics, not evidence of source unavailability or automatic progress.
- **`EnrichmentFlow`** — supplementary refinement participation, active and total. These counts explain non-structural work, not structural settlement; independently scheduled lookahead is not implied to be counted.

The existing published snapshot supplies the measures; grouping is a Debug presentation choice, not a renamed or duplicated Current View data model. Each group and measurement must be readable and understandable without requiring hover-only explanations or keyboard focus on each individual value. Keep the readout available when Debug is enabled at narrow widths (for example by wrapping or scrolling within the Debug surface) rather than silently hiding it. Short landscape layouts must reserve a usable map for the playable Nodus and allocate Rail space beside it rather than allowing diagnostic minimum heights to consume the map. The two Debug scroll regions, maintenance controls, and navigable Rail rows retain keyboard focus across same-Nodus redraws while their corresponding targets still exist. Opening Explorer remains the primary Rail surface with the greater share of vertical space. When Debug is enabled, its compact, collapsible section stays below Explorer rather than replacing or squeezing it. ConstellationState appears in the topbar when Debug is enabled, separate from Weather's live announcement region. The Rail Debug readout begins with FrontierWork, then EnrichmentFlow, ahead of maintenance controls and event history. Collapse/expand is visibly indicated and uses an accessible expanded state without altering Weather, Current View, or source acquisition. Switching Debug off removes the readout without changing Weather or domain state.

Debug remains aggregate: do not display task keys, canonical-position identities, provider names, source payloads, transport details, retry timestamps, or run/revision tokens in these groups. Weather's [product-facing status contract](weather.md) remains independent.

## Verification

Deterministic/browser contract tests should cover:

- Lens initializing and persisting orientation, Guide, and Debug presentation preferences;
- presentation geometry and composition constraints being derived from the actual rendered map rectangle, with Root/Line mode affecting Root-context capacity;
- orientation, Guide, and Debug changes redrawing without replacing the current Nodus or starting acquisition;
- `ConstellationState` in the topbar only in Debug mode, separate from Weather's live region, and `FrontierWork` and `EnrichmentFlow` in Rail Debug, with no duplicate readiness logic;
- narrow viewport and keyboard/screen-reader inspection of Debug measurements without embedding them in Weather's live status;
- turning Debug off removing the readout without changing Weather status or current-view settlement;
- different effective presentation capacities causing same-Nodus Constellation recomposition;
- presentation-only geometry changes redrawing accepted state without structural recomposition;
- one geometry owner and one placement path deciding Nodus and surrounding-board placement for both structural directions, without a parallel Root layout;
- a trustworthy provisional Constellation remaining visible and interactive while Weather is `Updating…`;
- renderer resource state remaining presentation-local and never becoming current-view/domain truth;
- normal presentation failure falling back to a degraded surface without changing structural truth.
