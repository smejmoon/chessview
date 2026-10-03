# Rail

## Purpose

Own the supporting control, inventory, and evidence surface beside the spatial map.

The Rail helps the user inspect and navigate the current Nodus and its surrounding graph without becoming the graph, deciding canonical identity, or deciding which relationships receive visible Constellation space.

## Line inventory

For Line view, the Rail is exhaustive rather than selective.

**Source Lines** are every legal immediate Move returned by the current usable rated `LichessGamesDB` Explorer Reading for the Nodus. Every Source Line is listed in the Rail regardless of whether it is selected into the current Constellation.

Explicitly materialized moves form an additional navigation path. When an explicit Graph Edge is absent from the current `LichessGamesDB` Reading, it is still listed in the Rail so known navigable Lines do not disappear merely because they lack current source evidence.

The **Visible Constellation Lines** are selected independently by [Constellation](constellation.md) under Candidate eligibility, Salience, coherence, and presentation-space constraints. A Rail Line need not have a visible board, and presentation-space changes may alter visible Constellation membership without changing a settled Rail inventory.

Rail inventory is assembled from independently usable facts rather than from one all-or-nothing acquisition operation. Known incoming/outgoing Graph relationships may publish immediately. A usable rated Explorer Reading then contributes its Source Lines whether or not reconciliation of that Reading into durable `ChartedGraph` knowledge has completed successfully. Knowledge Acquisition remains responsible for that reconciliation; its persistence outcome does not retroactively determine whether the source observation itself was usable.

Supplementary engine and Masters evidence may refine already-visible rows afterward; it is not a prerequisite for publishing graph inventory or Source Lines.

## Requirements

- The Rail shows current-position context and controls used to switch between Root and Line views.
- The Lines Rail lists every current Source Line plus explicit-only navigable outgoing Graph Edges that are not already represented by that source inventory. It may scroll rather than truncate when the inventory exceeds available Rail height.
- The Lines tab count equals the number of Line rows in the Rail. It does not count visible Constellation boards or classify a semantic subset of Lines.
- The Roots tab count reports immediate known Root relationships for the current Nodus, independent of how many Root boards fit in the current Constellation.
- Root/Line mode switching is a display choice. It does not clear, recompute, or reinterpret settled Rail inventories or tab counts merely because the active mode changed.
- Rail inventory and tab counts are independent of Constellation presentation capacity. Resizing, zooming, or otherwise changing how many boards fit may change Constellation membership without changing settled Rail values.
- Known Graph inventory may publish before rated Explorer completes. Explorer delay or failure does not suppress already-known explicit Lines or Root counts.
- A usable rated Explorer Reading publishes Source Lines without waiting for Knowledge Acquisition to persist graph reconciliation, cloud evaluation, or Masters retrieval. Reconciliation may continue independently; its failure does not retract an otherwise usable source observation from the Rail.
- Cloud evaluation and Masters may hydrate evidence into existing rows later, and their delay, absence, rate limiting, or failure must not suppress otherwise usable Rail inventory.
- Rail values may still refine when underlying source, graph, or evidence information for the same Nodus is genuinely acquired or reconciled.
- A Rail row keeps enough Prevalence context visible to distinguish common moves from rare ones when that distinction matters to interpretation.
- Selecting a navigable Rail row requests a Recenter to the row's canonical target position.
- Engine, human-result, mismatch, rarity, Prevalence, and other evidence shown in the Rail follow the [Evidence](evidence.md) component. Rail presents supplied signals without collapsing them into a separate admission or importance classification.
- A Guide or legend that explains evidence presentation belongs to the Rail because it explains Rail/map evidence channels; it does not become a second source of evidence rules.
- Supplementary evidence may hydrate or fail locally without changing whether the underlying Constellation is structurally usable or whether an established Rail inventory remains available.
- Debug/developer instrumentation may appear near the Rail in development builds, but it is not part of the Rail product contract.

## Verification

Deterministic/browser contract tests should cover:

- Root and Line controls selecting the intended display without restarting the Nodus solely because the mode changed;
- a usable `LichessGamesDB` Explorer Reading contributing every legal immediate Source Line to the Rail, including Lines omitted from the current Constellation;
- explicit-only navigable outgoing Graph Edges appearing in the Rail without requiring source evidence or automatic Constellation candidacy;
- known Graph inventory becoming usable while Explorer is still delayed or unavailable;
- a usable Explorer Reading contributing Source Lines before its Knowledge Acquisition reconciliation completes, with reconciliation persistence failure leaving those Source Lines usable;
- a Graph Edge already represented by a Source Line not producing a duplicate explicit Rail row;
- the Lines Rail remaining usable through scrolling when its inventory exceeds available height;
- the Lines tab count matching the complete rendered Line inventory, including explicit-only rows, rather than visible-board count;
- Root counts following immediate known Root relationships rather than visible Root-board capacity;
- same-Nodus Root/Line switching preserving settled Rail inventory and counts while new source/graph/evidence information may still refine them;
- presentation-space changes altering Constellation membership without altering settled Rail inventory or counts;
- Rail navigation targeting the correct canonical position;
- Explorer/graph Rail inventory becoming available before delayed engine or Masters evidence, with later evidence refining rows in place;
- supplementary engine or Masters failure leaving the established Rail inventory usable;
- evidence rows preserving their supplied evidence meaning rather than deriving it from presentation state;
- supplementary Rail evidence failure remaining local and not downgrading an established structural view.
