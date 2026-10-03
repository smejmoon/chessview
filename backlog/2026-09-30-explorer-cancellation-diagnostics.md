# Do:

Separate obsolete work from genuine failures throughout the source-observation paths, using semantic failure categories rather than treating every abort-shaped platform error as cancellation.

Establish and use these conceptual meanings:

- `ObsoleteWork`: intentional control flow for work whose owning demand/lifetime is no longer live. An abort-shaped error only has this meaning when cancellation provenance is known from the relevant Chessview-controlled lifetime/signal.
- `PersistenceFailure`: local persistence could not durably store an otherwise valid result or state transition. If a fresh usable source observation is already available, cache-write failure must not by itself discard that observation.
- `RejectedObservation`: an external response was obtained but is not admitted as usable source data because it violates that source's source-facing contract.

Implement Explorer, Masters, and LichessEval as cohesive source-observation providers with comparable architectural boundaries where their semantics align. Each provider should own the lifecycle needed to expose usable observations from its external source: source-specific retrieval and validation, freshness and fallback policy, cache lifecycle, and local handling/reporting of retrieval failures. Consumers should receive usable source data or absence, plus only exceptional outcomes for which the consumer owns a meaningful decision.

Do not introduce a generic `ObservationWell`/provider base class merely to make the three implementations uniform. Keep the common provider shape in architecture documentation rather than encoding speculative sameness in a class hierarchy or mandatory generic interface. Reuse existing or extracted implementation primitives only where the providers demonstrate equivalent behavior with the same meaning; after the three providers are aligned, reassess remaining duplication and extract further shared mechanisms only when justified by the resulting code.

Where the current implementations leak retrieval lifecycle into consumers, remove that leakage. In particular, request-failure sentinels must not masquerade as source observations, freshness/cache metadata must not become observation data, and source-specific HTTP/transport details should remain local unless a receiving layer has a decision that the provider cannot make.

Do not settle the name or detailed taxonomy for generic external-source failure in this entry yet. First distinguish the actual cross-boundary decision, if any, after the providers handle source-specific failure and fallback locally.

# Because:

The previous Explorer cancellation fix correctly stopped normal lifecycle cancellation from being logged as `explorer refresh failed`, but it still identifies cancellation by `error.name === 'AbortError'`. That is not enough: platform/storage APIs can also produce abort-shaped errors for genuine failures.

The Explorer refresh path currently spans source acquisition, response validation, and persistence in one recovery scope. These stages have different semantics. A failed cache write after a valid fresh Reading is a local durability problem, not a source-refresh failure; the current operation can still use that Reading. Conversely, a malformed source response was obtained successfully at the transport level but must be rejected as unusable source evidence.

Masters and LichessEval already solve overlapping parts of the same provider problem in different ways. Masters currently exposes a request-failure sentinel as though it were returned source data, while LichessEval keeps usable evaluation/absence separate from operational request and failure status. Aligning the three behind the same architectural shape makes retrieval lifecycle a provider responsibility without prematurely forcing one implementation algorithm on sources whose freshness, absence, validation, and fallback semantics differ.

The same name-only `AbortError` assumption appears in other asynchronous boundaries, so the durable direction is to classify failures at the boundary that knows their provenance and let higher layers reason over Chessview semantic categories.

The governing failure-boundary rule is: a failure crosses a boundary only when the receiving layer can make a decision that the originating layer cannot. Otherwise the originating layer handles, translates, reports, or recovers from it locally.

# Edges:

This work defines source-provider and failure/control-flow semantics, not chess evidence. `ObsoleteWork`, `PersistenceFailure`, `RejectedObservation`, freshness state, fallback state, or retrieval issues must not become properties of Explorer Readings, Masters observations, cloud evaluations, Graph Edges, Candidates, or other chess-domain data.

The architecture should document the general source-observation-provider shape and ownership boundary, not prescribe exact classes, method names, generic types, or a shared implementation. Explorer, Masters, and LichessEval may remain separate implementations and may differ where their source semantics differ.

`PositionRepository` remains the owner of canonical position records and durable record operations during this work. Do not change its durable-record contract merely to preserve an unpersisted source observation across unrelated future calls. If shared-load/subscriber-lifetime behavior proves to be provider infrastructure rather than repository responsibility while aligning the three providers, that ownership may be reconsidered explicitly rather than moved as an incidental refactor.

Knowledge Acquisition still owns graph reconciliation and persistence of admitted graph knowledge. A `PersistenceFailure` during graph reconciliation may remain fatal to that acquisition operation because successful graph acquisition requires accepted graph updates to persist; the semantic category does not dictate one universal recovery policy.

Normal lifecycle cancellation may come from obsolete caller demand, shared-load last-subscriber cleanup, current-view replacement, or expiry of bounded supplementary warm. Those are `ObsoleteWork` only when linked to the owning cancellation signal/lifetime.

Cloud-eval authoritative absence, Explorer/Masters zero-data observations, insufficient cloud-eval depth, rejected observations, stale fallback, and source-cache persistence are provider-specific semantics. Comparable provider boundaries do not require those cases to be represented identically internally.

External-source failure terminology beyond `RejectedObservation` remains intentionally open pending the provider implementation and the actual decisions that still need to cross the provider boundary.

# Complete:

Deterministic verification shows all of the following:

- Explorer, Masters, and LichessEval each form a cohesive source-observation-provider boundary: consumers receive usable observation or absence without transport, HTTP, freshness, cache, or request-failure sentinel state embedded in the data;
- provider-specific freshness, validation, successful absence, stale fallback, and source-cache persistence semantics remain correct for each source;
- equivalent lifecycle mechanisms are reused where their semantics are genuinely the same, without introducing a speculative generic provider/Well abstraction solely for structural uniformity;
- normal cancellation is classified as `ObsoleteWork`, propagates/stops quietly, and does not emit source-failure or stale-fallback diagnostics;
- an abort-shaped error without matching cancellation provenance is not classified as `ObsoleteWork`;
- a valid fresh source observation remains usable by the current operation when only local cache persistence fails, while the `PersistenceFailure` remains observable through diagnostics/operational status;
- malformed or contract-violating source data is treated as `RejectedObservation`, is not cached or exposed as usable source data, and follows that provider's appropriate fallback/absence policy;
- Masters no longer exposes request-failure sentinels as source observations;
- genuine external-source failures remain distinguishable from `ObsoleteWork`, `PersistenceFailure`, and `RejectedObservation`, and only failure semantics requiring a decision above the provider boundary propagate there;
- higher-level control flow no longer relies on `error.name === 'AbortError'` alone to decide that work was obsolete;
- architecture documentation records the general source-observation-provider shape and failure-boundary rule without freezing the implementation into an exact class/interface design.

# Sync:

After any implementation or verification step that changes what remains, and before ending an implementation pass, synchronize this entry. Also synchronize when an action completes or becomes unavailable, a blocking condition changes, or a judgment is settled. Rewrite around the factual work and verification still open; do not accumulate progress history. If an outcome's completion condition is satisfied, run Backlog Close for that outcome. If Close cannot pass its normal gates, leave the entry open with the blocking condition explicit.
