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

The **topbar** is the global application shell. It groups Chessview identity, source connectivity, Weather readiness, navigation, and global presentation controls. In Debug mode it also presents Current View's aggregate map, structural, and supplementary observations as compact labelled or icon-and-number values, separate from Weather's live status. It never computes readiness or hosts Explorer inventory. Its presentation adapts to available space without taking over the playable map.

The **Constellation canvas** is the primary spatial navigation surface, centered on the playable Nodus with Roots and siblings upstream to its left, visible Lines downstream to its right, and graph connections/convergence between them. Its **map controls** switch Root context and present Root coverage/discovery, not global readiness. The satellite boards are selected spatial context, not an exhaustive inventory.

The **Rail** supports study beside the map and needs no visible "Rail" label. Its compact, unlabeled current-position context precedes **Opening Explorer**, the primary independently scrollable, exhaustive immediate-Line inventory. Explorer shows supplied frequency and Evidence for navigable source and explicit-only Lines; its inventory is independent of which Lines receive visible Constellation boards. **Rail Debug** houses the compact, collapsible **Events** panel, not another copy of topbar monitoring. Its event log receives the available expanded area; a small Copy log icon sits in the event header and Clear log lives in an overflow menu. A separately disclosed **Advanced maintenance** section beneath the log offers Refetch view and Clear Explorer cache, whose explicit cache invalidation and reload are distinct from passive inspection. With Events collapsed only its short header remains, leaving Opening Explorer the available Rail height.

The **Guide/legend** explains evidence marks and visual relationships, without producing those facts. **Weather** alone supplies user-facing structural readiness; service/engine status and developer diagnostics are separate concerns. Global Debug/Guide toggles change presentation only and must not hide the Nodus or restart acquisition.

## Debug observability

Debug explains aggregate Current View facts rather than defining another lifecycle or controlling Weather. Keep the three internal group identities, but display all measurements compactly in the Debug-only topbar: Map, Settling and Frontier use words, while Structural and Supplementary use symbols paired with published counts. Hover titles, group semantics and accessible names supply their meanings.

- **`ConstellationState`** — accepted Constellation structure lifecycle (`idle`, `loading`, `ready`, `failed`), Current View's derived `settling` flag, and admitted Reading-frontier size. These answer what map is accepted and whether its structural obligations remain live.
- **`FrontierWork`** — structural participation counts: `working`, `satisfied`, `incorporationPending`, `unavailable`, `failed`, `unplanned`, and `detached`. These explain the active run's structural coordination. A satisfied participant may remain recorded after incorporation is drained; failed/unplanned participants are diagnostics, not evidence of source unavailability or automatic progress.
- **`EnrichmentFlow`** — supplementary refinement participation, active and total. These counts explain non-structural work, not structural settlement; independently scheduled lookahead is not implied to be counted.

The published Current View snapshot supplies the measures; Lens only formats them. The topbar provides compact counts and hoverable/focusable explanations when Debug is enabled, outside Weather's live announcement region. The Rail keeps Opening Explorer primary, with event history and cache maintenance behind their own disclosures. Hiding Debug or its event history must not change structural readiness or disable the accepted Nodus.

Debug remains aggregate: do not display task keys, canonical-position identities, provider names, source payloads, transport details, retry timestamps, or run/revision tokens in these groups. Weather's [product-facing status contract](weather.md) remains independent.

## Verification

Verification focuses on the component's established behavior:

- Lens initializes and persists orientation, Guide, and Debug preferences.
- Presentation geometry and Constellation capacities derive from the rendered map rectangle and active Root/Line mode.
- Orientation, Guide, and Debug changes redraw without replacing the Nodus or starting acquisition.
- Material capacity changes recompose the same Nodus; placement-only changes redraw.
- One geometry and placement owner presents Roots, siblings, and Lines around the accepted Nodus.
- A trustworthy provisional Constellation remains visible and interactive while Weather is Updating.
- Debug displays aggregate Current View measures outside Weather's live status and does not alter structural readiness.
- Renderer resource state stays presentation-local, and presentation failure degrades rather than leaving stale success.

