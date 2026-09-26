# Do:

Replace the single-descendant-spine behavior in automatic Line discovery and neighborhood selection with deterministic per-first-level-Line frontiers that spend spare capacity round-robin across qualifying continuations, including qualifying siblings rather than only one child per depth.

# Because:

`docs/components/discovery.md` §Requirements and §Verification require recursive inspection of qualifying branches while useful slots remain, a fair first slot for each first-level Line, remaining capacity spent round-robin across Lines, and deterministic coverage that proves qualifying siblings are not starved.

`audits/2026-09-25-17-30-00-gpt-5.6-sol-chatgpt.md`, finding “Branch-balanced discovery collapses each Line to one descendant spine,” records that discovery advances with only `next[0]` and neighborhood selection advances each branch through one `current` descendant. Qualifying siblings can therefore remain undiscovered or unselected despite spare budget.

# Edges:

Browser composition ownership is tracked separately in `backlog/2026-09-25-browser-composition-boundary.md`; this outcome changes graph discovery/selection policy and its tests, not DOM ownership.

The existing 5% local qualification threshold, sample floor, cancellation behavior, canonical transposition merging, responsive board budget, and deterministic ordering remain constraints rather than subjects for redesign.

# Unsettled:

Make `docs/components/discovery.md` §Requirements phrase “a preference for useful narrow continuations before excessive breadth from one bushy branch” operational and deterministic: define the frontier ordering within each first-level Line without creating an arbitrary depth cap or starving qualifying siblings.

Decide whether discovery and visible-neighborhood selection should share one frontier abstraction or use separate implementations pinned to the same fairness contract.

# Complete:

With spare budget, automatic discovery does not stop at the first qualifying child of a source when additional qualifying siblings can contribute useful Line positions.

Visible Line selection gives every qualifying first-level Line its fair initial slot, then allocates remaining slots round-robin across Line frontiers with deterministic ordering and without collapsing each Line to one linear chain.

Deterministic tests cover at least one bushy Line with multiple qualifying siblings plus another first-level Line, proving fair first slots, sibling reachability with spare capacity, stable ordering, threshold/sample-floor behavior, and cancellation/regression safety.

# Steps:

Add failing deterministic cases that expose sibling starvation in discovery and neighborhood selection.

Define a per-Line frontier and deterministic within-frontier ordering that implements the documented fairness rule.

Apply the frontier to automatic discovery, preserving request budget, qualification, sample-floor, and cancellation behavior.

Apply the same fairness contract to visible-neighborhood selection and run the graph/explorer regression suite.

# Sync:

After any implementation or verification step that changes what remains, and before ending an implementation pass, rewrite this entry around the factual work and verification still open; do not accumulate progress history. If `Complete:` is satisfied, run Backlog Close. If Close cannot pass its normal gates, leave the entry open with the blocking condition explicit.
