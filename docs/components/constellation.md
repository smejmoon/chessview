# Constellation

## Purpose

Own the coherent current-view subgraph around the Nodus: which known canonical positions and relationships belong in the view, how current evidence affects their selection, and which nearby canonical positions are sufficiently relevant to that accepted composition to nominate as bounded supplementary lookahead.

A Constellation is a projection of Chessview's [`ChartedGraph`](charted-graph.md), not `ChartedGraph` itself and not its two-dimensional rendering. Lookahead nomination expresses ephemeral current-view relevance; it does not create graph identity, source-cache policy, or structural settlement obligations.

A Constellation combines durable [Graph Edges](../glossary.md#graph-edge) with currently available evidence to form view-local Candidates. Candidate eligibility, Salience, branch/family membership, depth, and other composition annotations belong to Constellation/selection state rather than to the durable Graph Edge.

## Requirements

- The set of positions Chessview knows and the set represented in the current Constellation are independent. Known positions may be omitted from a view without being removed from `ChartedGraph`.
- Constellation determines what known graph information can still matter to composition and may consume semantic evidence already available to that composition. [Knowledge acquisition](knowledge-acquisition.md) is responsible for fulfilling requested graph acquisition and reconciliation; Constellation does not own fetching, source cache policy, graph persistence mechanics, or Edge Admission.
- A Candidate refers to one known Graph Edge plus the current evidence and selection state needed to decide whether and how that relationship participates in this composition. Current Explorer Prevalence, human-result evidence, engine evidence, eligibility, Salience, local ordering, family membership, and depth are not persisted back onto the Graph Edge.
- A [visible relationship](../glossary.md#visible-relationship) is the Constellation-local representation of a selected Candidate. It refers back to durable Graph Edge identity while carrying only current-view structure needed by composition. It is not a persisted second graph.
- A Constellation request may cover one position or a larger graph region. Acquisition granularity is not part of the Constellation contract.
- Constellation produces the best trustworthy composition supported by currently available knowledge even when unresolved structural graph information may still improve that result. A trustworthy current composition may be published and navigated while refinement continues; [Weather](weather.md) owns whether the view is still settling.
- Line composition begins from acquired outgoing knowledge at the Nodus. When outgoing knowledge for a currently selected Line position is unresolved and another [Explorer Reading](knowledge-acquisition.md#terms) can still improve the constrained composition, Constellation may request that Reading and recompose from the enriched `ChartedGraph`. A full visible-space budget does not by itself make the composition settled, and Constellation does not expand through an unselected candidate merely to spend an acquisition/request budget.
- Selection membership and unresolved structural acquisition are separate facts. Line composition exposes a Reading frontier containing only selected positions for which another Explorer Reading can still affect the constrained composition; discovery consumes that frontier rather than treating every selected unread position as unresolved.
- Once additional outgoing knowledge cannot change the current constrained composition, Constellation stops requesting deeper Explorer Readings for that composition. This is a caller decision about information still needed, not an acquisition retention or Edge Admission rule.
- After an accepted composition exists, Constellation may also nominate a bounded lookahead of canonical positions that are locally relevant to that composition and plausible near-term navigation targets. These nominations are supplementary: they do not make those positions visible, unresolved, or required for settlement.
- Lookahead relevance belongs to Constellation because it already owns coherent local allocation around the Nodus. Nomination should derive from that accepted structural context rather than from a second independent global relevance ranking in Knowledge Acquisition. Exact breadth and tie-breaking may remain implementation policy while preserving boundedness and coherent locality.
- A lookahead nomination identifies reusable source work that may be useful if the user navigates nearby. It does not instruct Knowledge Acquisition to reconcile graph-bearing observations immediately or recursively expand through warmed results.
- Optional engine evidence is not a structural acquisition frontier for Constellation selection. Selection may use usable engine evidence already available to the composition, but missing engine evidence does not cause cloud-evaluation acquisition or keep the Constellation unsettled merely because a future evaluation could change Salience.
- Current source evidence remains authoritative for evidence-dependent selection. If Explorer evidence is absent or evicted, the Graph Edge remains known while Prevalence and related evidence are unknown; Constellation must not silently substitute stale statistics previously copied onto graph state.
- As trustworthy structural information arrives, recomposition may add, remove, or rearrange visible positions and relationships. Progressive refinement does not redefine canonical graph identity and does not require the previously trustworthy composition to disappear while the replacement is being determined.
- Constellation optimizes for a coherent, understandable structure rather than maximum coverage.
- The amount shown is constrained by available presentation space and legibility, not by a fixed product-level board count. Presentation may provide the constraints needed to compose an appropriate view.
- Rail inventory and Rail badge counts are not Constellation capacity rules. The Lines Rail may list every immediate Line from the current usable `LichessGamesDB` Reading, and its Lines badge may count [Notable Lines](../glossary.md#notable-line), while Constellation independently chooses which eligible/salient relationships and descendants best fit the available presentation space and coherent view. A Notable Line is not guaranteed a visible board, and presentation-space changes may make boards appear or disappear without changing settled Rail values.
- Visible depth has no arbitrary fixed opening-depth cap. Useful depth emerges from available presentation space, available knowledge, branch significance, and coherence; a narrow Line may deepen when doing so remains the best use of the view.
- Root and Line direction remain relative to the Nodus. Broad positions retain meaningful alternatives instead of allowing one branch to consume the whole view.
- Distinct immediate Root or first-level Line families remain structurally distinct until their selected paths genuinely converge on the same canonical position.
- Canonical graph identity is preserved. When selected paths transpose into the same canonical position, the Constellation represents that position once while preserving every selected visible relationship and the branch/family membership that reaches the convergence.
- Constellation may consume Prevalence, quality, human-result, rarity, or other evidence signals when deciding how to spend scarce visible space. [Evidence](evidence.md) owns the meaning and calculation of those signals; [Constellation selection](constellation-selection.md) owns automatic eligibility and local Salience.
- Prevalence from different source positions is not treated as a globally comparable score by itself. Constellation owns cross-branch allocation needed to preserve coherence.
- Constellation output refers to canonical positions and visible relationships. It does not redefine graph identity or persist a second graph.
- Two-dimensional coordinates, board sizes, connector paths, colors, labels, and other visual treatment belong to presentation rather than Constellation composition.

## Verification

Deterministic tests should cover:

- durable known graph state being larger than the selected Constellation;
- Candidates combining Graph Edges with current evidence without mutating persisted Graph Edges;
- visible relationships carrying current-view family/depth/selection state without becoming persisted graph state;
- current Explorer evidence affecting selection while its absence leaves evidence unknown rather than falling back to stale graph statistics;
- the same `ChartedGraph` composing differently under different presentation-space constraints without changing graph knowledge;
- Rail inventory and Notable Line count remaining unchanged when only presentation-space constraints change Constellation membership;
- a trustworthy provisional Constellation being available while its Reading frontier is still non-empty;
- coherent representation of multiple significant branches when space allows;
- a narrow useful Line deepening without an independent fixed opening-depth cap;
- selected Line positions requesting additional acquisition only while another Explorer Reading can still change constrained composition;
- a full constrained composition still exposing a Reading frontier when another selected-position Reading can improve which structure occupies the available space;
- a selected position with unresolved Explorer data disappearing from the Reading frontier once constrained composition is already structurally settled;
- unselected automatic candidates not causing deeper structural acquisition merely because they are known;
- accepted compositions producing only bounded locally relevant lookahead nominations, with those nominations remaining separate from visibility and structural settlement;
- missing optional engine evidence not causing structural acquisition or delaying settlement;
- accepted new structural information recomposing the Constellation without invalidating canonical graph identity;
- distinct immediate Root/Line families remaining distinct before genuine convergence;
- canonical transpositions appearing once while retaining every selected relationship and branch/family membership into or out of the convergence;
- Constellation requesting additional graph knowledge and nominating supplementary lookahead without itself performing transport, persistence, or Edge Admission side effects;
- evidence signals influencing selection without changing canonical graph identity;
- cross-branch allocation preserving coherence without comparing unrelated source-local Prevalence as one global rank.
