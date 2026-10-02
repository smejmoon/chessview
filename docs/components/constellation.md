# Constellation

## Purpose

Own the coherent current-view subgraph around the Nodus: which known canonical positions and relationships are represented, how selected branches compete for limited visible space, and which nearby positions are worth bounded supplementary lookahead.

A Constellation is a projection of Chessview's [`ChartedGraph`](charted-graph.md), not `ChartedGraph` itself and not its two-dimensional rendering. It combines durable [Graph Edges](../glossary.md#graph-edge) with current evidence to form view-local Candidates. Eligibility, Salience, family/depth membership, and other composition annotations remain current-view state rather than Graph Edge state.

[Constellation selection](constellation-selection.md) owns automatic eligibility and same-source Salience. Constellation consumes that selected/ranked Candidate set and owns coherent cross-branch allocation.

## Composition

- The graph Chessview knows may be larger than the current Constellation. Omitting a known position from a view never removes it from `ChartedGraph`.
- A Candidate refers to one known Graph Edge plus the current evidence and selection state needed for this composition. Current Explorer Prevalence, human-result evidence, engine evidence, eligibility, Salience, local ordering, family membership, and depth are not persisted back onto the Graph Edge.
- A [visible relationship](../glossary.md#visible-relationship) is the Constellation-local representation of a selected Candidate. It refers to durable Graph Edge identity while carrying only current-view structure needed by composition; it is not a persisted second graph.
- Constellation allocates already-selected/ranked Candidates across branches. It may merge, omit, deepen, or truncate structure to preserve coherence and fit available space, but it does not re-run automatic Candidate eligibility.
- Prevalence from different source positions is local evidence, not one globally comparable score. Constellation owns the cross-branch choices needed to preserve a coherent view.
- Broad positions should retain meaningful alternatives instead of allowing one branch to consume the whole view; narrow Lines may deepen when that is the best use of available space.
- Distinct immediate Root or first-level Line families remain distinct until their selected paths genuinely converge on the same canonical position.
- Canonical transpositions are represented once while preserving every selected visible relationship and family membership reaching the convergence.
- Current source evidence is authoritative for evidence-dependent composition. If Explorer evidence is absent or evicted, the Graph Edge remains known while Prevalence and related evidence are unknown; Constellation must not recover stale statistics from graph persistence.
- Optional engine evidence may influence selection when already available, but missing engine evidence does not trigger cloud-evaluation acquisition or make structural settlement wait for it.
- As trustworthy structural information arrives, recomposition may add, remove, or rearrange visible positions and relationships without redefining canonical graph identity or requiring the previously trustworthy composition to disappear first.

## Structural discovery

Constellation decides when additional graph-bearing knowledge can still change the constrained composition; [Knowledge acquisition](knowledge-acquisition.md) fulfills those requests and owns transport, source-cache behavior, graph persistence mechanics, and Edge Admission.

- Line composition begins from acquired outgoing knowledge at the Nodus.
- When a currently selected Line position lacks an Explorer Reading and another Reading could still change the constrained composition, Constellation exposes that position in a **Reading frontier**.
- Discovery consumes the Reading frontier, requests the needed graph-bearing Reading, and recomposes from the enriched `ChartedGraph`.
- Selection membership and unresolved structural acquisition are separate facts. An unread selected position belongs in the frontier only while its missing Reading can still affect the constrained result.
- A full visible-space budget does not by itself mean the composition is settled; another selected-position Reading may still change which structure deserves that space.
- Conversely, Constellation does not expand through an unselected Candidate merely to spend an acquisition budget.
- Once another Explorer Reading cannot change the current constrained composition, that position leaves the structural frontier.
- A trustworthy provisional Constellation may remain visible and navigable while its Reading frontier is non-empty; [Weather](weather.md) owns whether the view is still settling.

A Constellation request may cover one position or a larger graph region. Acquisition granularity is not part of this contract.

## Supplementary lookahead

After accepting a composition, Constellation may nominate a bounded set of canonical positions that are locally relevant to that structure and plausible near-term navigation targets.

Lookahead is deliberately weaker than structural discovery:

- a nomination does not make a position visible;
- it does not mark the composition unresolved;
- it does not require graph reconciliation now;
- it does not recursively expand through warmed results;
- it does not create graph identity or source-cache policy.

Lookahead relevance belongs here because Constellation already owns coherent locality around the Nodus. Exact breadth and tie-breaking may remain implementation policy while preserving boundedness and local relevance.

## Presentation boundary

Constellation optimizes for a coherent, understandable structure rather than maximum coverage.

The amount shown is constrained by available presentation space and legibility, not by a fixed product-level board count or opening-depth cap. Presentation may supply capacity constraints, but two-dimensional coordinates, board sizes, connector paths, colors, and labels remain presentation concerns.

Rail inventory and counts are independent of Constellation capacity. Presentation-space changes may alter Constellation membership without changing settled Rail values. [Rail](rail.md) owns its source inventory and Notable-Line semantics.

## Verification

Deterministic tests should cover:

- durable known graph state being larger than the selected Constellation;
- Candidates combining Graph Edges with current evidence without mutating persisted Graph Edges;
- visible relationships carrying current-view family/depth/selection state without becoming persisted graph state;
- composition consuming selected/ranked Candidates without independently re-running automatic eligibility;
- current Explorer evidence affecting selection while its absence leaves evidence unknown rather than falling back to stale graph statistics;
- the same `ChartedGraph` composing differently under different presentation-space constraints without changing graph knowledge;
- Rail inventory and Notable Line count remaining unchanged when only presentation-space constraints change Constellation membership;
- a trustworthy provisional Constellation remaining available while its Reading frontier is non-empty;
- a full constrained composition still exposing a Reading frontier when another selected-position Reading can improve which structure occupies the available space;
- a selected position leaving the Reading frontier once its missing Explorer data can no longer change the constrained composition;
- unselected automatic Candidates not causing deeper structural acquisition merely because they are known;
- a narrow useful Line deepening without an independent fixed opening-depth cap;
- missing optional engine evidence neither triggering structural acquisition nor delaying settlement;
- accepted compositions producing only bounded locally relevant lookahead nominations, separate from visibility and structural settlement;
- accepted new structural information recomposing the Constellation without invalidating canonical graph identity;
- distinct immediate Root/Line families remaining distinct before genuine convergence;
- canonical transpositions appearing once while retaining every selected relationship and family membership into or out of the convergence;
- Constellation requesting additional graph knowledge and nominating supplementary lookahead without performing transport, persistence, or Edge Admission side effects;
- cross-branch allocation preserving coherence without treating unrelated source-local Prevalence as one global rank.
