# Do:

Keep current-Nodus refinement participation live when structure or active mode changes, instead of freezing the first demand metadata attached to a stable task key.

A source operation may keep one stable producer identity, but the current run's participation in that producer must reflect the latest modes, structural provenance, and foreground/background relevance. Recomposition or sibling selection must be able to promote, demote, add, or remove participation without manufacturing duplicate provider work.

# Because:

`src/nodus-controller.ts` deduplicates refinements with a run-long `refinementKeys` set: once a key has been seen, later planners cannot replace the task record for that key.

`src/main.ts` computes provider priority through a live callback, but that callback closes over the `NodusRefinementTarget` captured when the task was first created. If recomposition changes which sibling uses the position, or whether the target is still relevant, the provider sees the live active mode against stale participation metadata.

The result is stable producer identity accidentally freezing current-view demand.

# Edges:

Producer identity and participant demand are different lifetimes. Reuse one provider/source producer for a position/facet where appropriate, while allowing current-view participants to change their urgency or disappear.

Mode switching inside one Nodus run should be enough to change foreground/background participation when the target belongs to only one sibling. It must not require duplicate tasks or a replacement Nodus run.

Recomposition may change `modes` and, after `2026-10-04-constellation-structural-obligations.md`, structural provenance. A stable key must not make the first plan permanently authoritative.

This outcome does not define structural settlement or the provider's queue implementation. It only ensures the execution layer receives current participation metadata.

# Unsettled:

Choose the smallest run-local representation for live participation. A keyed mutable participant record or replaceable participation handle is preferable to repeatedly starting equivalent tasks.

Decide how removal of the last current-view participant interacts with reusable producer lifetime. Follow the existing PositionRepository/source contract: participant relevance may end while reusable producer/cache policy remains independently owned.

# Complete:

Deterministic tests prove that:

- switching Root/Line mode updates provider urgency for a shared position without starting duplicate source work;
- recomposition that adds a mode to an existing target updates that target's participation;
- recomposition that removes the active mode can demote or detach current-view participation as appropriate;
- later structural provenance is not ignored merely because the same provider key was planned earlier as supplementary;
- obsolete/replacement runs cannot mutate the new run's participation;
- stable producer identity remains reusable while current-view demand stays live.

No run-long first-seen task record is the sole source of current priority/relevance truth.

# Sync:

After any implementation or verification step that changes what remains, and before ending an implementation pass, synchronize this entry. Also synchronize when an action completes or becomes unavailable, a blocking condition changes, or a judgment is settled. Rewrite around the factual work and verification still open; do not accumulate progress history. If the completion condition is satisfied, run Backlog Close. If Close cannot pass its normal gates, leave the entry open with the blocking condition explicit.
