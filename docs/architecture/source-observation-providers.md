# Source observation providers

## Purpose

Define the common architectural shape for components that expose usable observations from external sources without prescribing one shared implementation.

Current examples include rated Explorer, Masters, and Lichess cloud evaluation. Their source contracts differ, but they should present comparable boundaries wherever their semantics align.

## Boundary

A source observation provider owns the lifecycle required to expose usable observations from one external source.

It keeps retrieval mechanics, source-specific validation, freshness, fallback, cache lifecycle, and operational failure detail behind its boundary. Consumers receive usable source data or absence, plus only those exceptional outcomes for which the consumer owns a meaningful decision.

The provider decides whether an observation can be satisfied from already available data or whether source retrieval is needed. It also decides whether an older usable observation may remain available when refresh does not produce a replacement. Those decisions are source-specific policy even when different providers follow similar lifecycle shapes.

Successful source data remains distinct from the operational path used to obtain or retain it. Retrieval status, HTTP outcomes, cache age, persistence issues, and fallback state do not become fields of the observation merely so consumers can inspect provider mechanics.

A provider may expose operational activity or issues separately when those are useful for diagnostics or presentation. Operational reporting must not alter the meaning of the returned observation.

## Failure boundary

Source-specific failures remain local when the provider owns the policy needed to recover, fall back, reject source data, update authentication state, report an operational issue, or otherwise decide the provider outcome.

Failures cross the provider boundary only according to [Failure boundaries](failure-boundaries.md): the receiving layer must own a meaningful decision the provider cannot make itself. This keeps transport, storage, and provider-specific error taxonomies from leaking into consumers.

`ObsoleteWork`, `PersistenceFailure`, and `RejectedObservation` are semantic concepts, not required public exception types for every provider operation. A provider may handle them locally when it owns the relevant decision. For example, rejecting malformed source data may lead to stale fallback rather than propagation, and failure to persist a fresh usable observation may still allow that observation to be returned.

## Source-specific ownership

Each provider retains ownership of the semantics peculiar to its source, including what constitutes a usable observation, what constitutes authoritative absence when the source supports it, when stored data is fresh enough to use without refresh, and when stale data remains an acceptable fallback.

The common architecture does not require identical cache representation, freshness rules, absence semantics, validation depth, or operational status across providers.

## Reuse

Comparable provider boundaries do not imply a required common base class, generic provider object, policy interface, or shared state machine in code.

Implement providers as cohesive components first. Reuse smaller mechanisms where equivalent behavior is already established, and extract broader abstractions only when multiple providers demonstrate the same semantics rather than merely similar syntax.

The architectural abstraction is therefore the provider boundary and ownership model. Exact methods, classes, generics, and internal decomposition remain implementation choices.

## Consumer boundary

Consumers use observations; they do not own retrieval lifecycle.

Chess-domain interpretation, graph admission, current-view relevance, and presentation policy remain outside the provider unless a source-specific contract explicitly requires otherwise. In particular, Knowledge Acquisition may use source observations to establish graph knowledge, Evidence may derive chess meaning from them, and presentation may observe provider operational status without those concerns becoming provider-owned semantics.
