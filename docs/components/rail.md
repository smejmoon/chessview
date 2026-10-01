# Rail

## Purpose

Own the supporting control and evidence surface beside the spatial map.

The Rail helps the user inspect and navigate the current Nodus and its surrounding graph without becoming the graph or deciding canonical identity.

## Requirements

- The Rail shows current-position context and the controls used to switch between Root and Line views.
- The **Lines Rail list** contains all immediate Lines present in the current usable rated `LichessGamesDB` Explorer Reading for the Nodus. Every returned legal move is represented even when it is not a [Notable Line](../glossary.md#notable-line) or is omitted from the current Constellation. The list may scroll rather than truncate to fit the available Rail height.
- The **Lines badge** counts how many Lines in that immediate `LichessGamesDB` list are currently **Notable Lines**. For now, a source-returned legal move is a Notable Line when it is at or above `5%` Prevalence; otherwise it requires at least `100` source games and must not have known bad engine evidence or unfavorable human-result evidence. Unknown or insufficient quality evidence does not make a Line non-notable. This classification is deliberately tunable and may change later without changing Rail/Constellation ownership.
- The **Constellation is separate from both**: its visible boards and relationships are chosen under Constellation eligibility, coherence, and presentation-space constraints. A Line being present in the Rail list or counted as Notable does not by itself require a visible board, and changing how many boards fit does not change a settled Rail list or Lines badge.
- Manual/explicitly explored moves remain eligible for Rail navigation even when they are outside the current `LichessGamesDB` Reading or automatic Constellation candidacy. Manual-only relationships do not increase the source-derived Notable Line count.
- The Roots tab count reports immediate known Root relationships for the current Nodus, independent of how many Root boards fit in the current Constellation.
- Root/Line mode switching is a display choice. It does not clear, recompute, or reinterpret Rail inventories or tab counts. Those values may change as underlying source, graph, or evidence information for the same Nodus is still being acquired or reconciled, but not merely because the active mode or available map space changed.
- Rail inventory and tab counts are independent of Constellation presentation capacity. Resizing, zooming, or otherwise changing how many boards fit may change Constellation membership without changing settled Rail values.
- A Rail row that represents a move keeps enough Prevalence context visible to distinguish common moves from rare ones when that distinction matters to interpretation.
- Selecting a navigable Rail row requests a Recenter to the row's canonical target position.
- Engine, human-result, mismatch, rarity, Prevalence, and other evidence shown in the Rail follow the [Evidence](evidence.md) component. Rail owns how those supplied signals affect Notable Line classification and presentation; it does not recalculate their chess meaning from DOM state.
- A Guide or legend that explains evidence presentation belongs to the Rail because it explains Rail/map evidence channels; it does not become a second source of evidence rules.
- Supplementary evidence may hydrate or fail locally without changing whether the underlying Constellation is structurally usable.
- Debug/developer instrumentation may appear near the Rail in development builds, but it is not part of the Rail product contract.

## Tunables

- Human-sample floor for Notable Line classification: `100` games.
- Popular-move threshold that remains Notable despite known bad/unfavorable evidence: `5%` Prevalence.

These tunables belong to the current Notable Line definition. They do not define Edge Admission or automatic Constellation eligibility.

## Verification

Deterministic/browser contract tests should cover:

- Root and Line controls selecting the intended display without restarting the Nodus solely because the mode changed;
- a usable `LichessGamesDB` Explorer Reading contributing every returned legal immediate Line to the Lines Rail, including Lines that are not Notable or are omitted from the current Constellation;
- the Lines Rail remaining usable through scrolling when its source inventory exceeds the available Rail height;
- the Lines badge counting Notable Lines from the immediate source list rather than visible-board count or Constellation membership;
- a sufficiently sampled plausible unpopular move counting as a Notable Line;
- known bad/unfavorable evidence excluding an unpopular move from the Notable Line count while a move at or above `5%` remains Notable;
- unknown/insufficient quality evidence not being treated as bad evidence for Notable Line classification;
- Root counts following immediate known Root relationships rather than visible Root-board capacity;
- same-Nodus Root/Line switching preserving settled Rail inventory and counts, while new source/graph/evidence information may still refine them;
- changing presentation-space constraints altering Constellation membership without altering settled Rail inventory or counts;
- manual/explicit navigation remaining available outside automatic Constellation candidacy without inflating the source-derived Notable Line count;
- Rail navigation targeting the correct canonical position;
- evidence rows preserving their supplied evidence meaning rather than deriving it from presentation state;
- supplementary Rail evidence failure remaining local and not downgrading an established structural view.
