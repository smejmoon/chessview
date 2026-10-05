# Do:

Make Weather a faithful presentation of structural settlement/readiness without owning or reconstructing the settlement rules, while keeping enough independent measures visible in Debug to diagnose the lifecycle during development.

A trustworthy provisional Constellation must remain visible and navigable while the accepted view is structurally Settling. `Updating…` should reflect the structural state supplied by Current View; successful settlement should receive the existing brief Ready acknowledgement/check treatment; failure to establish any trustworthy current structure should remain globally degraded.

In Debug, present aggregate Weather measures for accepted-structure lifecycle, Settling, Reading-frontier size, current frontier participation phases, detached structural participation, and supplementary active/total participation. Use those measures to verify why the primary state is changing or stuck without turning the diagnostic counts into another settlement definition.

Keep supplementary Evidence, Rail enrichment, cloud evaluation, Masters retrieval, lookahead, provider activity, and other non-structural work from changing the primary Weather state merely because they are running or publishing richer values.

# Because:

`docs/components/weather.md` defines Weather as an observer/presenter of structural readiness, not the owner of that readiness. `docs/glossary.md` defines Settled independently from asynchronous task completion.

A single Ready/Updating presentation is intentionally compact for normal use but hides distinctions that matter while the lifecycle contract is still being developed. Aggregate Debug measures let development distinguish an accepted map with working structural participation from retry waiting, successful completion, terminal unavailability, arbitrary failure, missing participation, or supplementary activity without exporting per-task or source identity.

The current presentation delay/acknowledgement behavior remains useful UX machinery, but it must sit downstream of correct structural truth. Diagnostic visibility is allowed to be noisier than the normal product Weather surface.

# Edges:

Current-view publication and Weather are separate. A trustworthy current structure may publish while Weather says Updating, and supplementary values may publish after Weather is settled.

`LichessEval.subscribe()` remains an operational source-status channel and must not drive primary Weather directly. Provider activity says nothing by itself about whether the accepted Constellation has an unresolved structural obligation.

Presentation failure remains distinct from structural settlement failure. If the renderer cannot present a trustworthy view, Weather may degrade for presentation reasons without redefining Constellation settlement.

A material presentation-constraint change may cause same-Nodus Constellation recomposition and therefore make Weather Updating again if that new derivation admits structural obligations. Pure redraw does not.

Normal Weather must not expose provider names, task keys, canonical-position identities, controller revision tokens, source payloads, or transport state. Debug may show aggregate current-view counts and execution phases because they are measurements, not product meaning or source policy.

`backlog/2026-10-04-structural-reading-unavailability.md` owns the unresolved lifecycle semantics around same-view preservation and when a structurally relevant unknown no longer has an automatic progress path. Weather diagnostics should make those states inspectable rather than deciding that outcome here.

# Unsettled:

Choose the smallest primary Weather input/state interface once the Current View lifecycle decision is settled. It should distinguish at least usable-but-settling, settled, and unavailable/degraded without requiring the Debug measures to become product states.

Keep or adjust the current delay/Ready/check timing only after verifying the resulting UX. Anti-fidgeting may debounce presentation, but it must never display Settled while the supplied structural state is unsettled.

Decide after the lifecycle work stabilizes which diagnostic measures remain useful enough to keep in Debug; normal Weather should stay compact regardless.

# Complete:

Deterministic/browser tests prove that:

- a trustworthy provisional Constellation remains usable while primary Weather presents Updating;
- Settled reaches Ready/check without waiting for supplementary work;
- late supplementary Evidence/Rail/engine/Masters/lookahead activity does not reopen primary Weather;
- a structural obligation admitted after same-Nodus constraint change can make Weather Updating again;
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
