# Do:

Finish the remaining Rail behavior required by `docs/components/rail.md` §Requirements and §Tunables: current-position context, Root/Line controls and first-level counts, Rail-only/manual navigation, evidence-row presentation, Guide placement, and local supplementary-failure behavior must remain distinct from Constellation membership while rendering stays delegated to `docs/components/interface.md` §Requirements.

Use the established Rail selection seam rather than reconstructing Evidence: Rail keep/suppress policy consumes supplied Prevalence, engine quality, and human-result quality, while `docs/components/evidence.md` remains the source of those meanings.

# Because:

`docs/components/rail.md` §Purpose / §Requirements owns the supporting control/evidence surface, including the first-level Lines count and Rail-specific keep/suppress rules. `docs/components/evidence.md` §Purpose owns the semantic signals Rail consumes, while `docs/components/interface.md` §Requirements owns their two-dimensional rendering.

# Edges:

`docs/components/evidence.md` §Engine evidence / §Human evidence / §Root rarity owns evidence meaning rather than Rail selection. `docs/components/constellation.md` §Requirements owns visible-subgraph membership and structural relationships supplied to the Rail. Debug/developer tooling is explicitly outside `docs/components/rail.md` §Requirements and need not move with product Rail behavior.

# Unsettled:

Decide whether the existing Guide rendering should remain an evidence-presentation delegate or sit behind the Rail owner; either choice must preserve `docs/components/evidence.md` §Purpose as the source of evidence meanings and `docs/components/interface.md` §Requirements as the owner of rendered visual treatment.

# Complete:

Tests cover `docs/components/rail.md` §Verification through one testable Rail behavior owner: Root/Line controls, the first-level Lines count, Constellation-derived structural Root counts, Rail-only/manual move navigation, plausible-unpopular retention, popular-bad retention, evidence-row rendering, and local supplementary failure behavior all satisfy the durable Rail contract without duplicating Constellation or Evidence truth.

# Sync:

After any implementation or verification step that changes what remains, and before ending an implementation pass, synchronize this entry. Also synchronize when an action completes or becomes unavailable, a blocking condition changes, or a judgment is settled. Rewrite around the factual work and verification still open; do not accumulate progress history. If an outcome's completion condition is satisfied, run Backlog Close for that outcome. If Close cannot pass its normal gates, leave the entry open with the blocking condition explicit.
