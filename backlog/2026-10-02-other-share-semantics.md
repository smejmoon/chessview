# Do:

Define and implement the Nodus Line-view "other" share directly from its intended presentation semantics instead of deriving it through legacy Explorer `qualifies` state. Determine which Explorer moves belong in the aggregate under the current product model, express that rule at its owning component boundary, and update `src/graph.js::omittedShare()`, `src/nodus-renderer.js`, and verification accordingly.

# Because:

`src/graph.js::omittedShare()` currently sums Explorer moves for which `decorateExplorerMoves()` reports `qualifies: false`, and the Nodus renderer shows that aggregate as `other`. That couples a visible presentation fact to the historical automatic-selection qualification threshold even though Constellation admission now belongs to evidence-backed Candidate selection and is not equivalent to a fixed prevalence cutoff.

The landed Candidate contract makes the mismatch sharper: Candidate construction requires usable rated-Lichess Prevalence, explicit-only navigation may have no Candidate at all, and Constellation can omit an otherwise valid Candidate because of cross-branch space allocation. Candidate membership or visible Constellation membership therefore cannot serve as the complement that defines a source-level "other" bucket.

Removing generic `qualifies` mechanically would leave this UI behavior without a defined rule. The aggregate needs an explicit owner and meaning before the old predicate can disappear from this path.

# Edges:

This outcome owns only the meaning and calculation of the displayed "other" aggregate. It does not change Constellation Candidate eligibility, same-source Salience, explicit navigation behavior, Rail Notable-Line classification, or ChartedGraph Edge Admission.

Do not define "other" as "not a Candidate", "not visible in the current Constellation", or "not explicit" merely because those sets are available. The aggregate should describe a deliberate presentation fact over the relevant Explorer source inventory.

Coordinate with `backlog/2026-10-02-explorer-move-decoration.md`: that outcome may remove generic `qualifies` once this consumer no longer needs it. Coordinate retained numeric thresholds with `backlog/2026-10-02-config-tunables-centralization.md`; centralization preserves an earned tunable's meaning but must not decide this semantic question.

A valid resolution may retain the current visible behavior under a newly explicit presentation rule, replace it with a different rule justified by the owning product contract, or remove the aggregate if inspection shows it no longer represents a useful product fact. Do not preserve the old qualification concept solely because the label currently depends on it.

# Complete:

The Line-view "other" indicator has a documented, consumer-owned meaning independent of generic Explorer qualification and independent of Candidate/Constellation membership; its implementation computes that meaning without `move.qualifies`; deterministic tests cover the decided inclusion rule and visibility threshold; and the result leaves Constellation selection, explicit navigation, and Rail classification semantics unchanged unless their own durable contracts are separately updated.

# Sync:

After any implementation or verification step that changes what remains, and before ending an implementation pass, synchronize this entry. Also synchronize when an action completes or becomes unavailable, a blocking condition changes, or a judgment is settled. Rewrite around the factual work and verification still open; do not accumulate progress history. If an outcome's completion condition is satisfied, run Backlog Close for that outcome. If Close cannot pass its normal gates, leave the entry open with the blocking condition explicit.
