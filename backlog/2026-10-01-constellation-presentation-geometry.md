# Do:

Review the deployed `10-04-geom` presentation across representative desktop aspect ratios and Rail allocations after the family-region and game-weighted connector pass. Confirm that each first-move Line family reads as one visual group without interrupting the flowing graph, Root/sibling context remains intelligible when enabled, connector thickness tracks visible relationship game count, and the Nodus remains playable while Weather is `Updating…`.

If the deployed result still shows overlap, clipping, family ambiguity, obscured/crossing flow, misleading connector weight, or interrupted Nodus interaction, correct the Interface-owned presentation geometry/rendering and repeat exact-tip CI plus preview review.

# Because:

`docs/components/constellation.md` requires one coherent current-view surroundings projection whose amount shown is constrained by available presentation space and legibility. `docs/components/interface.md` assigns one geometry owner the rendered map rectangle, board tiers, directional slots, family grouping, and abstract composition capacities.

The first deployed implementation replaced viewport-derived capacity and competing Root/Line geometry with actual-map geometry, but browser review exposed presentation defects that automated capacity tests did not catch. Same-Nodus publications rebuilt the center Chessground during `Updating…`, interrupting move interaction; flat slot ordering obscured Constellation families; and after family-first flow improved the graph, the remaining review showed that family boundaries still needed an explicit visual cue and edge thickness should communicate actual play volume rather than a first-move share proxy.

The current correction keeps the accepted Nodus Chessground stable across same-Nodus updates, keeps the existing family-first flowing placement, renders subtle Interface-owned family regions around the boards already assigned to each family, and derives connector width from current Evidence `frequency.games` on one visible relationship scale. The Evidence values remain presentation inputs; no game-count statistic is persisted back onto ChartedGraph edges or moved into Constellation selection.

# Edges:

Candidate eligibility and same-source Salience remain owned by `docs/components/constellation-selection.md`. This outcome may change which already-selected Candidates receive scarce visible space, but it must not recreate explicit-navigation admission or independently re-rank siblings from the same source.

Constellation owns which canonical positions and relationships belong in the coherent surroundings and already carries family/depth annotations. Interface owns two-dimensional coordinates, board sizes, family grouping, slot assignment, family-region decoration, connector paths, and game-count-to-stroke mapping. Pixel and DOM geometry do not cross into Constellation.

Current sizing is deliberately only three tiers: Nodus, prominent high-priority immediate Lines, and all remaining surrounding boards. Further size-policy tuning is not part of this outcome.

Root and sibling context is one toggle and is off by default. Enabling or disabling it changes composition inputs and reallocates space; it is not a DOM-only hide/show control. Acquisition policy while that layer is off is outside this outcome and must not block geometry completion.

Rail is Line-only. Root inventory/counts and Root/Line mode switching are not Rail facts. Rail Line inventory remains independent of Constellation capacity and Root-context visibility.

A material change in effective capacities rederives the Constellation inside the existing Nodus run, while a map change that only affects placement redraws the accepted Constellation. Constraint-driven recomposition may expose new Reading-frontier work and therefore make the Constellation Settling again; it is not a new Nodus run.

Same-Nodus structural, Evidence, Rail, and Weather publications must leave the accepted center Chessground interactive. Replacing that board is reserved for an actual Nodus/orientation/presentation-regime change that requires a new board surface.

Do not make mobile-specific interaction/layout polish a completion dependency. Future user-controlled Constellation zoom remains separate and should vary this one geometry/capacity model rather than create another system.

This outcome does not change ChartedGraph identity, Candidate eligibility, Knowledge Acquisition semantics, Explorer transport/cache policy, Rail evidence meaning, or Weather semantics.

# Complete:

The current view composes one surroundings Constellation against capacities derived from the actual rendered map presentation area rather than browser area alone. Deterministic/browser coverage proves that changing those capacities or Root-context visibility can change Constellation membership without changing durable graph knowledge or Rail Line inventory.

Nodus, Line, Root, and sibling boards consume one authoritative Interface geometry source. No separate Root coordinate pass or CSS center-position owner remains, connector rendering follows the final shared geometry, and visible boards remain recognizably grouped by their Constellation families rather than by incidental slot order. Family regions reinforce that grouping without replacing the relationship graph or forcing boards back into a lattice.

Visible connector thickness is monotonic with the current relationship's Evidence game count, normalized against the heaviest visible relationship and kept above a legible floor. Root and Line relationships use the same visual scale; missing Evidence falls back to the minimum stroke without inventing durable graph statistics.

The normal UI presents Nodus + Lines with Root/sibling context off by default and a Line-only Rail. Enabling Root context reallocates map capacity in the same Constellation rather than switching to another projection.

The accepted Nodus remains playable during `Updating…`; same-Nodus presentation updates do not reconstruct its Chessground under user interaction.

Supported desktop layouts remain legible across materially different map rectangles and Rail allocations, including cases that previously over-selected, overlapped, visually scrambled family structure, or hid graph flow because the browser viewport was larger than the usable map. Mobile-specific polish and detailed future size/priority tuning may remain unfinished.

# Sync:

After any implementation or verification step that changes what remains, and before ending an implementation pass, synchronize this entry. Also synchronize when an action completes or becomes unavailable, a blocking condition changes, or a judgment is settled. Rewrite around the factual work and verification still open; do not accumulate progress history. If an outcome's completion condition is satisfied, run Backlog Close for that outcome. If Close cannot pass its normal gates, leave the entry open with the blocking condition explicit.
