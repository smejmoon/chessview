# Do:

Make sibling Root/Line projection work respect the active presentation mode without returning to mode-as-generation identity. Keep both projections inside one Nodus-centered generation, but schedule scarce acquisition by foreground demand rather than treating Root and Line as equally urgent jobs.

Foreground acquisition needed by the active projection must take precedence over speculative/background acquisition. Lines may still begin or continue useful background enrichment because Line exploration is expected to be valuable even when Roots is currently displayed, but that work must yield queued Lichess capacity to foreground Root or Line needs. Reuse any already-available sibling projection without recomputing solely because mode changed.

# Because:

`docs/architecture/current-view.md` defines Root and Line as sibling projections of one Nodus-centered generation and makes mode selection presentation-only. `NodusController` owns that generation and RouteLedger restoration lifecycle; mode changes must not become replacement generations or restore navigation glue in `src/main.ts`.

The current controller eagerly starts both sibling projections at generation start, while `composeNodusStructure()` can trigger acquisition from either projection. Root composition can run transposition enrichment and Explorer-backed candidate hydration; Line composition can acquire Explorer Readings and continue selected-Line discovery. Because Lichess traffic is serialized through the shared gateway, the important scarce resource is queued remote acquisition, not projection identity itself.

Lines are the expensive and strategically valuable projection, so making all inactive-Line work fully lazy would discard useful warming. The narrower rule is that acquisition demanded by whatever the user is currently viewing is foreground, while useful Line enrichment may proceed opportunistically in the background when it does not delay foreground work.

# Edges:

`docs/architecture/current-view.md` owns generation/currentness and sibling projection reuse. This outcome changes scheduling only; it must not move navigation semantics back into `src/main.ts`, reintroduce mode-specific current-view identity, duplicate Rail truth, or create a second projection-completion/currentness protocol.

`backlog/2026-09-30-knowledge-enrichment-priority.md` owns the generic `LichessGateway` foreground/background transport mechanism and broader proactive Knowledge Acquisition warming. This outcome owns the current-view demand semantics that classify active-projection acquisition as foreground and inactive speculative Line enrichment as background. It may use that gateway capability when available, but should not duplicate gateway priority policy inside `NodusController`.

`backlog/2026-10-01-root-local-fallback.md` separately owns a cheap local provisional Root projection while authoritative Root knowledge is pending. That fallback is not required to complete this scheduling correction; scheduling must work correctly whether Roots currently require remote acquisition or can later render provisionally from local predecessor candidates.

`backlog/2026-09-30-explorer-reading-projection.md` owns Explorer Reading reconciliation identity/order and idempotency. This outcome must not work around repeated projection by adding controller-local source freshness semantics.

Constellation geometry and zoom may cause projection recomposition, but they do not decide transport urgency. Foreground/background classification follows current-view demand, not board count or presentation geometry.

# Unsettled:

Choose the smallest boundary that lets current-view work express foreground versus background acquisition without coupling `NodusController` to Lichess endpoint details or duplicating `LichessGateway` scheduling semantics.

Settle how much inactive Line work should be allowed to start before the active projection settles. Prefer continued useful Line warming when it is cheap to nominate, but do not require a richer scheduler or bounded-work abstraction here if generic gateway priority is sufficient to prevent it delaying foreground acquisition.

# Complete:

Deterministic coverage proves that acquisition required by the active Root/Line projection receives foreground precedence over queued speculative sibling work; useful Line enrichment may remain queued or continue in the background without delaying the next foreground request; mode switching stays within the same Nodus generation and reuses an already-ready sibling without recomputation solely because it became active; and Recenter still invalidates both sibling projections together.

The result preserves current-view stale-result rejection, Nodus-level Rail stability, RouteLedger restoration ownership, selected-Line discovery semantics, shared Lichess one-request-at-a-time/cooldown constraints, and source-client freshness ownership without inventing controller-local transport policy or depending on the local Root fallback outcome.

# Sync:

After any implementation or verification step that changes what remains, and before ending an implementation pass, synchronize this entry. Also synchronize when an action completes or becomes unavailable, a blocking condition changes, or a judgment is settled. Rewrite around the factual work and verification still open; do not accumulate progress history. If an outcome's completion condition is satisfied, run Backlog Close for that outcome. If Close cannot pass its normal gates, leave the entry open with the blocking condition explicit.
