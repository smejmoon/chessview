# Position cache

## Purpose

Own the generic position-facet cache behavior executed by `PositionRepository`. [Data stability](../components/data-stability.md) explains why source observations remain useful and guides their refresh intervals. Source clients supply the source-specific facts needed to execute this policy.

## Cache behavior

- **Return a compatible cached observation immediately**, even if its refresh interval has elapsed. When refresh is due, acquire new information in the background while the retained observation remains usable.
- **A refresh interval does not impose a maximum age.** Do not delete otherwise valid positive data because time has passed. Persistent Graph Edges and canonical position identity are separate from refreshable source observations.
- **Match the question.** Cache compatibility depends on canonical position, source/facet, meaningful filters and required response shape. Reject a cached result that cannot answer the current question, including as stale fallback; avoid comparing irrelevant wire-format details.
- **Keep absence distinct from failure.** A supported successful absence (such as a cloud-eval 404) is a temporary cacheable observation with its own refresh decision. Network, HTTP, invalid data, and cache errors are not successful absence.
- **Keep useful observations after failure.** New valid data can improve an admitted value. If refresh fails, return or retain the compatible cached value; do not manufacture empty readings or retract established graph knowledge.
- **Use existing bounded work.** Coalesce equivalent due refreshes through repository-owned producer lifetime and forward source requests through existing `LichessGateway` scheduling. Trigger refresh by real demand; do not introduce a periodic polling engine or a second scheduler.
- **Treat persistence as best-effort.** Retain a usable live value if writing fails. A failed read can proceed through ordinary source acquisition. Never report a write as persisted when it was not.

## Ownership

`PositionRepository` handles lookup, compatible cached reuse, age checks, shared background refresh coordination, live and durable storage, and generic cache diagnostics. It must not infer chess quality or endpoint semantics.

Explorer, Masters, and `LichessEval` provide request construction, response parsing and validation, source quality thresholds, meaningful cache identity, suggested refresh interval, and source-specific absence/failure interpretation. Declare each source's inputs once rather than duplicating an entire cache lifecycle in every source client.

This does not move Lichess transport scheduling out of `LichessGateway`, graph admission out of Knowledge Acquisition, source meaning out of Evidence, or structural settlement out of Current View. Normal startup Lichess authorization still occurs before Current View begins; no new unauthenticated cold-start mode is required.

## Presentation

A background refresh can show source activity while the accepted Constellation and Rail remain usable. If the work is an admitted structural Explorer obligation, Weather may say `Updating…`. Supplementary Masters and cloud-eval refresh use Lichess source status without independently making Weather unsettled. New information may refine the view without relabeling old structure as a different Nodus.

## Diagnostics over speculative recovery

For an unexpected cache read, write, validation, identity, or schema problem, log enough to reproduce and address it: operation, canonical position/facet, relevant profile/schema version, error type and message, and resulting fallback or abandonment. Do not log tokens or private request contents.

Bail out of the affected cache operation, not the whole application. Use an already valid live observation or normal acquisition if available; otherwise report unknown/unavailable rather than inventing data. Do not build hypothetical repair frameworks, repeated retries, or elaborate corner-case handling without evidence of a real need. Basic correctness guards remain mandatory.

## Verification

Prefer one set of generic behavioral tests for immediate cached delivery, nonblocking shared refresh, successful improvement, compatible identity, persistence failure, diagnosable faults, and absence versus failure. Retain smaller source-specific tests for distinct parsing, quality, request parameters, and meaning. Avoid replicated test matrices of the same repository caching behavior.
