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
- a transport scheduler handling cooldown and queued-request behavior;
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

## Translation at boundaries

Platform and infrastructure errors are not application semantics by themselves. A boundary may translate them when it has enough context to establish meaning.

For example, an abort-shaped platform error represents `ObsoleteWork` only when the relevant operation lifetime actually became obsolete. Error shape alone is insufficient provenance. Likewise, an IndexedDB transaction abort is not automatically cancellation simply because the browser reports an `AbortError`.

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
