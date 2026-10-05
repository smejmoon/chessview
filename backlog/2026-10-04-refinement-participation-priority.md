# Do:

Replace run-long first-seen refinement keys with live, run-local current-view participation keyed by stable source-work identity.

Reconcile that participation against each newly derived Nodus refinement plan. While a key remains demanded, update its latest modes, structural Reading provenance, and Nodus-wide relevance in place rather than freezing the first task closure. Provider priority must read that live participation together with the current active mode. When demand disappears, detach that current-view participant with its own cancellation lifetime; a later reappearance may participate again without manufacturing a second reusable source producer.

Keep plan demand distinct from execution phase. A demanded participant may be actively working, waiting for a retry gate owned by the boundary that classified the outcome as retryable, satisfied for the run, or terminally unavailable for a structural obligation as defined by `backlog/2026-10-04-structural-reading-unavailability.md`. Replanning must preserve that distinction: an intermediate retry-waiting phase is not final completion, while satisfied work is not replayed merely because the stable key remains in later plans.

A retryable outcome must have a non-busy-loop path to another attempt. The lower boundary may keep the operation pending across its own retry policy, or it may return a semantic retryable outcome together with the eligibility/wakeup condition it owns. Current view may resume the still-current participant when that gate opens, but must not infer retry timing from HTTP status, error strings, or provider internals.

An unavailable attempt that was only supplementary may remain suppressed while demand stays supplementary, but if the same Explorer Reading later becomes Constellation-admitted structural demand, allow structural participation because the earlier supplementary failure did not discharge an obligation that did not yet exist. Structural unavailability and its settlement consequence are owned by `backlog/2026-10-04-structural-reading-unavailability.md`.

# Because:

`src/nodus-controller.ts` currently deduplicates refinements with one run-long `refinementKeys` set. Once a key has been seen, later plans cannot replace its participation metadata, end its current-view participation, distinguish retry-waiting from terminal completion, or distinguish a later structural need from an earlier supplementary attempt.

`src/main.ts` supplies provider priority through a callback, but that callback closes over the `NodusRefinementTarget` captured when the task was first created. The active mode is live while the target's modes and relevance are stale. Stable producer identity therefore accidentally freezes current-view demand.

`PositionRepository` already separates reusable producer lifetime from caller participation: one position/facet producer can have independently cancellable subscribers and derives effective transport urgency from their live priority callbacks. Current view should use that boundary instead of giving one subscriber the whole Nodus-run lifetime.

Long-running coordination also needs an explicit distinction between intermediate and terminal phases. Treating a retryable attempt as final either recreates the permanent-settling bug by suppressing further progress, creates a busy retry loop, or wrongly turns a transient source condition into terminal unavailability.

# Edges:

Producer identity and current-view participation are different lifetimes. `PositionRepository` and each source provider continue to own shared producer/cache lifetime. Current view owns only its participant record and participant cancellation; detaching the last current-view participant may release the producer through the existing repository contract, while another live participant may keep it running.

Mode switching inside one Nodus run changes urgency by reading the current active mode against the participant's latest modes; it does not need a replacement task or run. Recomposition may add or remove modes and structural Reading provenance, so the latest plan replaces participation metadata for a still-live key.

Retry classification does not move source policy upward. Gateway/provider boundaries still own cooldown, source-specific fallback, authentication behavior, and retry timing they can decide locally. If a retryable condition crosses upward, it is semantic current-view input only because current view must decide whether the admitted obligation can still make progress; the originating boundary must also expose or retain the gate that prevents immediate replay.

Preserving Constellation structural provenance beside current-view execution is allowed and required here; it is not provider meaning. Providers receive source participation, cancellation, and transport urgency, not a structural-criticality flag. `backlog/2026-10-04-structural-reading-unavailability.md` owns how a semantic unavailable result may discharge a Reading admitted by a Constellation.

A semantic unavailable result is not the same as an arbitrary thrown error. Lower boundaries must exhaust their own fallback/recovery policy and expose only the outcome current view can act on; current view must not infer source meaning from HTTP status, UI strings, or raw transport exceptions.

# Complete:

Deterministic tests prove that:

- switching Root/Line mode updates provider urgency for a shared position without starting duplicate source work;
- recomposition that adds or removes modes updates the existing participant rather than retaining first-seen metadata;
- recomposition that removes all current-view demand detaches that participant while reusable producer lifetime remains governed by `PositionRepository`;
- a detached participant's late completion cannot mutate current participation or a replacement run;
- a retryable outcome remains an intermediate participant phase, does not mark the key satisfied or unavailable, and becomes eligible for another attempt without immediate busy replay;
- provider/source retry timing remains owned below current view rather than reconstructed from HTTP status or error text;
- a supplementary-unavailable Explorer attempt does not prevent a later Constellation-admitted structural participation for that Reading;
- successful current-run work is not repeatedly reacquired merely because later plans still mention the same stable key;
- obsolete/replacement runs cannot mutate the new run's participation;
- stable producer identity remains reusable while current-view participation changes.

No run-long first-seen task record is the sole source of current priority, relevance, execution phase, or structural provenance truth.

# Sync:

After any implementation or verification step that changes what remains, and before ending an implementation pass, synchronize this entry. Also synchronize when an action completes or becomes unavailable, a blocking condition changes, or a judgment is settled. Rewrite around the factual work and verification still open; do not accumulate progress history. If an outcome's completion condition is satisfied, run Backlog Close for that outcome. If Close cannot pass its normal gates, leave the entry open with the blocking condition explicit.
