# Do:

Ensure structural settlement cannot be claimed until every completed structural result relevant to the active Constellation has been incorporated into an accepted recomposition.

A structural obligation has three materially different phases: unresolved work, completed result waiting for incorporation, and incorporated/discharged. Weather may become Settled only after the active Constellation has crossed that last boundary for every admitted structural obligation still relevant to its current inputs.

Allow practical coalescing of overlapping completions behind one recomposition, but never let coalescing create a transient Ready/Settled publication between completion and incorporation.

# Because:

`docs/glossary.md`, `docs/components/constellation.md`, and `docs/architecture/current-view.md` explicitly require completed relevant structural results to be incorporated before settlement is claimed.

The current controller decrements `refinementPending` when a task finishes, queues settlement afterward, and later derives `settling` again from the remaining pending count. A count of unfinished work cannot represent completed-but-not-yet-incorporated structural results, so the controller has no durable state for the exact condition the domain contract requires.

This is separate from deciding which work is structural. `2026-10-04-constellation-structural-obligations.md` owns structural admission/provenance; this outcome owns discharge and incorporation ordering once a structural obligation exists.

# Edges:

Keep the previously accepted trustworthy Constellation visible while incorporation runs. Settlement is not a loading gate.

A structural completion that becomes obsolete because the Nodus run, active sibling, or admitted obligation changed must not delay or mutate the replacement current view.

Multiple completions may be incorporated by one recomposition when they are all visible to that derivation. If another structural result completes while that recomposition is running, settlement must remain open until a later accepted derivation incorporates it too.

An unchanged recomposition may discharge an obligation without requiring a redundant presentation publication, provided the accepted derivation did in fact observe the completed result.

Supplementary completions are outside this barrier and must not reopen structural settlement.

# Unsettled:

Choose the smallest internal representation for incorporation state. Possibilities include per-obligation completion/incorporation epochs or a run-local structural revision barrier. Do not expose controller revision tokens or task bookkeeping as product state.

Decide how to prove an accepted recomposition observed a completion without coupling Constellation to provider implementation details. Prefer tracking current-view admission/result versions around the derivation boundary rather than passing transport metadata into composition.

# Complete:

Deterministic tests prove that:

- unresolved structural work keeps the active Constellation Settling;
- completing that work does not make it Settled before recomposition incorporates the result;
- overlapping same-turn completions may coalesce into one recomposition without an intermediate Settled publication;
- a completion arriving during recomposition forces another incorporation pass or otherwise remains outstanding;
- an accepted unchanged composition can discharge an observed structural result without redundant UI publication;
- obsolete structural completions cannot settle or mutate a replacement run/sibling;
- supplementary completions remain irrelevant to the barrier.

There is no state in which Weather reports Settled while a completed relevant structural result is still waiting to be incorporated.

# Sync:

After any implementation or verification step that changes what remains, and before ending an implementation pass, synchronize this entry. Also synchronize when an action completes or becomes unavailable, a blocking condition changes, or a judgment is settled. Rewrite around the factual work and verification still open; do not accumulate progress history. If the completion condition is satisfied, run Backlog Close. If Close cannot pass its normal gates, leave the entry open with the blocking condition explicit.
