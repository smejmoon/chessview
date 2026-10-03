# Do:

Finish aligning Explorer, Masters, and LichessEval as cohesive source-observation providers now that cancellation provenance and the Lichess transport boundary are established.

For Explorer, separate source retrieval, source validation, and cache persistence so each stage can apply its own semantics. A valid fresh Reading must remain usable by the current operation when only source-cache persistence fails, with that persistence problem remaining observable through diagnostics or operational status. A malformed or contract-violating response must be treated as a `RejectedObservation`, must not be cached or exposed as usable source data, and must follow Explorer's source-specific fallback policy.

For Masters, remove the request-failure sentinel from the observation channel. Return usable Masters source data or absence, and expose operational failure separately only where a consumer owns a presentation or diagnostic decision that needs it. Add source-facing validation before admitting returned data.

Keep LichessEval's existing separation of usable evaluation/absence from operational status, and align its internal failure semantics only where that improves the common provider boundary without changing source-specific cloud-eval behavior.

Do not introduce a generic `ObservationWell`/provider base class merely to make the three implementations uniform. Reuse implementation machinery only where the providers demonstrate equivalent behavior with the same meaning; after the three providers are aligned, reassess remaining duplication and extract further shared mechanisms only when justified by the resulting code.

Do not settle the name or detailed taxonomy for generic external-source failure in this entry yet. First distinguish the actual cross-boundary decision, if any, after the providers handle source-specific failure and fallback locally.

# Because:

Cancellation provenance is no longer an open design problem for this outcome. `LichessGateway` directly owns the application-wide Lichess transport queue and translates browser abort-shaped request failures into semantic `ObsoleteWork` only when the exact request signal establishes that the request became obsolete. `PositionRepository` likewise emits `ObsoleteWork` for subscriber-lifetime exits it owns. Above those boundaries, code can classify semantic obsolescence without interpreting raw `AbortError` names.

Explorer refresh still spans source acquisition, response validation, and persistence in one recovery scope. These stages have different semantics. A failed cache write after a valid fresh Reading is a local durability problem, not a source-refresh failure; the current operation can still use that Reading. Conversely, a malformed source response was obtained successfully at the transport level but must be rejected as unusable source evidence.

Masters still exposes a request-failure sentinel as though it were returned source data, while LichessEval keeps usable evaluation/absence separate from operational request and failure status. Aligning the three behind the same architectural shape makes retrieval lifecycle a provider responsibility without prematurely forcing one implementation algorithm on sources whose freshness, absence, validation, and fallback semantics differ.

The governing failure-boundary rule is: a failure crosses a boundary only when the receiving layer can make a decision that the originating layer cannot. Otherwise the originating layer handles, translates, reports, or recovers from it locally.

# Edges:

This work defines source-provider and failure/control-flow semantics, not chess evidence. `ObsoleteWork`, `PersistenceFailure`, `RejectedObservation`, freshness state, fallback state, or retrieval issues must not become properties of Explorer Readings, Masters observations, cloud evaluations, Graph Edges, Candidates, or other chess-domain data.

Global Lichess transport scheduling, 429 cooldown, transport urgency, queued cancellation, and platform-abort translation belong to `LichessGateway`. Source providers may supply request parameters, urgency, and an owning `AbortSignal`, but must not recreate transport scheduling or infer cancellation from raw platform error names above the gateway.

The architecture should document the general source-observation-provider shape and ownership boundary, not prescribe exact classes, method names, generic types, or a shared implementation. Explorer, Masters, and LichessEval may remain separate implementations and may differ where their source semantics differ.

`PositionRepository` remains the owner of canonical position records, durable record operations, and shared per-facet producer/subscriber lifetime during this work. Do not change its durable-record contract merely to preserve an unpersisted source observation across unrelated future calls.

Knowledge Acquisition still owns graph reconciliation and persistence of admitted graph knowledge. A `PersistenceFailure` during graph reconciliation may remain fatal to that acquisition operation because successful graph acquisition requires accepted graph updates to persist; the semantic category does not dictate one universal recovery policy.

Cloud-eval authoritative absence, Explorer/Masters zero-data observations, insufficient cloud-eval depth, rejected observations, stale fallback, and source-cache persistence are provider-specific semantics. Comparable provider boundaries do not require those cases to be represented identically internally.

External-source failure terminology beyond `RejectedObservation` remains intentionally open pending the provider implementation and the actual decisions that still need to cross the provider boundary.

# Complete:

Deterministic verification shows all of the following:

- Explorer, Masters, and LichessEval each form a cohesive source-observation-provider boundary: consumers receive usable observation or absence without transport, HTTP, freshness, cache, or request-failure sentinel state embedded in the data;
- provider-specific freshness, validation, successful absence, stale fallback, and source-cache persistence semantics remain correct for each source;
- a valid fresh Explorer observation remains usable by the current operation when only local source-cache persistence fails, while the persistence problem remains observable through diagnostics or operational status;
- malformed or contract-violating Explorer and Masters source data is rejected, is not cached or exposed as usable observation data, and follows the provider's appropriate fallback/absence policy;
- Masters no longer exposes request-failure sentinels as source observations, while any operational failure needed for presentation remains separate from the observation itself;
- genuine external-source failures remain distinguishable from `ObsoleteWork`, `PersistenceFailure`, and `RejectedObservation`, and only failure semantics requiring a decision above the provider boundary propagate there;
- existing semantic `ObsoleteWork` behavior remains intact while the provider refactors are made: normal obsolescence stays quiet and raw abort-shaped failures are not reclassified by higher layers;
- equivalent lifecycle mechanisms are reused where their semantics are genuinely the same, without introducing a speculative generic provider/Well abstraction solely for structural uniformity.

# Sync:

After any implementation or verification step that changes what remains, and
before ending an implementation pass, synchronize this entry. Also synchronize
when an action completes or becomes unavailable, a blocking condition changes,
or a judgment is settled. Rewrite around the factual work and verification
still open; do not accumulate progress history. If
an outcome's completion condition is satisfied, run Backlog Close for that
outcome. If Close cannot pass its normal gates, leave the entry open with the
blocking condition explicit.
