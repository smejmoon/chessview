# Do:

Finish deterministic verification of the remaining source-observation providers. Masters needs direct coverage for malformed fresh/cached data, stale fallback, persistence failure, semantic `ObsoleteWork`, and genuine source failure. Confirm LichessEval's existing usable-evaluation/absence versus operational-status separation still matches the common provider boundary; change it only if that verification exposes a concrete semantic mismatch.

Do not introduce a generic `ObservationWell`/provider base class merely to make the three implementations uniform. Reuse implementation machinery only where the providers demonstrate equivalent behavior with the same meaning.

# Because:

Cancellation provenance is established below the providers. `LichessGateway` owns the application-wide Lichess transport queue and translates browser abort-shaped request failures into semantic `ObsoleteWork` only when the exact request signal establishes obsolescence. `PositionRepository` likewise emits `ObsoleteWork` for subscriber-lifetime exits it owns. Higher layers therefore classify semantic obsolescence without interpreting raw `AbortError` names.

Source acquisition, source validation, admitted live observation, cache persistence, graph reconciliation, and consumer publication have different semantics. Failure to persist an already admitted source observation is a local durability problem, while malformed source data is unusable evidence and must never be cached or exposed as an observation. Acquisition participation and passive observation interest are also distinct: `PositionRepository` owns shared producer lifetime, while an interested consumer may use an admitted observation without starting or keeping a request alive.

Rail inventory is assembled from independently usable facts: known graph relationships can publish without Explorer; a usable rated Explorer Reading can add Source Lines without Knowledge Acquisition or graph persistence; cloud evaluation and Masters contribute supplementary evidence independently. Shared Lichess transport serialization and 429 cooldown may delay those sources, but transport or persistence delay must not turn already available inventory into a loading state.

The governing failure-boundary rule remains: a failure crosses a boundary only when the receiving layer can make a decision that the originating layer cannot. Otherwise the originating layer handles, translates, reports, or recovers from it locally.

# Edges:

This work defines source-provider, graph-reconciliation, consumer hydration, and failure/control-flow semantics, not chess evidence. `ObsoleteWork`, `PersistenceFailure`, `RejectedObservation`, freshness state, fallback state, retrieval issues, reconciliation state, and supplementary-source loading state must not become properties of Explorer Readings, Masters observations, cloud evaluations, Graph Edges, Candidates, or other chess-domain data.

Global Lichess transport scheduling, 429 cooldown, transport urgency, queued cancellation, and platform-abort translation belong to `LichessGateway`. Source providers may supply request parameters, urgency, and an owning `AbortSignal`, but must not recreate transport scheduling or infer cancellation from raw platform error names above the gateway.

The architecture documents the general source-observation-provider shape and ownership boundary without prescribing exact classes, method names, generic types, a shared event bus, or a shared implementation. Explorer, Masters, and LichessEval remain separate implementations where their source semantics differ.

`PositionRepository` remains the owner of canonical position records, durable record operations, and shared per-facet producer/subscriber lifetime. Do not change its durable-record contract merely to preserve an unpersisted source observation across unrelated future calls.

Knowledge Acquisition remains the owner of graph reconciliation and persistence of admitted graph knowledge. Its reconciliation operation may remain fatal when successful graph acquisition requires accepted updates to persist; that does not make reconciliation success a prerequisite for another consumer to use the already-admitted source observation. Reconciliation remains retryable and convergent against actual graph state.

Cloud-eval authoritative absence, Explorer/Masters zero-data observations, insufficient cloud-eval depth, rejected observations, stale fallback, source-cache persistence, and live-observation retention are provider-specific semantics. Comparable provider boundaries do not require those cases to be represented identically internally.

# Complete:

Deterministic verification shows all of the following:

- Explorer, Masters, and LichessEval each form a cohesive source-observation-provider boundary: consumers receive usable observation or absence without transport, HTTP, freshness, cache, or request-failure sentinel state embedded in the data;
- provider-specific freshness, validation, successful absence, stale fallback, and source-cache persistence semantics remain correct for each source;
- a valid fresh Explorer or Masters observation remains usable by the current operation when only local source-cache persistence fails, while the persistence problem remains observable through diagnostics or operational status;
- an admitted Explorer Reading is shared across concurrent acquisition participants, may be observed passively by another interested consumer, and remains reusable for its freshness lifetime even when its cache write fails;
- malformed or contract-violating Explorer and Masters source data is rejected, is not cached or exposed as usable observation data, and follows the provider's appropriate fallback/absence policy;
- Masters no longer exposes request-failure sentinels as source observations, and no presentation path depends on such a sentinel;
- known Rail graph inventory becomes usable without waiting for Explorer, and Explorer failure does not suppress already-known Roots or explicit Lines;
- a usable Explorer Reading contributes Source Lines without Knowledge Acquisition, cloud evaluation, Masters, or graph persistence, and the Rail does not initiate graph reconciliation from that Reading;
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
