# Do:

Implement the Constellation composition behavior in `docs/components/constellation.md` §Requirements and the automatic eligibility/local-ordering behavior in `docs/components/constellation-selection.md` §Eligibility and §Ranking. Replace the current fixed `5%` automatic-expansion rule and fixed `19`-board visibility budget as product behavior while preserving canonical convergence, distinct branch/family structure until genuine convergence, useful depth without an arbitrary fixed opening-depth cap, same-source frequency ordering, and rare-candidate rescue without treating unknown evidence as negative evidence.

# Because:

`docs/components/constellation.md` §Purpose / §Requirements now owns the coherent current-view subgraph independently from durable knowledge acquisition and two-dimensional rendering. `docs/components/constellation-selection.md` §Eligibility / §Ranking owns automatic candidacy and comparable same-source ordering, while `docs/product.md` §Cross-product commitments keeps source-local frequency from becoming one global rank across unrelated branches.

# Edges:

Knowledge acquisition is a separate outcome under `docs/components/knowledge-acquisition.md` §Requirements: this entry may consume whatever graph/evidence state that boundary provides, but it does not own Explorer transport, persistence, or reconciliation. Semantic engine/human/frequency signal calculation is the separate `backlog/2026-09-28-evidence-signals.md` outcome; this entry consumes those signals rather than redefining them. `docs/components/interface.md` §Requirements owns deriving presentation-space constraints. `docs/components/rail.md` §Requirements permits omitted Constellation moves to remain navigable from the Rail.

# Unsettled:

Choose the selection-side rarity criterion, which supplied engine-quality states count as rescue or bad evidence, and same-source tie-breaking criteria consistent with `docs/components/constellation-selection.md` §Eligibility / §Ranking. Human-result favorable/unfavorable scoring and sample sufficiency belong to the Evidence outcome rather than this one.

Decide the shape of the presentation-space constraint passed into Constellation composition: a simple capacity may be sufficient initially, but the implementation must not recreate `19` as an invariant when available width, height, board legibility, or relationship geometry is what actually constrains the view.

Decide how pending or late engine/human evidence used for rare-candidate rescue interacts with current-view settlement. Evidence that can still alter current Constellation membership is structural under `docs/product.md` §Product usability bar; the implementation must choose a deterministic point at which selection has enough information to settle without making missing, failed, or insufficient evidence equivalent to negative evidence.

Decide how Constellation allocates scarce space across branches whose candidate percentages come from different immediate source positions. The implementation may use local candidate ordering and structural/evidence inputs, but it must preserve `docs/components/constellation.md` §Requirements coherence and must not manufacture one global rank solely from unrelated source-local percentages.

If a position has more distinct significant non-transposing continuations than the available presentation can show, decide the initial UX for the omitted eligible branches. Genuine canonical transpositions must merge; synthetic grouping is not yet a requirement.

# Complete:

The current-view composition code and deterministic tests implement `docs/components/constellation.md` §Requirements and `docs/components/constellation-selection.md` §Eligibility / §Ranking without treating `5%`, `19`, or a fixed opening depth as product limits; preserve one visible canonical position across transpositions while retaining selected branch/family relationships; demonstrate same-source frequency ordering plus both rare-candidate rescue paths; keep unknown rescue evidence distinct from negative evidence; and compose coherently across branches under constrained presentation space.

# Sync:

After any implementation or verification step that changes what remains, and before ending an implementation pass, rewrite this entry around the factual work and verification still open; do not accumulate progress history. If an outcome's completion condition is satisfied, run Backlog Close for that outcome. If Close cannot pass its normal gates, leave the entry open with the blocking condition explicit.
