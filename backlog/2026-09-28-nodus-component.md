# Do:

Make position-centered navigation and playable-board behavior satisfy `docs/components/nodus.md` §Requirements and the currentness rules in `docs/architecture/current-view.md` §Publication boundary: current canonical position, legal-Move Recenter, promotion completion/cancellation, known-target Recenter, URL/history semantics, and stale materialization rejection must have one testable owner of Recenter semantics. The outcome does not require a one-to-one Nodus module if the existing implementation can satisfy that ownership without duplicated truth.

# Because:

`docs/components/nodus.md` §Purpose / §Requirements now owns the current-position/navigation concept independently from Constellation composition and Interface rendering. `docs/architecture/current-view.md` §Publication boundary owns which asynchronous results may become current. The current implementation spreads these responsibilities across controller, renderer, recenter-input, promotion, route/history, and move-materialization seams.

# Edges:

`docs/components/charted-graph.md` §Nodes, §Edges / Resolve Move, and §Growth and retention continue to own canonical graph identity and Move resolution/materialization. `docs/components/interface.md` §Requirements owns two-dimensional board rendering. `docs/components/constellation.md` §Requirements owns which surrounding positions are represented. `docs/components/rail.md` §Requirements allows Rail rows to request Recenter but does not own what Recenter means.

# Unsettled:

Choose the smallest application-facing Nodus interface that centralizes Recenter semantics without moving graph materialization or renderer internals into the component. A new code module is optional unless it is the simplest way to make that ownership testable.

Decide final ownership of the global board-orientation/flip preference: it may remain an Interface-wide presentation concern rather than becoming Nodus state, but `docs/components/interface.md` §Requirements still requires all visible boards to share one orientation.

# Complete:

Deterministic/browser tests cover `docs/components/nodus.md` §Verification and the relevant stale-result rule in `docs/architecture/current-view.md` §Publication boundary: known-target Recenter, legal Move Recenter including a move outside automatic Constellation selection, promotion choices and cancellation, stale materialization rejection, URL round-trip, and browser-history restoration all behave through one testable owner of Recenter semantics while graph identity remains owned by `ChartedGraph`.

# Sync:

After any implementation or verification step that changes what remains, and before ending an implementation pass, synchronize this entry. Also synchronize when an action completes or becomes unavailable, a blocking condition changes, or a judgment is settled. Rewrite around the factual work and verification still open; do not accumulate progress history. If an outcome's completion condition is satisfied, run Backlog Close for that outcome. If Close cannot pass its normal gates, leave the entry open with the blocking condition explicit.
