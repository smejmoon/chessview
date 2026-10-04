# Do:

Verify the remaining incorporation-ordering races now that structural settlement is owned by the accepted Constellation rather than controller task counts.

A source-usable Explorer Reading no longer discharges structural settlement by itself: the Reading frontier remains open until that exact graph-bearing observation has completed reconciliation. Task completion then schedules recomposition, and settlement may clear only when a replacement accepted Constellation no longer reports structural Settling.

Prove that overlapping completions, completions arriving during recomposition, unchanged accepted recompositions, and obsolete structural completions cannot create a false Settled publication.

# Because:

`docs/glossary.md`, `docs/components/constellation.md`, and `docs/architecture/current-view.md` require completed relevant structural results to be incorporated before settlement is claimed.

The source-current/reconciliation gap is now represented directly: Knowledge Acquisition records reconciliation readiness for the specific Explorer observation, while Constellation may use source-usable Evidence without treating that observation as structurally incorporated. This prevents an unrelated recomposition from clearing the Reading frontier merely because provider-current data arrived first.

The remaining question is whether the controller's recomposition coalescing and obsolescence behavior preserves the same invariant when completions overlap or race an in-progress derivation.

# Edges:

Keep the previously accepted trustworthy Constellation visible while incorporation runs. Settlement is not a loading gate.

A structural completion that becomes obsolete because the Nodus run or admitted active-sibling obligation changed must not delay or mutate the replacement current view.

Multiple completions may be incorporated by one recomposition when they are all visible to that derivation. If another structural result completes while that recomposition is running, settlement must remain open until a later accepted derivation incorporates it too.

An unchanged recomposition may discharge an obligation without requiring a redundant presentation publication, provided the accepted derivation did observe the completed result.

Supplementary completions remain outside structural settlement even though they may still trigger broad current-view recomputation.

Terminally unavailable structural Reading attempts are tracked separately in `2026-10-04-structural-reading-unavailability.md`; their semantics do not block proving incorporation ordering for successful completions.

# Complete:

Deterministic tests prove that:

- overlapping same-turn completions may coalesce into one recomposition without an intermediate Settled publication;
- a completion arriving during recomposition forces another incorporation pass or otherwise remains outstanding;
- an accepted unchanged composition can discharge an observed structural result without redundant UI publication;
- obsolete structural completions cannot settle or mutate a replacement run/sibling;
- supplementary completions remain irrelevant to settlement.

There is no state in which Weather reports Settled while a completed relevant structural result is still waiting to be incorporated.

# Sync:

After any implementation or verification step that changes what remains, and before ending an implementation pass, synchronize this entry. Also synchronize when an action completes or becomes unavailable, a blocking condition changes, or a judgment is settled. Rewrite around the factual work and verification still open; do not accumulate progress history. If an outcome's completion condition is satisfied, run Backlog Close for that outcome. If Close cannot pass its normal gates, leave the entry open with the blocking condition explicit.
