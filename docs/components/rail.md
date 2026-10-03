# Rail

## Purpose

Own the supporting control, inventory, and evidence surface beside the spatial map.

The Rail helps the user inspect and navigate the current Nodus and its immediate move neighborhood without becoming the graph, deciding canonical identity, growing graph knowledge, deciding which relationships receive visible Constellation space, or owning source acquisition lifecycle.

## Line inventory

For Line view, the Rail is exhaustive rather than selective.

**Source Lines** are every legal immediate Move returned by the current usable rated `LichessGamesDB` Explorer Reading for the Nodus. Every Source Line is listed in the Rail regardless of whether it is selected into the current Constellation.

Explicitly materialized moves form an additional navigation path. When an explicit Graph Edge is absent from the current Explorer Reading, it is still listed in the Rail so known navigable Lines do not disappear merely because they lack current source evidence.

The **Visible Constellation Lines** are selected independently by [Constellation](constellation.md) under Candidate eligibility, Salience, coherence, and presentation-space constraints. A Rail Line need not have a visible board, and presentation-space changes may alter visible Constellation membership without changing Rail inventory.

## Projection boundary

Rail is a projection over facts already available for the current Nodus. It reads known immediate incoming/outgoing Graph relationships, the provider's current or durable Explorer Reading, and currently available engine/Masters evidence. It does not start those acquisitions, subscribe to source notifications, expose a progress callback, or keep any producer alive.

Run-owned refinement work is planned outside Rail. When Explorer, graph reconciliation, engine, Masters, or another relevant task settles, [Current view](../architecture/current-view.md) recomputes the Nodus. Rail then derives a replacement immutable value from the newly available facts. There is no source-specific delivery step from requester to Rail and no Rail-owned hydration lifecycle.

A fresh usable Explorer observation may therefore contribute Source Lines on the next settlement pass even when durable cache persistence failed. Rail does not reconcile that observation into `ChartedGraph`; [Knowledge Acquisition](knowledge-acquisition.md) alone owns graph admission and durable graph growth.

## Requirements

- The Rail shows current-position context and controls used to switch between Root and Line views.
- The Lines Rail lists every current Source Line plus explicit-only navigable outgoing Graph Edges not already represented by that source inventory. It may scroll rather than truncate.
- The Lines tab count equals the number of Line rows in the Rail. It does not count visible Constellation boards or classify a semantic subset of Lines.
- The Roots tab count reports immediate known Root relationships for the current Nodus, independent of how many Root boards fit in the current Constellation.
- Root/Line mode switching is a display choice. It does not clear, reacquire, or reinterpret Rail inventory merely because the active mode changed.
- Rail inventory and tab counts are independent of Constellation presentation capacity.
- Known Graph inventory remains usable when Explorer is absent, delayed, stale, or failed. Missing source evidence does not suppress already-known explicit Lines or Root counts.
- A currently usable Explorer Reading contributes Source Lines without waiting for graph reconciliation, cloud evaluation, Masters retrieval, or source-cache persistence.
- Cloud evaluation and Masters may refine evidence on later settlement passes; their delay, absence, rate limiting, persistence failure, or retrieval failure must not suppress otherwise usable Rail inventory.
- While the Nodus is settling, the established Rail remains interactive and `ready`; it is replaced only after a recomputed Rail value is accepted.
- Selecting a navigable Rail row requests a Recenter to the row's canonical target position.
- Engine, human-result, mismatch, rarity, Prevalence, and other evidence shown in the Rail follow [Evidence](evidence.md). Rail presents supplied signals without deriving a separate admission or importance classification.
- A Guide or legend that explains evidence presentation belongs to the Rail because it explains Rail/map evidence channels; it does not become a second source of evidence rules.
- Debug/developer instrumentation may appear near the Rail in development builds, but it is not part of the Rail product contract.

## Verification

Deterministic/browser contract tests should cover:

- Root and Line controls selecting the intended display without restarting the Nodus solely because the mode changed;
- every legal current Explorer Source Line appearing in the Rail, including Lines omitted from the Constellation;
- explicit-only navigable outgoing Graph Edges appearing without source evidence or automatic Constellation candidacy;
- Rail deriving known Graph inventory with no source acquisition side effect;
- recomposition adding Source Lines when an Explorer fact becomes available, without a Rail progress/subscription lifecycle;
- provider-current Explorer state taking precedence over older durable cached state for the current application lifetime;
- a Graph Edge already represented by a Source Line not producing a duplicate explicit Rail row;
- Lines Rail scrolling rather than semantic truncation;
- Lines/Roots tab counts following complete immediate Rail inventory rather than visible-board capacity;
- same-Nodus Root/Line switching preserving Rail values while later settlement may refine them;
- presentation-space changes altering Constellation membership without altering Rail inventory;
- Explorer/graph inventory remaining available before engine or Masters evidence, with later settlement refining rows;
- supplementary evidence failure leaving established Rail inventory usable and ready;
- Rail navigation targeting the correct canonical position;
- Rail presentation preserving supplied evidence meaning rather than deriving it from presentation state.
