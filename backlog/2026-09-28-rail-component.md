# Do:

Make Rail behavior satisfy `docs/components/rail.md` §Requirements and §Tunables with one testable owner of Rail selection/control semantics: current-position context, Root/Line controls and counts, Rail-only navigable moves, evidence rows, and Guide presentation must remain distinct from Constellation membership while rendering stays delegated to `docs/components/interface.md` §Requirements. The outcome does not require a separate Rail module if the existing implementation can satisfy that ownership without duplicated truth.

# Because:

`docs/components/rail.md` §Purpose / §Requirements now owns the supporting control/evidence surface, including the first-level Lines count and Rail-specific keep/suppress rules. `docs/components/evidence.md` §Purpose owns the semantic signals Rail consumes, while `docs/components/interface.md` §Requirements owns their two-dimensional rendering.

# Edges:

`docs/components/evidence.md` §Engine evidence / §Human evidence / §Root rarity owns evidence meaning rather than Rail selection. `docs/components/constellation.md` §Requirements owns visible-subgraph membership and structural relationships supplied to the Rail. Debug/developer tooling is explicitly outside `docs/components/rail.md` §Requirements and need not move with product Rail behavior.

# Unsettled:

Choose the smallest code seam that gives Rail selection/control behavior a testable owner without creating a second mutable copy of current-view truth. A new module is optional unless it is the simplest implementation boundary.

Decide whether the existing Guide rendering should remain an evidence-presentation delegate or sit behind the Rail owner; either choice must preserve `docs/components/evidence.md` §Purpose as the source of evidence meanings and `docs/components/interface.md` §Requirements as the owner of rendered visual treatment.

# Complete:

Tests cover `docs/components/rail.md` §Verification through one testable Rail behavior owner: Root/Line controls, the first-level Lines count, Constellation-derived structural Root counts, Rail-only/manual move navigation, plausible-unpopular retention, popular-bad retention, evidence-row rendering, and local supplementary failure behavior all satisfy the durable Rail contract without duplicating Constellation or Evidence truth.

# Sync:

After any implementation or verification step that changes what remains, and before ending an implementation pass, rewrite this entry around the factual work and verification still open; do not accumulate progress history. If an outcome's completion condition is satisfied, run Backlog Close for that outcome. If Close cannot pass its normal gates, leave the entry open with the blocking condition explicit.
