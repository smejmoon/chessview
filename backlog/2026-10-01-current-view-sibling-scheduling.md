# Do:

Make sibling Root/Line projection work respect the active presentation mode without returning to mode-as-generation identity. Keep both projections inside one Nodus-centered generation, but ensure work for the active projection is not delayed by speculative work for the inactive sibling.

Prefer the smallest scheduling rule that preserves instant reuse when an inactive sibling is already available while avoiding unnecessary acquisition for a sibling the user may never open. Switching mode should select the sibling projection if ready, or start/continue that sibling inside the same Nodus generation if it is not.

# Because:

`docs/architecture/current-view.md` defines Root and Line as sibling projections of one Nodus-centered generation and makes mode selection presentation-only. `NodusController` now owns the complete navigation/current-view lifecycle, including RouteLedger restoration subscription and cleanup; `src/main.ts` no longer contains a separate browser-history-to-controller navigation seam. The current controller still eagerly starts both projections at generation start. Each projection can trigger nontrivial acquisition: Line composition may acquire Explorer Readings and selected-Line discovery, while Root composition may run transposition enrichment and source hydration.

Because Lichess traffic is serialized through the shared gateway, eager inactive-mode work can consume request capacity before information needed by the mode the user is actually viewing. The ownership correction that removed mode-switch recomposition and startup-level history wiring should not introduce a new responsiveness cost by treating both sibling projections as equally urgent.

# Edges:

`docs/architecture/current-view.md` owns generation/currentness and the fact that mode switching does not replace the Nodus generation. `NodusController` owns RouteLedger restoration as part of that same lifecycle. This outcome changes scheduling/laziness only; it must not move navigation semantics back into `src/main.ts`, reintroduce mode-specific current-view identity, or duplicate Rail truth.

`backlog/2026-09-30-knowledge-enrichment-priority.md` separately owns generic LichessGateway foreground/background transport priority and proactive Knowledge Acquisition warming. Sibling-projection scheduling may later use that capability, but it can complete independently through lazy or demand-driven sibling startup and therefore remains a separate outcome.

`backlog/2026-09-30-explorer-reading-projection.md` owns Explorer Reading reconciliation identity/order and idempotency. This outcome must not work around repeated projection by adding controller-local source freshness semantics.

Constellation presentation geometry and zoom may cause projection recomposition, but they do not decide whether an inactive Root/Line sibling deserves acquisition priority.

# Unsettled:

Choose whether the inactive sibling should be fully lazy until first selected, opportunistically composed only from already-available knowledge, or allowed bounded background acquisition after the active projection settles. Avoid a scheduling abstraction richer than these observed needs require.

Decide what should happen when the user switches mode while the newly active sibling has not started or is still incomplete: continue/start it within the existing generation while preserving any already-published sibling and Nodus-level Rail state.

# Complete:

Deterministic coverage proves that starting a Nodus does not let inactive-sibling acquisition delay the active Root/Line projection; mode switching does not create a new Nodus generation or recompute an already-ready sibling solely because it became active; a not-yet-ready sibling can start or continue when selected; and Recenter still invalidates both siblings together.

The result preserves current-view stale-result rejection, Nodus-level Rail stability, RouteLedger restoration ownership, selected-Line discovery semantics, and shared Lichess transport constraints without inventing a second source-freshness or projection-completion protocol or restoring navigation glue in `src/main.ts`.

# Sync:

After any implementation or verification step that changes what remains, and before ending an implementation pass, synchronize this entry. Also synchronize when an action completes or becomes unavailable, a blocking condition changes, or a judgment is settled. Rewrite around the factual work and verification still open; do not accumulate progress history. If an outcome's completion condition is satisfied, run Backlog Close for that outcome. If Close cannot pass its normal gates, leave the entry open with the blocking condition explicit.
