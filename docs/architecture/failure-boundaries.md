# Failure boundaries

## Purpose

Define when a failure should remain local to the layer that encounters it and when it should cross an architectural boundary.

This rule applies across Chessview. It is not specific to Lichess, Explorer, persistence, or current-view work.

## Core rule

**A failure crosses a boundary only when the receiving layer can make a decision that the originating layer cannot. Otherwise the originating layer handles, translates, reports, or recovers from it locally.**

The purpose of this rule is to keep implementation-specific failure detail from leaking upward merely because an operation happened to fail. Boundaries should expose the semantic outcomes their consumers can act on, not the incidental mechanics that produced those outcomes.

## Local handling

A layer should keep a failure local when it already owns the policy needed to respond correctly. Local handling may include retrying, falling back, translating raw platform errors, updating operational status, emitting diagnostics, invalidating local state, or returning a different usable value.

Examples include:

- a [source observation provider](source-observation-providers.md) handling HTTP status, malformed source payloads, authentication state, cache freshness, and stale fallback;
- `LichessGateway` handling global request scheduling, 429 cooldown, queued cancellation, and browser-transport cancellation translation;
- a source observation provider reporting that source-cache persistence failed while still returning an already-valid in-memory observation;
- a repository translating IndexedDB mechanics into repository-level persistence semantics.

These details should not cross a boundary unless a caller above that boundary owns a decision that depends on them.

## Crossing a boundary

A failure should cross a boundary when the originating layer cannot complete the caller-visible contract and the receiving layer owns the next meaningful decision.

Examples include:

- `ObsoleteWork`, because the meaning of continued relevance belongs to the owner of the work rather than to the lower-level operation performing it;
- a persistence failure when durable mutation is part of the operation's promised result and the caller must decide whether the larger operation succeeded, should retry, or must remain incomplete;
- inability to provide a required domain value after the providing layer has exhausted the recovery policy it owns.

Cross-boundary failures should therefore be few and semantic. They should not mirror every HTTP status, DOM exception, storage event, or provider-specific failure mode.

## Architectural failure contracts

Each layer that performs I/O owns the policy it can decide there. Its caller should see a usable result, a meaningful absence, or only the failure conditions on which that caller must act. The concrete boundaries for Lichess access are:

| Boundary | Handles here | Exposes to its immediate caller |
| --- | --- | --- |
| [`LichessGateway`](lichess-gateway.md) | HTTP dispatch, request ordering/spacing, global 429 cooldown, queued cancellation, request-signal-based abort translation | Completed HTTP `Response` (including non-2xx), semantic `ObsoleteWork` on proven cancellation, or an unconverted genuine transport failure |
| [Lichess source client](source-observation-providers.md) | HTTP status and body interpretation, validation, source freshness/absence, cache fallback and exhausted-source policy | Usable observation, source-defined successful absence or local operational outcome; `SourceUnavailable` where acquisition cannot satisfy a consumer that needs that distinction; `ObsoleteWork` unchanged |
| `PositionRepository` | Position-facet cache/persistence mechanics, equivalent producer and subscriber lifetimes | Retained values or generic persistence/work outcomes; it may forward a producer failure to its provider, but never assigns HTTP meaning |
| Knowledge Acquisition / Root discovery | Graph reconciliation, source nomination, and conversion of semantic source unavailability into run-local outcomes | `satisfied` or `unavailable` refinement outcome; meaningful graph/reconciliation failure remains a failure, not source unavailability |
| Current View | Relevance, participation, settlement, and Weather | Accepted projection and readiness/presentation state; no HTTP statuses, retry clocks, or source transport details |

A completed HTTP exchange is not automatically a usable source observation. `LichessGateway` returns the response even when its status is an HTTP error; the endpoint client decides whether it means successful absence, failed acquisition, authentication loss, or another client-owned condition. The gateway's global 429 cooldown is independent of those decisions.

### Exceptional conditions that cross

- **`ObsoleteWork`** means the owning lifetime has established that the work is no longer required. The gateway can establish it from its exact request signal, and `PositionRepository` from a detached subscriber/producer. Higher layers propagate or stop it by its semantic type; an abort-shaped error alone is insufficient.
- **`SourceUnavailable`** means a source-owning client cannot supply the required source result after its applicable fallback/recovery policy. It does **not** mean the source has no chess data or that a cached observation should be erased. Rated Explorer and sampled-game export use this condition; other clients may legitimately expose different source/authentication outcomes. Knowledge Acquisition and Root discovery convert it into `unavailable` only for the relevant refinement attempt.
- **Other failures** stay failures when the receiving layer still owns a decision—for example graph reconciliation or required durable mutation. They must not be relabeled as `SourceUnavailable` merely because they happened after a source call.

An exception's `cause` may preserve raw HTTP status, network error, or storage provenance for diagnostics. **`error.cause` is not the receiving layer's branching contract.** Callers use the semantic result/exception and must not reconstruct HTTP, cancellation, or provider fallback decisions from its diagnostic details.

This describes permitted cross-boundary outcomes, not a requirement that every provider export the same exception type or every failed request throw. Each provider's own API establishes which outcomes it uses; [Source observation providers](source-observation-providers.md#failure-boundary) owns the source-client application of this rule.

## Translation at boundaries

Platform and infrastructure errors are not application semantics by themselves. A boundary may translate them when it has enough context to establish meaning.

For Lichess HTTP, `LichessGateway` is the boundary that has both the browser fetch rejection and the exact request `AbortSignal`. An abort-shaped transport rejection becomes `ObsoleteWork` only when that request signal is actually aborted. An abort-shaped rejection while the request signal remains live stays a genuine transport failure. The translated `ObsoleteWork` may retain the original platform error as causal detail.

Above that boundary, code classifies the semantic `ObsoleteWork` condition itself. It must not reconstruct cancellation from `error.name === 'AbortError'` or from a raw error combined with unrelated current-view or storage state.

The same rule applies at other boundaries according to the provenance they own. For example, `PositionRepository` can establish `ObsoleteWork` when a subscriber's own participation signal becomes obsolete, while an IndexedDB transaction abort is not automatically cancellation simply because the browser reports an `AbortError`.

Translation should preserve useful causal detail for diagnostics while exposing only the semantic condition needed by the next layer.

## Data and operational state

Recoverable operational problems should not be encoded into otherwise valid domain data merely to make them observable.

If a layer can still provide a valid value, it may return that value while reporting a local operational issue separately. For example, a valid source observation may remain usable even if refreshing or persisting its cache failed.

Consumers should receive the data contract they need plus only those exceptional outcomes on which they can make a meaningful decision.

## Design test

When considering whether to introduce or propagate an exception across a boundary, ask:

1. What decision can the receiving layer make because it knows about this failure?
2. Could the originating layer already make that decision correctly with the information and policy it owns?
3. Is the propagated condition semantic to the receiving layer, or is it merely an implementation detail of the originating layer?

If the receiving layer gains no unique decision, keep the failure local.
