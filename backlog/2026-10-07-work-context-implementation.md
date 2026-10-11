# Do:

Verify the work-demand and terminal-429 implementation on the current task-branch tip using the repository's deterministic tests, TypeScript typecheck, and static build. Resolve any failures that these checks reveal before closing this outcome.

# Blocked:

Exact-tip verification is not yet established. The connected GitHub run lookup returned no workflow runs or statuses for the current task-branch tip; no deterministic test, typecheck, or build has been executed in this session.

# Because:

The source boundary now separates generic signal/urgency work demand from browser `RequestInit` through `PositionRepository`, Explorer, Masters, cloud evaluation, `LichessSession`, and `LichessGateway`. The transport queue remains gateway-owned, with live foreground/background ordering, queued cancellation, exact-signal abort translation, and shared post-429 cooldown. `LichessGateway` alone owns raw 429 cooldown. Lichess-backed source clients translate exhausted requests into their own semantic outcomes; Explorer and sampled-game Root discovery expose source unavailability without leaking HTTP status into refinement coordination. Missing source knowledge remains unknown. Weather derives a nonblocking `Limited data` indication from run-local unavailable structural frontier participants.

The implementation is committed to this branch, but correct execution is not demonstrated by a commit alone.

# Edges:

Preserve independent caller/producer/transport lifetimes and reusable cache values. Do not reopen position-cache lifecycle or introduce another scheduler or retry engine. Preserve zero-argument production factories, established-token 401 invalidation, and the rule that source requests never start OAuth navigation. `RequestInit.priority` remains browser Fetch priority; work urgency is separate. Reject conflicting HTTP and work cancellation signals. Keep raw HTTP status and cooldown state below source-client/provider boundaries unless a receiving layer owns a decision that genuinely depends on them.

The product and architectural behavior is now owned by `docs/architecture/lichess-gateway.md` §Work and HTTP request contract, `docs/components/lichess-access.md` §Network boundary, `docs/architecture/current-view.md` §Refinement run, and `docs/components/weather.md` §Requirements.

# Complete:

The task-branch tip has successful exact-tip CI with passing tests, typecheck, and build; reviewed regression coverage demonstrates live urgency promotion/demotion, cancellation, 429 without same-run retry, and limited-data presentation without persisting absence. No contradictions remain between implementation and durable contracts.

# Sync:

Use backlog-tend for routine synchronization.
