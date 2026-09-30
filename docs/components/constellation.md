# Constellation

## Purpose

Own the coherent current-view subgraph around the Nodus: which known canonical positions and relationships belong in the view.

A Constellation is a projection of Chessview's durable graph, not the durable graph itself and not its two-dimensional rendering.

## Requirements

- The set of positions Chessview knows and the set represented in the current Constellation are independent. Known positions may be omitted from a view without being removed from durable graph knowledge.
- Constellation determines what graph and evidence information it needs for composition. [Knowledge acquisition](knowledge-acquisition.md) is responsible for supplying or enriching that information; Constellation does not own fetching, derivation, reconciliation, caching, persistence mechanics, or Edge Admission.
- A Constellation request may cover one position or a larger graph region. Acquisition granularity is not part of the Constellation contract.
- Constellation produces the best trustworthy composition supported by currently available knowledge even when unresolved structural information may still improve that result. A trustworthy current composition may be published and navigated while refinement continues; [Weather](weather.md) owns whether the view is still settling.
- Line composition begins from acquired outgoing knowledge at the Nodus. When outgoing knowledge for a currently selected Line position is unresolved and another [Explorer Reading](knowledge-acquisition.md#terms) can still improve the constrained composition, Constellation may request that Reading and recompose from the enriched durable graph. A full visible-space budget does not by itself make the composition settled, and Constellation does not expand through an unselected candidate merely to spend an acquisition/request budget.
- Selection membership and unresolved structural acquisition are separate facts. Line composition exposes a Reading frontier containing only selected positions for which another Explorer Reading can still affect the constrained composition; discovery consumes that frontier rather than treating every selected unread position as unresolved.
- Once additional outgoing knowledge cannot change the current constrained composition, Constellation stops requesting deeper Explorer Readings for that composition. This is a caller decision about information still needed, not an acquisition retention or Edge Admission rule.
- As trustworthy structural information arrives, recomposition may add, remove, or rearrange visible positions and relationships. Progressive refinement does not redefine canonical graph identity and does not require the previously trustworthy composition to disappear while the replacement is being determined.
- Constellation optimizes for a coherent, understandable structure rather than maximum coverage.
- The amount shown is constrained by available presentation space and legibility, not by a fixed product-level board count. Presentation may provide the constraints needed to compose an appropriate view.
- Visible depth has no arbitrary fixed opening-depth cap. Useful depth emerges from available presentation space, available knowledge, branch significance, and coherence; a narrow Line may deepen when doing so remains the best use of the view.
- Root and Line direction remain relative to the Nodus. Broad positions retain meaningful alternatives instead of allowing one branch to consume the whole view.
- Distinct immediate Root or first-level Line families remain structurally distinct until their selected paths genuinely converge on the same canonical position.
- Canonical graph identity is preserved. When selected paths transpose into the same canonical position, the Constellation represents that position once while preserving every selected relationship and the branch/family membership that reaches the convergence.
- Constellation may consume frequency, quality, human-result, rarity, or other evidence signals when deciding how to spend scarce visible space. [Evidence](evidence.md) owns the meaning and calculation of those signals; [Constellation selection](constellation-selection.md) owns automatic eligibility and local candidate ordering.
- Frequency evidence from different source positions is not treated as a globally comparable score by itself. Constellation owns cross-branch allocation needed to preserve coherence.
- Constellation output refers to canonical positions and visible relationships. It does not redefine graph identity or persist a second graph.
- Two-dimensional coordinates, board sizes, connector paths, colors, labels, and other visual treatment belong to presentation rather than Constellation composition.

## Verification

Deterministic tests should cover:

- durable known graph state being larger than the selected Constellation;
- the same durable graph composing differently under different presentation-space constraints without changing graph knowledge;
- a trustworthy provisional Constellation being available while its Reading frontier is still non-empty;
- coherent representation of multiple significant branches when space allows;
- a narrow useful Line deepening without an independent fixed opening-depth cap;
- selected Line positions requesting additional acquisition only while another Explorer Reading can still change constrained composition;
- a full constrained composition still exposing a Reading frontier when another selected-position Reading can improve which structure occupies the available space;
- a selected position with unresolved Explorer data disappearing from the Reading frontier once constrained composition is already structurally settled;
- unselected automatic candidates not causing deeper acquisition merely because they are known;
- accepted new structural information recomposing the Constellation without invalidating canonical graph identity;
- distinct immediate Root/Line families remaining distinct before genuine convergence;
- canonical transpositions appearing once while retaining every selected relationship and branch/family membership into or out of the convergence;
- Constellation requesting additional knowledge without itself performing transport or persistence side effects;
- evidence signals influencing selection without changing canonical graph identity;
- cross-branch allocation preserving coherence without comparing unrelated source-local percentages as one global rank.
