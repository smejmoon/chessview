# Do:

Finish Constellation presentation geometry around one Lens-owned spatial model.

Keep presentation capacity separate from final placement. Lens derives the Nodus rectangle, board-size regime, usable Root/Line presentation space, and abstract Constellation capacities from the actual rendered map rectangle. After Constellation chooses the coherent visible subgraph, presentation places that accepted topology so structural direction, depth, family continuity, and transpositions remain legible.

Remove competing coordinate ownership, then review representative desktop map rectangles and Rail allocations. Correct presentation defects demonstrated by that review: overlap, clipping, unreadable graph flow, ambiguous family structure, misleading connector weight, or interrupted Nodus interaction.

# Because:

`docs/components/constellation.md` requires one coherent surroundings projection whose amount shown is constrained by available presentation space and legibility. `docs/components/lens.md` makes Lens the presentation owner: it derives geometry and effective composition constraints while Constellation owns which canonical positions and relationships belong in the current surroundings.

Capacity and placement are different decisions. Available space determines how much surrounding structure Constellation may select; the accepted Constellation topology determines how that selected structure should occupy the space. Presentation structure should not become the spatial meaning of the graph.

The relationship graph should carry family and transposition structure wherever possible. Explicit family decoration is not a completion requirement; add it only if deployed review shows that topology-aware placement and connectors are insufficient to make those relationships readable.

# Edges:

Candidate eligibility and same-source Salience remain owned by `docs/components/constellation-selection.md`. Presentation consumes the accepted Constellation and must not recreate eligibility, independently re-rank siblings, or turn presentation constraints into persisted graph facts.

Constellation owns visible canonical positions, relationships, family/depth annotations, and coherent membership. Lens owns presentation environment, board scales, usable regions, abstract capacities, final two-dimensional placement, and connector geometry. Pixel and DOM geometry do not cross into Constellation.

The current visual importance regime remains limited to the Nodus, prominent immediate Lines, and the remaining surroundings. This outcome may change how those differently sized nodes are arranged, but detailed future size-policy tuning is separate.

Root and sibling context remains optional current-Nodus context. Enabling it reallocates presentation space and may change Constellation membership; it is not a DOM-only hide/show control. Rail remains Line-only and independent of Constellation capacity or Root-context visibility.

A material change in effective capacities requests same-Nodus recomposition. A presentation change that alters only placement redraws the accepted Constellation. Constraint-driven recomposition may expose new Reading-frontier work without creating a new Nodus run.

Same-Nodus structural, Evidence, Rail, and Weather publications must leave the accepted center Chessground interactive. Replacing the center board is reserved for a presentation change that actually requires a new board surface.

Visible connector thickness continues to use current relationship Evidence game count on one visible scale, normalized against the heaviest visible relationship and bounded below by a legible minimum stroke. Missing Evidence uses that same minimum without inventing durable Graph Edge statistics.

Mobile-specific polish is not a completion dependency. `backlog/2026-10-01-constellation-zoom.md` should vary this same presentation/capacity model rather than create another geometry system. The exploratory star-map outcome may later change node representations, but it should be able to reuse the same separation between composition capacity and topology-aware placement.

This outcome does not change ChartedGraph identity, Candidate eligibility, Knowledge Acquisition semantics, Explorer transport/cache policy, Rail evidence meaning, or Weather semantics.

# Complete:

One Lens-owned presentation model derives the Nodus rectangle, surrounding usable space, board-size regime, and abstract Root/Line capacities from the actual rendered map rectangle. CSS and renderer code do not independently own competing board coordinates.

Constellation receives only abstract capacities and chooses the coherent visible subgraph. Final placement then uses the accepted Constellation's structural relationships so Roots remain upstream, Lines downstream, related continuations read together, and genuine transpositions remain one visible canonical position with every selected relationship still intelligible.

Changing effective capacities or Root-context visibility can change Constellation membership without changing durable graph knowledge or Rail Line inventory; presentation-only relayout leaves membership and settlement unchanged.

Connector rendering follows the final positioned nodes. Connector thickness is monotonic with current relationship Evidence game count, normalized against the heaviest visible relationship, and bounded below by a legible minimum stroke on one scale shared by Root and Line relationships.

The accepted Nodus remains playable during `Updating…`; same-Nodus publications do not reconstruct its Chessground under user interaction.

Representative supported desktop layouts remain legible across materially different map rectangles and Rail allocations without overlap, clipping, misleading flow, or family ambiguity. Passing this review does not require family-region decoration or a particular layout algorithm; those mechanisms earn their place only if needed to satisfy the observable result.

# Sync:

After any implementation or verification step that changes what remains, and before ending an implementation pass, synchronize this entry. Also synchronize when an action completes or becomes unavailable, a blocking condition changes, or a judgment is settled. Rewrite around the factual work and verification still open; do not accumulate progress history. If an outcome's completion condition is satisfied, run Backlog Close for that outcome. If Close cannot pass its normal gates, leave the entry open with the blocking condition explicit.
