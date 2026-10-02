# Rail

## Purpose

Own the supporting control, inventory, and evidence surface beside the spatial map.

The Rail helps the user inspect and navigate the current Nodus and its surrounding graph without becoming the graph, deciding canonical identity, or deciding which relationships receive visible Constellation space.

## Line sets

For Line view, three sets are deliberately different:

1. **Source Lines** — every legal immediate Move returned by the current usable rated `LichessGamesDB` Explorer Reading for the Nodus.
2. **Notable Lines** — the subset of those Source Lines that satisfy the current Rail Notable-Line rule.
3. **Visible Constellation Lines** — relationships selected independently by Constellation under eligibility, Salience, coherence, and presentation-space constraints.

Neither containment direction should be inferred between Notable Lines and visible Constellation Lines. A source Line may appear in the Rail but not the Constellation; a Notable Line is not guaranteed a visible board; presentation-space changes may alter visible Constellation membership without changing a settled Rail list or badge.

Explicitly materialized moves form an additional navigation path: they remain eligible for Rail navigation even when absent from the current `LichessGamesDB` Reading or outside automatic Constellation candidacy. Because they are not Source Lines from that Reading, explicit-only relationships do not increase the source-derived Notable Line count.

## Requirements

- The Rail shows current-position context and controls used to switch between Root and Line views.
- The Lines Rail lists every Source Line. It may scroll rather than truncate when the source inventory exceeds available Rail height.
- The Lines badge counts Notable Lines from the immediate source list, not visible boards or total navigable relationships.
- The Roots tab count reports immediate known Root relationships for the current Nodus, independent of how many Root boards fit in the current Constellation.
- Root/Line mode switching is a display choice. It does not clear, recompute, or reinterpret settled Rail inventories or tab counts merely because the active mode changed.
- Rail inventory and tab counts are independent of Constellation presentation capacity. Resizing, zooming, or otherwise changing how many boards fit may change Constellation membership without changing settled Rail values.
- Rail values may still refine when underlying source, graph, or evidence information for the same Nodus is genuinely acquired or reconciled.
- A Rail row keeps enough Prevalence context visible to distinguish common moves from rare ones when that distinction matters to interpretation.
- Selecting a navigable Rail row requests a Recenter to the row's canonical target position.
- Engine, human-result, mismatch, rarity, Prevalence, and other evidence shown in the Rail follow the [Evidence](evidence.md) component. Rail owns how supplied signals affect Notable-Line classification and presentation; it does not recalculate their chess meaning from DOM state.
- A Guide or legend that explains evidence presentation belongs to the Rail because it explains Rail/map evidence channels; it does not become a second source of evidence rules.
- Supplementary evidence may hydrate or fail locally without changing whether the underlying Constellation is structurally usable.
- Debug/developer instrumentation may appear near the Rail in development builds, but it is not part of the Rail product contract.

## Notable Lines

A Source Line is Notable when either:

- its Prevalence is at least `5%`; or
- it has at least `100` source games and available evidence does not establish bad engine quality or unfavorable human result.

Unknown or insufficient quality evidence does not make a Line non-notable.

The current tunables are therefore:

- human-sample floor: `100` games;
- popular-move threshold that remains Notable despite known bad/unfavorable evidence: `5%` Prevalence.

These values belong only to the Rail's Notable-Line classification. They do not define Edge Admission, automatic Constellation eligibility, or Constellation capacity and may change without moving those ownership boundaries.

## Verification

Deterministic/browser contract tests should cover:

- Root and Line controls selecting the intended display without restarting the Nodus solely because the mode changed;
- a usable `LichessGamesDB` Explorer Reading contributing every legal immediate Source Line to the Rail, including Lines that are not Notable or are omitted from the current Constellation;
- the Lines Rail remaining usable through scrolling when its source inventory exceeds available height;
- the Lines badge counting Notable Lines from the immediate source list rather than visible-board count or total navigable relationships;
- a sufficiently sampled plausible unpopular move counting as Notable;
- known bad/unfavorable evidence excluding an unpopular move while a move at or above `5%` remains Notable;
- unknown/insufficient quality evidence not being treated as bad evidence for Notable-Line classification;
- Root counts following immediate known Root relationships rather than visible Root-board capacity;
- same-Nodus Root/Line switching preserving settled Rail inventory and counts while new source/graph/evidence information may still refine them;
- presentation-space changes altering Constellation membership without altering settled Rail inventory or counts;
- explicit navigation remaining available outside automatic Constellation candidacy without inflating the source-derived Notable Line count;
- Rail navigation targeting the correct canonical position;
- evidence rows preserving their supplied evidence meaning rather than deriving it from presentation state;
- supplementary Rail evidence failure remaining local and not downgrading an established structural view.
