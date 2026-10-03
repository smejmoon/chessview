# Do:

Verify the aligned Explorer, Masters, and LichessEval source-observation boundaries and the Rail consumer behavior that now depends on them.

Explorer now separates source retrieval/validation from local cache persistence: an admitted fresh Reading remains usable when only persistence fails, while rejected source data still follows Explorer fallback policy. Masters now validates observations, returns usable data or absence rather than request-failure sentinels, uses valid stale fallback when appropriate, and keeps persistence failure from invalidating admitted fresh data.

Verify malformed Explorer and Masters responses, stale fallback, persistence failure, semantic `ObsoleteWork`, and genuine source failure deterministically. Verify that Rail inventory is published from usable rated Explorer data plus graph knowledge without waiting for cloud evaluation or Masters; supplementary engine and Masters evidence must refine already-usable Rail rows independently and must not suppress the inventory when delayed, absent, rate-limited, or failed.

Keep LichessEval's existing separation of usable evaluation/absence from operational status, changing it only if verification exposes a concrete semantic mismatch.

Do not introduce a generic `ObservationWell`/provider base class merely to make the three implementations uniform. Reuse implementation machinery only where the providers demonstrate equivalent behavior with the same meaning.

# Because:

Cancellation provenance is established below the providers. `LichessGateway` owns the application-wide Lichess transport queue and translates browser abort-shaped request failures into semantic `ObsoleteWork` only when the exact request signal establishes obsolescence. `PositionRepository` likewise emits `ObsoleteWork` for subscriber-lifetime exits it owns. Higher layers therefore classify semantic obsolescence without interpreting raw `AbortError` names.

Source acquisition, source validation, and cache persistence have different semantics. Failure to persist an already admitted observation is a local durability problem, while malformed source data is unusable evidence and must never be cached or exposed as an observation.

The provider boundary also implies a consumer rule: one usable source must not be held hostage by unrelated supplementary sources. The Rail's Source Line inventory is established by the rated Explorer observation and known graph relationships; cloud evaluation and Masters contribute supplementary evidence to those rows. Shared Lichess transport serialization and 429 cooldown may delay those supplementary providers, but that transport delay must not turn an already available Rail inventory into a loading state.

The governing failure-boundary rule remains: a failure crosses a boundary only when the receiving layer can make a decision that the originating layer cannot. Otherwise the originating layer handles, translates, reports, or recovers from it locally.

# Edges:

This work defines source-provider, consumer hydration, and failure/control-flow semantics, not chess evidence. `ObsoleteWork`, `PersistenceFailure`, `RejectedObservation`, freshness state, fallback state, retrieval issues, and supplementary-source loading state must not become properties of Explorer Readings, Masters observations, cloud evaluations, Graph Edges, Candidates, or other chess-domain data.

Global Lichess transport scheduling, 429 cooldown, transport urgency, queued cancellation, and platform-abort translation belong to `LichessGateway`. Source providers may supply request parameters, urgency, and an owning `AbortSignal`, but must not recreate transport scheduling or infer cancellation from raw platform error names above the gateway.

The architecture documents the general source-observation-provider shape and ownership boundary without prescribing exact classes, method names, generic types, or a shared implementation. Explorer, Masters, and LichessEval remain separate implementations where their source semantics differ.

`PositionRepository` remains the owner of canonical position records, durable record operations, and shared per-facet producer/subscriber lifetime. Do not change its durable-record contract merely to preserve an unpersisted source observation across unrelated future calls.

Knowledge Acquisition still owns graph reconciliation and persistence of admitted graph knowledge. A persistence failure during graph reconciliation may remain fatal to that acquisition operation because successful graph acquisition requires accepted graph updates to persist; the semantic category does not dictate one universal recovery policy.

Cloud-eval authoritative absence, Explorer/Masters zero-data observations, insufficient cloud-eval depth, rejected observations, stale fallback, and source-cache persistence are provider-specific semantics. Comparable provider boundaries do not require those cases to be represented identically internally.

# Complete:

Deterministic verification shows all of the following:

- Explorer, Masters, and LichessEval each form a cohesive source-observation-provider boundary: consumers receive usable observation or absence without transport, HTTP, freshness, cache, or request-failure sentinel state embedded in the data;
- provider-specific freshness, validation, successful absence, stale fallback, and source-cache persistence semantics remain correct for each source;
- a valid fresh Explorer or Masters observation remains usable by the current operation when only local source-cache persistence fails, while the persistence problem remains observable through diagnostics or operational status;
- malformed or contract-violating Explorer and Masters source data is rejected, is not cached or exposed as usable observation data, and follows the provider's appropriate fallback/absence policy;
- Masters no longer exposes request-failure sentinels as source observations, and no presentation path depends on such a sentinel;
- Rail Source Lines and counts become usable as soon as rated Explorer plus graph inventory is available, without waiting for cloud evaluation or Masters;
- delayed, absent, rate-limited, or failed supplementary engine/Masters evidence leaves established Rail inventory usable, while later usable evidence can refine the same rows;
- genuine external-source failures remain distinguishable from `ObsoleteWork`, persistence failure, and rejected observations, and only failure semantics requiring a decision above the provider boundary propagate there;
- existing semantic `ObsoleteWork` behavior remains intact: normal obsolescence stays quiet and raw abort-shaped failures are not reclassified by higher layers;
- equivalent lifecycle mechanisms are reused only where their semantics are genuinely the same, without introducing a speculative generic provider/Well abstraction solely for structural uniformity.

# Sync:

After any implementation or verification step that changes what remains, and
before ending an implementation pass, synchronize this entry. Also synchronize
when an action completes or becomes unavailable, a blocking condition changes,
or a judgment is settled. Rewrite around the factual work and verification
still open; do not accumulate progress history. If
an outcome's completion condition is satisfied, run Backlog Close for that
outcome. If Close cannot pass its normal gates, leave the entry open with the
blocking condition explicit.
