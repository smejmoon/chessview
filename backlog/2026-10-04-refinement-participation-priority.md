# Do:

Finish the exceptional refinement-participation semantics now that ordinary live participation and structural unavailability are separated cleanly.

Keep current-view participation live and run-local: stable source-work identity may be reused while the participant's latest modes, structural Reading provenance, Nodus-wide relevance, cancellation lifetime, retry gate, and execution phase remain replaceable current-view coordination state.

Resolve the two remaining structural coordination anomalies without reclassifying either as source unavailability:

- a structurally tagged participant that ends in `failed` after a raw task/reconciliation failure;
- a Constellation-frontier Reading with no matching current participant (`unplanned`).

Decide how each state repairs or terminates, and therefore whether either should continue to block primary Weather. Preserve the existing rule that only lower-owned semantic unavailability discharges an unavailable source attempt and that successful structural work blocks only while Current View has a settlement recomposition pending.

# Because:

`CurrentViewController` now reconciles live keyed participants against each newly derived plan, updates priority from current relevance, detaches obsolete participation, preserves retry-waiting separately from terminal phases, and keeps successful execution distinct from incorporation-pending settlement work.

That removes the earlier first-seen-task problem, but arbitrary participant failure and missing participation still represent coordination uncertainty rather than a source conclusion. Treating either as semantic unavailability would hide a planning/reconciliation defect and could make Weather claim readiness without a justified lifecycle resolution. Treating either as permanently active progress would instead recreate a stuck Updating state with no automatic progress witness.

`PositionRepository` already separates reusable producer lifetime from caller participation, so repairing these exceptional current-view states does not require manufacturing duplicate source work or moving provider lifetime into Current View.

# Edges:

Producer identity and current-view participation are different lifetimes. `PositionRepository` and each source provider continue to own shared producer/cache lifetime. Current View owns only its participant record and participant cancellation; detaching the last current-view participant may release the producer through the existing repository contract, while another live participant may keep it running.

Mode switching inside one Nodus run changes urgency by reading the current active mode against the participant's latest modes; it does not need a replacement source producer. Recomposition may add or remove modes and structural Reading provenance, so the latest plan replaces participation metadata for a still-live key.

Retry classification does not move source policy upward. Gateway/provider boundaries still own cooldown, source-specific fallback, authentication behavior, and retry timing they can decide locally. If a retryable condition crosses upward, the originating boundary must also expose or retain the gate that prevents immediate replay.

The durable structural-readiness rule lives in `docs/architecture/current-view.md` §Settlement coordination and `docs/components/weather.md`. Semantic unavailable acquisition may stop the matching run-local structural obligation from blocking while the chess fact remains unknown; a later run may try again. A satisfied structural participant blocks only while its successful result is incorporation-pending.

Preserving Constellation structural provenance beside current-view execution is allowed and required here; it is not provider meaning. Providers receive source participation, cancellation, and transport urgency, not a structural-criticality flag.

A semantic unavailable result is not the same as an arbitrary thrown error. Current View must not infer source meaning from HTTP status, UI strings, raw transport exceptions, or the mere absence of a planned participant.

# Unsettled:

- When a structurally relevant participant fails outside the semantic source-outcome path, what automatic repair or replacement path, if any, keeps it legitimately Settling? If there is none, what non-source lifecycle state should Weather present?
- When an accepted Reading frontier has no matching current participant, should Current View immediately replan, fail the refinement coordination, or expose another explicit terminal coordination state rather than leaving `unplanned` indefinitely blocking?
- Which invariant should make these anomalies impossible in the ordinary planner so Debug counts act as fault signals rather than routine lifecycle states?

# Complete:

Deterministic tests prove that:

- switching Root/Line mode updates provider urgency for shared source work without starting duplicate producer work;
- recomposition that adds or removes modes updates existing participation rather than retaining first-seen metadata;
- recomposition that removes all current-view demand detaches that participant while reusable producer lifetime remains governed by `PositionRepository`;
- a detached participant's late completion cannot mutate current participation or a replacement run;
- a retryable outcome remains an intermediate participant phase and becomes eligible for another attempt without immediate busy replay;
- provider/source retry timing remains owned below Current View rather than reconstructed from HTTP status or error text;
- supplementary-unavailable Explorer participation does not prevent a later Constellation-admitted structural attempt for that Reading;
- successful current-run work is not repeatedly reacquired merely because later plans still mention the same stable key;
- successful structural execution blocks settlement only while its incorporation-pending witness exists;
- `failed` structural participation reaches an explicit repair or terminal coordination result instead of masquerading as semantic source unavailability or permanent automatic progress;
- `unplanned` frontier demand reaches an explicit replan/repair or terminal coordination result instead of remaining an unexplained permanent blocker;
- obsolete/replacement runs cannot mutate the new run's participation;
- stable producer identity remains reusable while current-view participation changes.

No run-long first-seen task record, arbitrary failure, or missing participant is the sole unexamined source of current priority, relevance, execution phase, structural provenance, or readiness truth.

# Sync:

After any implementation or verification step that changes what remains, and before ending an implementation pass, synchronize this entry. Also synchronize when an action completes or becomes unavailable, a blocking condition changes, or a judgment is settled. Rewrite around the factual work and verification still open; do not accumulate progress history. If
an outcome's completion condition is satisfied, run Backlog Close for that
outcome. If Close cannot pass its normal gates, leave the entry open with the
blocking condition explicit.
