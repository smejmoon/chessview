# Constellation

## Purpose

Own the coherent current-view subgraph around the Nodus: which known canonical positions and relationships are represented, how selected branches compete for limited visible space, and which nearby positions are worth bounded supplementary lookahead.

A Constellation is a projection of Chessview's [`ChartedGraph`](charted-graph.md), not `ChartedGraph` itself and not its two-dimensional rendering. It combines durable Graph Edges with current evidence to form view-local Candidates. Eligibility, Salience, family/depth membership, and other composition annotations remain current-view state rather than Graph Edge state.

[Constellation selection](constellation-selection.md) owns automatic eligibility and same-source Salience. Constellation consumes selected Candidate objects in their selection order and owns coherent cross-branch allocation. Navigability is broader than Candidate membership: an explicitly materialized Graph Edge may remain navigable without belonging to the current Constellation.

## Composition

- The graph Chessview knows may be larger than the current Constellation. Omitting a known position from a view never removes it from `ChartedGraph`.
- Composition derives only from graph/source/evidence facts currently available. It does not start Explorer, engine, Masters, Root enrichment, or graph-reconciliation work.
- A Candidate refers to one known Graph Edge plus the current evidence and selection state needed for this composition. Current Explorer Prevalence, human-result evidence, engine evidence, eligibility, Salience, local ordering, family membership, and depth are not persisted back onto the Graph Edge.
- A Graph Edge does not become a Candidate merely because it is `explicit`. Explicit materialization preserves navigation behavior independently; usable current Prevalence may separately make that same Graph Edge an ordinary Candidate.
- A visible relationship is the Constellation-local representation of a selected Candidate. It refers to durable Graph Edge identity while carrying only current-view structure needed by composition; it is not a persisted second graph.
- Constellation allocates already-selected Candidates across branches in same-source order. It may merge, omit, deepen, or truncate structure to preserve coherence and fit available space, but it does not re-run provider acquisition.
- Prevalence from different source positions is local evidence, not one globally comparable score. Constellation owns the cross-branch choices needed to preserve a coherent view.
- Broad positions should retain meaningful alternatives instead of allowing one branch to consume the whole view; narrow Lines may deepen when that is the best use of available space.
- Distinct immediate Root or first-level Line families remain distinct until selected paths genuinely converge on the same canonical position.
- Canonical transpositions are represented once while preserving every selected visible relationship and family membership reaching the convergence.
- Current source evidence is authoritative for evidence-dependent composition. If Explorer evidence is absent, the Graph Edge remains known while Prevalence and related evidence are unknown; Constellation must not recover source statistics from Graph Edge persistence.
- Optional engine evidence may influence selection when already available, but missing engine evidence does not trigger acquisition from composition.
- As trustworthy facts arrive, current-view settlement may add, remove, or rearrange visible positions and relationships. The previously accepted Constellation remains current and interactive until a recomputed replacement is accepted.
- Candidates and Constellation structure belong to the current Nodus run. Recenter/history restoration rebuilds them from durable graph knowledge plus currently available source facts rather than carrying a frozen Candidate set forward.

## Reading frontier

Constellation identifies where missing graph-bearing Explorer knowledge can still change the constrained composition. It exposes those positions as a **Reading frontier**; it does not consume that frontier itself.

- If the Nodus itself lacks usable Explorer evidence and another Reading can establish automatic Line Candidates, the Nodus may be in the frontier even before any selected Line exists.
- When a currently selected Line position lacks an Explorer Reading and another Reading can still change the constrained composition, that position is in the frontier.
- Root composition may likewise expose source positions whose missing Explorer evidence prevents known non-explicit incoming relationships from becoming ordinary Candidates.
- Selection membership and missing acquisition are separate facts. A position belongs in the frontier only while its missing Reading can still affect the constrained result.
- A full visible-space budget does not by itself mean composition is settled; another selected-position Reading may still change which structure deserves that space.
- Conversely, Constellation does not expand through unselected Candidates merely to spend an acquisition budget.
- Once another Explorer Reading cannot change the constrained composition, the position leaves the frontier.
- The current-view refinement planner may nominate frontier positions for Explorer acquisition/reconciliation. When that run-owned work settles, the entire current Nodus is recomposed from facts now available rather than calling a Constellation-owned progress callback.
- A trustworthy provisional Constellation remains visible and navigable while its frontier is non-empty; [Current view](../architecture/current-view.md) and [Weather](weather.md) own settlement presentation.

Acquisition granularity, transport, cache policy, and Edge Admission are not part of the Constellation contract.

## Supplementary lookahead

After accepting a composition, Constellation may nominate a bounded set of canonical positions that are locally relevant to that structure and plausible near-term navigation targets.

Lookahead is deliberately weaker than Reading-frontier refinement:

- a nomination does not make a position visible;
- it does not mark the current Nodus unsettled;
- it does not require graph reconciliation now;
- it does not recursively expand through warmed results;
- it does not create graph identity or source-cache policy.

Lookahead relevance belongs here because Constellation owns coherent locality around the Nodus. Nomination remains bounded and follows accepted composition order rather than introducing a second relevance ranking. The concrete lookahead limit is an implementation tunable; this contract owns boundedness and ordering, not the current numeric value.

## Presentation boundary

Constellation optimizes for a coherent, understandable structure rather than maximum coverage.

The amount shown is constrained by available presentation space and legibility, not by a fixed product-level board count or opening-depth cap. Presentation may supply capacity constraints, but two-dimensional coordinates, board sizes, connector paths, colors, and labels remain presentation concerns.

Rail inventory and counts are independent of Constellation capacity. Presentation-space changes may alter Constellation membership without changing Rail values. [Rail](rail.md) owns exhaustive immediate Line inventory and its evidence presentation.

## Verification

Deterministic tests should cover:

- durable known graph state being larger than the selected Constellation;
- Candidates combining Graph Edges with current evidence without mutating persisted Graph Edges;
- explicit-only Graph Edges remaining durable/navigable without being manufactured into evidence-free Candidates;
- an explicit Graph Edge with usable current Prevalence participating through the ordinary Candidate path;
- visible relationships carrying current-view family/depth/selection state without becoming persisted graph state;
- composition consuming selected Candidate objects in selection order without independently re-running automatic eligibility or same-source ranking;
- composition performing no source acquisition or graph reconciliation side effects;
- missing center Explorer evidence producing a refinement frontier without making local composition fail;
- selected descendant positions entering/leaving the frontier according to whether another Reading can still change the constrained result;
- stale but usable local Explorer evidence remaining composable without composition initiating refresh;
- Explorer failure being unable to suppress already-known graph/navigation facts;
- Rail inventory and Line count remaining independent of presentation-space constraints;
- a trustworthy provisional Constellation remaining available while its Reading frontier is non-empty;
- a narrow useful Line deepening without an independent fixed opening-depth cap;
- missing optional engine evidence neither triggering acquisition nor invalidating structure;
- run-owned frontier work settling by whole-Nodus recomposition rather than Constellation progress callbacks;
- accepted compositions producing only bounded locally relevant supplementary lookahead nominations;
- Recenter/history restoration rebuilding view-local Candidates from durable graph knowledge and current evidence;
- distinct immediate Root/Line families remaining distinct before genuine convergence;
- canonical transpositions appearing once while retaining every selected relationship/family membership;
- cross-branch allocation preserving coherence without treating unrelated source-local Prevalence as one global rank.
