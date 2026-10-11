# Source observation providers

## Purpose

Define the common architectural shape for components that expose usable observations from external sources without prescribing one shared implementation.

Current examples include rated Explorer, Masters, and Lichess cloud evaluation. Their source contracts differ, but they should present comparable boundaries wherever their semantics align.

## Boundary

A source observation provider owns the **meaning and policy** required to expose usable observations from one external source.

`PositionRepository` owns the generic application lifetime of position-associated facet values and equivalent in-flight acquisition. Providers do not duplicate that lifetime state with their own per-position `latest` maps.

A provider keeps request construction, source-specific validation, freshness, fallback, absence, retry/recovery, and operational failure detail behind its boundary. Consumers receive usable source data or absence, plus only exceptional outcomes for which the consumer owns a meaningful decision.

The provider decides whether an observation can be satisfied from already available data or whether source retrieval is needed. It also decides whether an older usable observation may remain available when refresh does not produce a replacement. Those decisions are source-specific policy even though retained values and shared producer lifetime are repository-owned mechanisms.

Successful source data remains distinct from the operational path used to obtain or retain it. Retrieval status, HTTP outcomes, cache age, persistence issues, and fallback state do not become fields of the observation merely so consumers can inspect provider mechanics.

A provider may expose operational activity/issues separately when useful for diagnostics or presentation. Operational reporting must not alter observation meaning.

## Acquisition participation and available observations

Requesting an observation and reading one already available are different relationships.

An acquisition participant asks the provider to ensure usable source data exists. The provider may satisfy that request from durable cache, from a repository-owned live admitted facet value where source policy allows it, or by joining/starting retrieval. Concurrent acquisition participants for the same source facet and position share producer lifetime through `PositionRepository`; participation may affect request priority and last-participant cancellation.

Reading available state is passive. A provider may inspect the repository-owned live facet value and/or durable record without starting a request, keeping a request alive, or affecting request priority. Current-view projections use this passive path: Rail, Constellation composition, and Evidence derive from facts already available rather than opening their own hydration lifecycles.

Current-view synchronization does **not** require providers to route notifications to consumers. The current-view boundary already coordinates work it requested and may recompute projections when relevant work completes. Mere provider activity, run ownership, or task completion does not define whether the active Constellation is [Settling or Settled](../glossary.md#settled); that follows the current-view settlement contract. There is no requirement for a generic provider subscription API or source-to-consumer event bus.

For Explorer, a fresh validated Reading is admitted to the repository's live `explorer` facet before best-effort cache persistence. That Reading remains usable in the current application lifetime when persistence fails, and repeated `ensure()` may reuse the fresh unpersisted observation rather than duplicate retrieval. Once successfully persisted, the same live facet remains available to passive consumers without becoming a shadow durable cache with independent freshness semantics.

Masters and LichessEval use the same generic repository lifetime mechanism for their usable live values. Their exact freshness, fallback, absence, and usability rules remain source-specific.

Passive available state does not decide graph admission, Constellation selection, Rail inventory policy, Evidence meaning, or current-view relevance. Each owning component decides what a usable observation means in its domain.

## PositionRepository relationship

`PositionRepository` owns generic state for `(canonical position, facet)`:

- the live admitted value for the current application lifetime;
- generic provider-supplied metadata such as observation timestamp and persistence status;
- equivalent shared acquisition producer lifetime;
- participant attachment/detachment;
- effective acquisition urgency;
- last-participant cancellation;
- persisted canonical position-record access and mutation.

Providers own the decisions that give those mechanics meaning. A provider validates before admission and decides whether a repository-held live or persisted value is acceptable for the current request.

A provider must not infer freshness or source meaning from repository mechanics alone. Conversely, a provider should not create another per-position state owner merely to retain a value that `PositionRepository` can retain generically.

## Transport relationship

Lichess-backed source providers send application-issued HTTP through [`LichessGateway`](lichess-gateway.md). The gateway owns global transport scheduling, 429 cooldown, queued cancellation, and translation of browser abort-shaped request failures when the exact request signal proves obsolescence. Providers do not duplicate those transport mechanics.

`PositionRepository` may independently establish `ObsoleteWork` for shared-load participant lifetime that it owns. Once a lower boundary has established semantic `ObsoleteWork`, higher layers propagate/stop it according to their own control flow without reinterpreting raw `AbortError` names.

The provider still owns source-facing request, validation, freshness, fallback, absence, retry, and operational policy around genuine retrieval outcomes. A transport boundary knowing work became obsolete does not decide whether a non-obsolete source failure should use stale data, expose absence, update authentication state, or report a provider issue.

## Failure boundary

**Source clients terminate HTTP/network interpretation before returning to domain coordination.** The gateway passes completed HTTP responses or genuine transport failures to the requesting client. The client owns status/body interpretation, source validation, stale fallback, source-defined successful absence, authentication policy, and diagnosis of exhausted retrieval. It must not pass raw HTTP status or fetch-error taxonomy upward merely so a consumer can rediscover a decision already owned here.

After the provider has applied its recovery policy, its immediate caller may receive:

- a usable observation, potentially retained from compatible cache while a refresh fails;
- an explicit successful absence only where the source contract permits it (for example cloud-eval HTTP 404), not an invented empty Reading from a failed request;
- a provider-specific local result/operational issue (for example supplementary Masters or cloud-eval unavailability) without forcing a generic exception;
- semantic `SourceUnavailable` when that client cannot provide a required source result and the caller must decide whether a **particular attempt** may stop waiting;
- `ObsoleteWork` unchanged when the owning caller/producer lifetime was cancelled;
- another genuine failure only when the consumer must act on it, rather than when it is incidental to successful fallback.

In current clients, **rated Explorer** returns a usable Reading after compatible fallback or exposes `SourceUnavailable` when acquisition is exhausted. **Sampled-game export** is a Root-discovery endpoint client rather than a position-facet provider, but follows the same failure boundary: a failed required export becomes `SourceUnavailable` and must not masquerade as a successful empty sample. Knowledge Acquisition and Root discovery convert that semantic condition to run-local `unavailable`; neither inspects 429 or other transport status. **Masters** handles source failures with its own cached-value/`null` policy. **Cloud eval** separately owns usable evaluation quality, temporary 404 absence, operational rate-limit/failure status, and fallback. **LichessSession/OAuth** owns token invalidation and authorization failures; an OAuth 429 is not `SourceUnavailable` chess evidence.

`PositionRepository` owns generic facet/cache and shared-work mechanics, not HTTP meaning. A producer's raw error can pass through repository machinery to the provider, which owns any source-specific translation at its public boundary. An unsuccessful cache write may also remain a local operational diagnostic while a valid in-memory observation is returned.

Semantic `ObsoleteWork` must pass unchanged; clients do not infer it from raw `AbortError` names. A `SourceUnavailable` exception may preserve an HTTP/network/storage error as `cause` for diagnostics, but **callers branch on the semantic exception, never on `error.cause`**. Graph-reconciliation or required persistence failures *after* a usable observation are not retroactively source unavailability.

[Failure boundaries](failure-boundaries.md#architectural-failure-contracts) is the authoritative vocabulary and cross-boundary decision rule; this section owns its application to source clients. The shared pattern does not require identical exception types or statuses for all providers.

## Source-specific ownership

Each provider retains ownership of what constitutes a usable observation, authoritative absence when supported, freshness sufficient to avoid retrieval, stale fallback, cache representation, validation depth, operational status, and the policy for reusing a repository-current live value.

The common architecture does not require identical cache representation, freshness rules, absence semantics, operational status APIs, or method names.

## Reuse

Comparable provider boundaries do not imply a required common base class, generic provider object, policy interface, shared event bus, or shared source-policy state machine.

Reuse the generic state/lifetime mechanics already established by `PositionRepository`. Keep providers cohesive around source policy. Extract broader policy abstractions only when multiple providers demonstrate the same semantics rather than merely similar syntax.

The architectural abstraction is therefore:

- `PositionRepository`: generic position-facet state and acquisition lifetime;
- source provider: source meaning and policy;
- `LichessGateway`: generic transport state/policy.

Exact methods, classes, generics, and provider-internal decomposition remain implementation choices.

## Consumer boundary

Consumers use observations; they do not own retrieval lifecycle.

Chess-domain interpretation, graph admission, current-view relevance, and presentation policy remain outside the provider unless a source-specific contract explicitly requires otherwise. Knowledge Acquisition may reconcile Explorer observations into graph knowledge, Evidence derives chess meaning, current-view projections read available observations, and presentation may consume provider operational status without those concerns becoming provider-owned semantics.
