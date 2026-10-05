# Do:

Finish Weather as the compact presentation of structural readiness now that Current View owns the lifecycle rule.

Keep the normal surface limited to the established Updating / Ready / settled-check / unavailable presentation, downstream of Current View's supplied structural state. Keep Debug useful during development by exposing the independent aggregate measures that explain that state, including incorporation-pending separately from the participant's satisfied execution phase.

Verify the presentation timing against the settled lifecycle: same-projection refinement may leave a trustworthy Constellation interactive while Updating, a new spatial projection may be establishing while Nodus-scoped Rail remains usable, supplementary activity must not reopen Weather, and successful structural work must stop blocking after its settlement recomposition has been drained.

# Because:

[Current View](../docs/architecture/current-view.md) now owns the durable lifecycle distinctions. A spatial projection is accepted for one Nodus plus Root/Line mode; refresh and same-projection recomposition can preserve it, while Nodus or mode changes establish different spatial structure. Structural readiness follows live work, retry gates, and successful work still awaiting incorporation rather than Reading-frontier membership alone.

The primary Weather surface is intentionally compact. Debug diagnostics preserve development visibility without turning task counts into product meaning: accepted structure lifecycle, Settling, frontier size, structural execution phases, incorporation-pending, detached participation, and supplementary participation can be inspected independently.

The existing presentation delay/acknowledgement behavior remains useful UX machinery, but it must sit downstream of correct structural truth.

# Edges:

Current-view publication and Weather are separate. A trustworthy current projection may publish while Weather says Updating, and supplementary values may publish after Weather is settled.

`LichessEval.subscribe()` remains an operational source-status channel and must not drive primary Weather directly. Provider activity says nothing by itself about structural readiness.

Presentation failure remains distinct from structural settlement failure. If the renderer cannot present a trustworthy view, Weather may degrade for presentation reasons without redefining Current View settlement.

A material presentation-constraint change may recompose the same projection and therefore make Weather Updating again if that derivation admits structural obligations. Pure redraw does not.

Normal Weather must not expose provider names, task keys, canonical-position identities, controller revision tokens, source payloads, or transport state. Debug may show aggregate current-view counts and execution phases because they are measurements, not product meaning or source policy.

`failed` and `unplanned` structural participation remain owned by the refinement-participation/planning outcome. Weather diagnostics expose them, but this outcome does not decide their coordination semantics.

# Unsettled:

Choose the smallest primary Weather input/state interface now that the lifecycle contract is durable. It should distinguish usable-but-settling, settled, and unavailable/degraded without requiring the Debug measures to become product states.

Keep or adjust the current delay/Ready/check timing only after browser verification. Anti-fidgeting may debounce presentation, but it must never display Settled while the supplied structural state is unsettled.

Decide after the lifecycle work stabilizes which Debug measures remain useful enough to keep long-term; normal Weather should stay compact regardless.

# Complete:

Deterministic/browser tests prove that:

- a trustworthy accepted Constellation remains usable while primary Weather presents Updating for same-projection structural progress;
- Settled reaches Ready/check without waiting for supplementary work;
- late supplementary Evidence/Rail/engine/Masters/lookahead activity does not reopen primary Weather;
- a structural obligation admitted after same-projection constraint change can make Weather Updating again;
- a successful structural result blocks while incorporation is pending but not merely because its satisfied phase remains after the settlement drain;
- new Nodus/mode spatial establishment cannot present the old Constellation as current structure;
- failure to establish trustworthy current structure presents unavailable/degraded;
- obsolete-run completion cannot change Weather for the replacement view;
- presentation debounce/acknowledgement never creates a false Settled interval;
- Debug exposes the agreed aggregate Weather measures without task, position, provider, revision, payload, or transport identity;
- disabling Debug removes the diagnostic readout without changing the primary Weather state.

Weather contains presentation policy and diagnostics only; structural admission, source failure meaning, and incorporation ordering have no duplicate authority here.

# Sync:

After any implementation or verification step that changes what remains, and before ending an implementation pass, synchronize this entry. Also synchronize when an action completes or becomes unavailable, a blocking condition changes, or a judgment is settled. Rewrite around the factual work and verification still open; do not accumulate progress history. If
an outcome's completion condition is satisfied, run Backlog Close for that
outcome. If Close cannot pass its normal gates, leave the entry open with the
blocking condition explicit.
