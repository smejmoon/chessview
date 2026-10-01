# Rail

## Purpose

Own the supporting control and evidence surface beside the spatial map.

The Rail helps the user inspect and navigate the current Nodus and its surrounding graph without becoming the graph or deciding canonical identity.

## Requirements

- The Rail shows current-position context and the controls used to switch between Root and Line views.
- The Lines tab count reports selected first-level Line relationships from the Nodus represented by the current Constellation. Deeper visible Line relationships and broader Rail evidence rows do not increase that count.
- Root tab counts reflect the structural Root relationships supplied by the current Constellation rather than a broader evidence-row count.
- When switching Root/Line mode without changing the Nodus, an already-established count for the inactive mode remains visible while the replacement Constellation composes. A mode change must not temporarily reinterpret an established count as zero. Counts are not carried across a Recenter to another Nodus.
- The Rail may show additional selectable or evidenced moves that are not currently represented as Constellation boards.
- A Rail row that represents a move keeps enough Prevalence context visible to distinguish common moves from rare ones when that distinction matters to interpretation.
- Selecting a navigable Rail row requests a Recenter to the row's canonical target position.
- Manual/explicitly explored moves remain eligible for Rail navigation even when they are outside automatic Constellation candidacy.
- The Rail keeps sufficiently sampled plausible moves even when they are unpopular.
- Engine-bad moves or moves with unfavorable human-result evidence are normally suppressed from automatic Rail selection, while popular mistakes at or above 5% remain selectable because users encounter them in practice.
- Unknown or insufficient engine/human evidence is not treated as bad evidence for Rail selection.
- Engine, human-result, mismatch, rarity, Prevalence, and other evidence shown in the Rail follow the [Evidence](evidence.md) component. Rail owns how those supplied signals affect Rail selection and presentation; it does not recalculate their chess meaning from DOM state.
- A Guide or legend that explains evidence presentation belongs to the Rail because it explains Rail/map evidence channels; it does not become a second source of evidence rules.
- Supplementary evidence may hydrate or fail locally without changing whether the underlying Constellation is structurally usable.
- Debug/developer instrumentation may appear near the Rail in development builds, but it is not part of the Rail product contract.

## Tunables

- Human-sample floor for automatic Rail filtering: `100` games.

The 5% popular-bad retention rule is a Rail behavior requirement. It does not define automatic Constellation eligibility.

## Verification

Deterministic/browser contract tests should cover:

- Root and Line controls selecting the intended view;
- the Lines tab count following selected first-level Line relationships rather than deeper Constellation edges or supplementary evidence rows;
- Root counts following structural Constellation input rather than supplementary evidence rows;
- same-Nodus Root/Line transitions retaining an already-established inactive-mode count while the replacement Constellation loads, without carrying that count across Recenter;
- a Rail-only move remaining selectable without requiring a visible board;
- manual/explicit navigation remaining available outside automatic Constellation candidacy;
- sufficiently sampled plausible unpopular moves remaining selectable;
- bad/unfavorable moves being normally suppressed while a sufficiently popular mistake remains selectable;
- unknown/insufficient evidence not being treated as bad evidence for filtering;
- Rail navigation targeting the correct canonical position;
- evidence rows preserving their supplied evidence meaning rather than deriving it from presentation state;
- supplementary Rail evidence failure remaining local and not downgrading an established structural view.
