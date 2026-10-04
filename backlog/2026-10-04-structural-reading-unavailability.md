# Do:

Define how a terminally unavailable structural Explorer Reading stops blocking the active Constellation without manufacturing chess Evidence.

A Reading-frontier position may remain structurally relevant even when its current acquisition attempt cannot produce a usable Reading. Current-view coordination needs a way to discharge that attempt for the live Nodus while preserving the semantic fact that rated Reading remains unknown.

# Because:

Structural settlement is now owned by the accepted active Constellation. Its Reading frontier remains the structural latch until recomposition accepts a projection in which the position no longer participates.

A failed Explorer attempt does not itself change Evidence, so recomposing from unchanged facts would admit the same frontier position again. Treating provider failure as negative or empty chess Evidence would make transport state alter chess meaning.

# Edges:

Keep endpoint fallback, cache freshness, and successful-absence versus failure semantics with `docs/components/lichess-access.md` §Cache and failure semantics. Keep cancellation translation and transport/domain-client ownership with `docs/architecture/lichess-gateway.md` §Cancellation translation and §Domain clients. This outcome owns only current-view settlement semantics for an unavailable structural attempt.

Do not make generic task failure structural. Only a Reading already admitted by the active Constellation may reach this path.

An unavailable outcome must be scoped so replacement Nodus runs can try again according to normal source policy. It must not become durable graph or Evidence state merely to suppress reacquisition.

`2026-10-04-settlement-incorporation-barrier.md` separately verifies successful-completion incorporation races. This outcome need not invent a generic incorporation epoch mechanism unless the unavailable case proves one necessary.

# Unsettled:

Choose the smallest representation for a discharged unavailable attempt. A run-local set keyed by the admitted Reading position is preferable if it can prevent immediate re-admission without leaking provider semantics into Constellation.

Classify terminal-for-this-run versus retryable outcomes from the source contracts above, not from UI strings: preserve Lichess transport cancellation/cooldown behavior and endpoint-client fallback/absence semantics while deciding only whether the live structural obligation can still make progress.

# Complete:

Deterministic tests prove that:

- a failed supplementary task does not affect structural settlement;
- an unavailable structural Reading attempt can stop blocking the active Constellation for the current run;
- rated Reading Evidence remains unknown rather than becoming zero, negative, or synthetic;
- the unavailable marker is not persisted as graph or Evidence truth;
- a replacement Nodus run is free to acquire the Reading again under normal source policy;
- obsolete failures cannot discharge an obligation in a replacement run.

# Sync:

After any implementation or verification step that changes what remains, and before ending an implementation pass, synchronize this entry. Also synchronize when an action completes or becomes unavailable, a blocking condition changes, or a judgment is settled. Rewrite around the factual work and verification still open; do not accumulate progress history. If an outcome's completion condition is satisfied, run Backlog Close for that outcome. If Close cannot pass its normal gates, leave the entry open with the blocking condition explicit.
