# Do:

Make Weather a faithful presentation of structural settlement/readiness without owning or reconstructing the settlement rules.

A trustworthy provisional Constellation must remain visible and navigable while the active Constellation is Settling. `Updating…` should reflect that domain state; successful settlement should receive the existing brief Ready acknowledgement/check treatment; failure to establish any trustworthy current structure should remain globally degraded.

Keep supplementary Evidence, Rail enrichment, cloud evaluation, Masters retrieval, lookahead, provider activity, and inactive-sibling work from changing Weather merely because they are running or publishing richer values.

The outcome does not require a separate Weather module if the existing presenter/status implementation remains one clear testable owner of presentation semantics.

# Because:

`docs/components/weather.md` now defines Weather as an observer/presenter of the active Constellation's structural settlement, not the owner of that settlement. `docs/glossary.md` defines Settled independently from asynchronous task completion.

The remaining domain mechanics are intentionally tracked elsewhere: `2026-10-04-constellation-structural-obligations.md` owns which work participates in settlement, and `2026-10-04-settlement-incorporation-barrier.md` owns when a completed structural obligation is discharged. Weather should consume their resulting state rather than duplicate either rule.

The current presentation delay/acknowledgement behavior is useful UX machinery, but it must sit downstream of correct structural truth.

# Edges:

Current-view publication and Weather are separate. A trustworthy current structure may publish while Weather says Updating, and supplementary values may publish after Weather is settled.

`LichessEval.subscribe()` remains an operational source-status channel and must not drive Weather directly. Provider activity says nothing about whether the active Constellation has an unresolved structural obligation.

Presentation failure remains distinct from structural settlement failure. If the renderer cannot present a trustworthy view, Weather may degrade for presentation reasons without redefining Constellation settlement.

A material presentation-constraint change may cause same-Nodus Constellation recomposition and therefore make Weather Updating again if that new derivation admits structural obligations. Pure redraw does not.

Do not encode provider names, task keys, controller revision tokens, or generic pending-work counts into the Weather interface.

# Unsettled:

Choose the smallest Weather input/state interface once structural settlement truth is corrected. It should distinguish at least usable-but-settling, settled, and unavailable/degraded without exposing execution bookkeeping.

Keep or adjust the current delay/Ready/check timing only after verifying the resulting UX. Anti-fidgeting may debounce presentation, but it must never display Settled while the supplied structural state is unsettled.

# Complete:

Deterministic/browser tests prove that:

- a trustworthy provisional Constellation remains usable while Weather presents Updating;
- Settled reaches Ready/check without waiting for supplementary work;
- late supplementary Evidence/Rail/engine/Masters/lookahead activity does not reopen Weather;
- inactive-sibling work does not control active Weather;
- a structural obligation admitted after same-Nodus constraint change can make Weather Updating again;
- failure to establish trustworthy current structure presents unavailable/degraded;
- obsolete-run completion cannot change Weather for the replacement view;
- presentation debounce/acknowledgement never creates a false Settled interval.

Weather contains presentation policy only; structural admission and incorporation ordering have no duplicate implementation here.

# Sync:

After any implementation or verification step that changes what remains, and before ending an implementation pass, synchronize this entry. Also synchronize when an action completes or becomes unavailable, a blocking condition changes, or a judgment is settled. Rewrite around the factual work and verification still open; do not accumulate progress history. If the completion condition is satisfied, run Backlog Close. If Close cannot pass its normal gates, leave the entry open with the blocking condition explicit.
