# Rail

## Purpose

Own the supporting Line inventory and evidence surface beside the spatial map.

The Rail helps the user inspect and navigate immediate Lines from the Nodus without becoming the graph, deciding canonical identity, growing graph knowledge, deciding which relationships receive visible Constellation space, or owning source acquisition lifecycle. Root and sibling context belongs to the spatial map rather than a parallel Rail mode.

## Line inventory

The Rail is exhaustive rather than selective.

**Source Lines** are every legal immediate Move returned by the current usable rated `LichessGamesDB` Explorer Reading for the Nodus. Every Source Line is listed in the Rail regardless of whether it is selected into the current Constellation.

Explicitly materialized moves form an additional navigation path. When an explicit Graph Edge is absent from the current Explorer Reading, it is still listed in the Rail so known navigable Lines do not disappear merely because they lack current source evidence.

The **Visible Constellation Lines** are selected independently by [Constellation](constellation.md) under Candidate eligibility, Salience, coherence, and presentation-space constraints. A Rail Line need not have a visible board, and presentation-space changes may alter visible Constellation membership without changing Rail inventory.

## Projection boundary

Rail is a projection over facts already available for the Nodus. It reads known immediate outgoing Graph relationships and the provider's current or durable Explorer Reading to establish Line inventory. For semantic signals on those rows, Rail requests [Evidence](evidence.md) by Graph Edge rather than calculating engine, human-result, mismatch, rarity, or Prevalence semantics itself.

Rail does not start Explorer, engine, or Masters acquisition, subscribe to source notifications, expose a progress callback, or keep any producer alive. Evidence requests made by Rail are reads of currently available facts only.

Source work is planned outside Rail. When relevant facts are incorporated into the current view, Rail derives a replacement immutable value from the graph/source inventory and Evidence then available. There is no source-specific delivery step from requester to Rail and no Rail-owned hydration lifecycle.

A fresh usable Explorer observation may therefore contribute Source Lines on a later Rail derivation even when durable cache persistence failed. Rail does not reconcile that observation into `ChartedGraph`; [Knowledge Acquisition](knowledge-acquisition.md) alone owns graph admission and durable graph growth.

Rail richness is independent from structural readiness. Engine or Masters facts may make later Evidence richer before or after the accepted view becomes Ready; those supplementary changes do not by themselves make Weather `Updating…`.

## Requirements

- The Rail shows Nodus context and an exhaustive immediate-Line inventory.
- The Rail lists every current Source Line plus explicit-only navigable outgoing Graph Edges not already represented by that source inventory. It may scroll rather than truncate.
- Root inventory, Root counts, and Root/Line mode switching are not Rail responsibilities. Root and sibling visibility is controlled on the map.
- Rail inventory is independent of Constellation presentation capacity and Root-context visibility.
- Known Graph Line inventory remains usable when Explorer is absent, delayed, stale, or failed. Missing source evidence does not suppress already-known explicit Lines.
- A currently usable Explorer Reading contributes Source Lines without waiting for graph reconciliation, cloud evaluation, Masters retrieval, or source-cache persistence.
- Cloud evaluation and Masters may refine Evidence later; their delay, absence, rate limiting, persistence failure, or retrieval failure must not suppress otherwise usable Rail inventory or keep Weather structurally unsettled.
- While Current View is structurally Updating, the established Rail remains interactive; it is replaced only after a recomputed Rail value is accepted.
- After Current View becomes Ready, supplementary Evidence may continue enriching Rail without reopening structural readiness.
- Selecting a navigable Rail row requests a Recenter to the row's canonical target position.
- Engine, human-result, mismatch, rarity, Prevalence, and other evidence shown in the Rail follow [Evidence](evidence.md). Rail requests and presents those signals without deriving a separate evidence grammar, admission rule, or importance classification.
- A Guide or legend that explains evidence presentation belongs to the Rail because it explains Rail/map evidence channels; it does not become a second source of evidence rules.
- Debug/developer instrumentation may appear near the Rail in development builds, but it is not part of the Rail product contract.

## Verification

Deterministic/browser contract tests should cover:

- every legal current Explorer Source Line appearing in the Rail, including Lines omitted from the Constellation;
- explicit-only navigable outgoing Graph Edges appearing without source evidence or automatic Constellation candidacy;
- Rail deriving known outgoing Graph inventory with no source acquisition side effect;
- Rail requesting move Evidence by Graph Edge instead of importing Evidence calculation rules;
- recomposition adding Source Lines when an Explorer fact becomes available, without a Rail progress/subscription lifecycle;
- provider-current Explorer state taking precedence over older durable cached state for the current application lifetime;
- a Graph Edge already represented by a Source Line not producing a duplicate explicit Rail row;
- Rail scrolling rather than semantic truncation;
- presentation-space or Root-context changes altering Constellation membership without altering Rail inventory;
- Explorer/graph inventory remaining available before engine or Masters Evidence, with later supplementary facts refining rows;
- supplementary Evidence arriving, failing, or completing after Current View readiness without reopening structural readiness;
- Rail navigation targeting the correct canonical position;
- Rail presentation preserving supplied Evidence meaning rather than deriving it from presentation state.
