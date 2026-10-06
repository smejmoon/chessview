# Constellation

## Purpose

Own the coherent current-view subgraph around the Nodus: which known canonical positions and relationships are represented, how selected branches compete for limited visible space, and which nearby positions are worth bounded supplementary lookahead.

A Constellation is a projection of Chessview's [`ChartedGraph`](charted-graph.md), not `ChartedGraph` itself and not its two-dimensional rendering. It combines durable Graph Edges with current [Evidence](evidence.md) to form view-local Candidates. Eligibility, Salience, family/depth membership, and other composition annotations remain current-view state rather than Graph Edge state.

[Constellation selection](constellation-selection.md) owns automatic eligibility and same-source Salience. Constellation consumes selected Candidate objects in their selection order and owns coherent cross-branch allocation. Navigability is broader than Candidate membership: an explicitly materialized Graph Edge may remain navigable without belonging to the current Constellation.

## Composition

- One Nodus has one current Constellation. Lines, optional Root context, siblings, and canonical convergence are roles inside that surroundings projection rather than separate Root and Line projections.
- The normal surroundings emphasize the Nodus and Lines. Root context is off by default; when enabled, immediate Roots and useful sibling context may compete for visible space in the same Constellation.
- Root-context visibility is a composition input. Turning it on or off reallocates scarce visible space; it is not a post-composition DOM hide/show operation.
- The graph Chessview knows may be larger than the current Constellation. Omitting a known position from a view never removes it from `ChartedGraph`.
- Composition derives from durable graph facts plus Evidence currently available for relevant canonical positions and Graph Edges. It requests Evidence through the Evidence boundary rather than calculating evidence semantics or reading engine/Explorer/Masters clients directly.
- Evidence requests during composition are reads only. Constellation does not start Explorer, engine, Masters, Root enrichment, or graph-reconciliation work.
- A Candidate refers to one known Graph Edge plus the current Evidence and selection state needed for this composition. Prevalence, human-result Evidence, engine Evidence, eligibility, Salience, local ordering, family membership, and depth are not persisted back onto the Graph Edge.
- A Graph Edge does not become a Candidate merely because it is `explicit`. Explicit materialization preserves navigation behavior independently; usable current Prevalence may separately make that same Graph Edge an ordinary Candidate.
- A visible relationship is the Constellation-local representation of a selected Candidate. It refers to durable Graph Edge identity while carrying only current-view structure needed by composition; it is not a persisted second graph and does not own a duplicate Evidence record.
- Constellation allocates already-selected Candidates across structural roles and branches in same-source order. It may merge, omit, deepen, or truncate structure to preserve coherence and fit available space, but it does not re-run provider acquisition.
- Forward Lines have the normal allocation priority. Root and sibling context is lower-priority explanatory context and only participates when its presentation layer is enabled. Concrete priority tuning remains an implementation choice while this ordering remains true.
- Prevalence from different source positions is local Evidence, not one globally comparable score. Constellation owns the cross-branch choices needed to preserve a coherent view.
- Broad positions should retain meaningful alternatives instead of allowing one branch to consume the whole view; narrow Lines may deepen when that is the best use of available space.
- Distinct immediate Root or first-level Line families remain distinct until selected paths genuinely converge on the same canonical position.
- Canonical transpositions are represented once while preserving every selected visible relationship and family membership reaching the convergence.
- Evidence is authoritative for evidence-dependent composition. If rated Reading Evidence is unavailable, the Graph Edge remains known while Prevalence and related signals are unknown; Constellation must not recover source statistics from Graph Edge persistence.
- Optional engine Evidence may influence selection when currently available, but missing engine Evidence does not trigger acquisition from composition.
- As admitted structural facts are incorporated, composition may add, remove, or rearrange visible positions and relationships. The previously accepted Constellation remains current and interactive until a recomputed replacement is accepted.
- Candidates and Constellation structure belong to the current Nodus run. Recenter/history restoration rebuilds them from durable graph knowledge plus currently available Evidence rather than carrying a frozen Candidate set forward.

## Settlement

A Constellation applies the glossary meaning of [Settled](../glossary.md#settled) to its **shape**. It is Settled when Chessview has finished deciding the shape of the current view with respect to its admitted structural obligations: no unresolved admitted obligation can still change constrained composition, and every completed relevant structural result has been incorporated. Repeating composition from the same admitted facts and presentation inputs would then produce the same shape.

The Reading frontier is how Constellation identifies and admits missing rated Explorer knowledge that may participate in structural settlement. Constellation learns whether a usable rated Reading is currently available by asking Evidence; it does not inspect Explorer transport/cache state itself. A frontier obligation participates only while another Reading can still change constrained composition. A completed structural Reading or reconciliation remains relevant to settlement until recomposition has incorporated its result. Nodus may carry that obligation alongside other current-Nodus refinement demand, but the structural admission belongs to Constellation.

Constellation determines settlement from the facts visible to each composition. If a structural completion was not visible to an in-flight composition and its obligation remains relevant to that composition, the Reading frontier remains open and the result remains Settling. If the new composition makes the obligation irrelevant to constrained shape, it need not wait for that result. [Current view](../architecture/current-view.md) responds to coordinated completion by requesting another recomposition; it does not override Constellation's settlement judgment or invalidate an otherwise trustworthy in-flight composition.

Missing cloud evaluation is not a structural obligation. Engine Evidence already available to composition may affect selection, but supplementary engine acquisition does not keep or retroactively make an otherwise Settled Constellation unsettled. Supplementary Masters, Evidence presentation, Rail, and lookahead work likewise do not determine Constellation settlement.

## Reading frontier

Constellation identifies where missing graph-bearing Explorer knowledge can still change the constrained composition. It exposes those positions as a **Reading frontier**; it does not consume that frontier itself.

- If the Nodus itself lacks usable rated Reading Evidence and another Reading can establish automatic Line Candidates, the Nodus may be in the frontier even before any selected Line exists.
- When a currently selected Line position lacks a usable rated Reading and another Reading can still change the constrained composition, that position is in the frontier.
- When Root context is enabled, source positions needed to decide selected Root or sibling context may likewise participate while another Reading can still change constrained composition.
- Selection membership and missing acquisition are separate facts. A position belongs in the frontier only while its missing Reading can still affect the constrained result.
- A full visible-space budget does not by itself mean composition is Settled; another selected-position Reading may still change which structure deserves that space.
- Conversely, Constellation does not expand through unselected Candidates merely to spend an acquisition budget.
- Once another Explorer Reading cannot change the constrained composition, the position leaves the frontier and no longer participates in structural settlement.
- Nodus includes frontier positions in current-Nodus refinement demand while preserving their structural provenance. Current-view coordination may then map that demand to Explorer acquisition/reconciliation. When such a structural result completes, the current Nodus is recomposed from facts now available; the Constellation is not Settled until that completed result has been incorporated or its obligation is no longer relevant to constrained shape.
- A trustworthy provisional Constellation remains visible and navigable while it is Settling; [Current view](../architecture/current-view.md) coordinates incorporation and [Weather](weather.md) presents settlement state.

Acquisition granularity, transport, cache policy, and Edge Admission are not part of the Constellation contract.

## Supplementary lookahead

After accepting a composition, Constellation may nominate a bounded set of canonical positions that are locally relevant to that structure and plausible near-term navigation targets.

Lookahead is deliberately outside structural settlement:

- a nomination does not make a position visible;
- it does not make the current Constellation Settling;
- it does not require graph reconciliation now;
- it does not recursively expand through warmed results;
- it does not create graph identity or source-cache policy.

Lookahead relevance belongs here because Constellation owns coherent locality around the Nodus. Nomination remains bounded and follows accepted composition order rather than introducing a second relevance ranking. The concrete lookahead limit is an implementation tunable; this contract owns boundedness and ordering, not the current numeric value.

## Presentation boundary

Constellation optimizes for a coherent, understandable structure rather than maximum coverage.

The amount shown is constrained by available presentation space and legibility, not by a fixed product-level board count or opening-depth cap. Lens supplies abstract Line and optional Root/sibling capacities derived from the downstream and upstream presentation regions. Those abstract counts are the only spatial constraint that crosses into Constellation; region rectangles, placement cells, coordinates, and DOM measurements remain Lens-private.

The current presentation uses three board-size tiers: the Nodus, prominent high-priority immediate Lines, and the remaining surrounding boards. Exact sizes and how many immediate Lines can use the prominent tier are Lens concerns; Constellation membership remains governed by the supplied capacities and structural priorities. Those capacities are region-derived abstract counts, not rows, columns, slots, or opening-depth limits.

A material change to effective capacities or Root-context visibility invalidates the previous composition as the fixed point for the new inputs and requires same-Nodus recomposition. That recomposition may expose or remove Reading-frontier obligations; if no admitted structural obligation remains, the new shape may be Settled immediately. Once membership is accepted, presentation lays out that one topology as a whole; Root/sibling and Line roles constrain upstream/downstream placement but do not create parallel projections. A presentation-only relayout that leaves the effective composition inputs unchanged does not recompose Constellation.

Rail inventory is independent of Constellation capacity and Root-context visibility. Presentation-space changes may alter Constellation membership without changing Rail values. [Rail](rail.md) owns exhaustive immediate Line inventory and its evidence presentation.

## Verification

Deterministic tests should cover:

- durable known graph state being larger than the selected Constellation;
- one Constellation containing forward Lines and, when enabled, Root/sibling context without duplicate canonical positions;
- disabling Root context reallocating its capacity to forward Lines rather than merely hiding already-composed boards;
- Constellation requesting position/Graph Edge Evidence without Evidence depending on Constellation structure;
- Constellation composition importing neither Evidence arithmetic nor Explorer/engine/Masters provider clients for Candidate evidence;
- Candidates combining Graph Edges with current Evidence without mutating persisted Graph Edges;
- explicit-only Graph Edges remaining durable/navigable without being manufactured into evidence-free Candidates;
- an explicit Graph Edge with usable current Prevalence participating through the ordinary Candidate path;
- visible relationships carrying current-view family/depth/selection state without becoming persisted graph or duplicate Evidence state;
- composition consuming selected Candidate objects in selection order without independently re-running automatic eligibility or same-source ranking;
- composition performing no source acquisition or graph reconciliation side effects;
- missing center rated Reading Evidence producing a Reading frontier without making local composition fail;
- selected descendant positions entering/leaving the Reading frontier according to whether another Reading can still change the constrained result;
- a Reading-frontier obligation keeping the Constellation Settling only while another Reading can change constrained composition;
- Nodus preserving Reading-frontier structural provenance when combining current-Nodus refinement demand;
- a completed structural Reading/reconciliation not counting as Settled until recomposition incorporates it or makes its obligation irrelevant;
- stale but usable local Evidence remaining composable without composition initiating refresh;
- Explorer failure being unable to suppress already-known graph/navigation facts;
- Rail Line inventory remaining independent of presentation-space constraints and Root-context visibility;
- a material presentation-constraint change recomposing the same-Nodus Constellation and being able to expose a new Reading-frontier obligation;
- a presentation-only relayout leaving Constellation composition and settlement unchanged;
- a trustworthy provisional Constellation remaining available while it is Settling;
- a narrow useful Line deepening without an independent fixed opening-depth cap;
- missing optional engine Evidence neither triggering acquisition nor creating a structural settlement obligation;
- late supplementary engine evidence not reopening an otherwise Settled Constellation by itself;
- accepted compositions producing only bounded locally relevant supplementary lookahead nominations;
- Recenter/history restoration rebuilding view-local Candidates from durable graph knowledge and current Evidence;
- distinct immediate Root/Line families remaining distinct before genuine convergence;
- canonical transpositions appearing once while retaining every selected relationship/family membership;
- cross-branch allocation preserving coherence without treating unrelated source-local Prevalence as one global rank.
