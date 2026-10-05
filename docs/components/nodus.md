# Nodus

## Purpose

Own the current canonical position, Recenter semantics organized around it, and the current-Nodus refinement demand implied by its active and sibling Constellations.

The Nodus is presented as the primary playable board, but its product meaning is broader than that rendering: it is the position the current view, URL, Rail, and Constellation are organized around. Browser URL/history mechanics are owned separately by `RouteLedger`.

## Refinement demand

Nodus owns the domain decision about what knowledge is worth pursuing for the current position-centered view. It gathers needs from the sibling Root and Line Constellations together with useful position-centered enrichment and expresses current-Nodus refinement demand without fetching, caching, or reconciling source data itself.

Constellation owns admission of structural obligations within that demand. In particular, a position exposed through a Constellation Reading frontier is a structural Reading need for that projection because Constellation has determined that another Reading can still change its constrained shape. Nodus preserves that structural provenance when combining projection demand; it does not manufacture structural criticality from provider type, task identity, or mere usefulness.

Nodus may also express supplementary demand for Explorer context around represented positions, engine evidence, Masters evidence, Root context, and other useful enrichment. Such demand may be prioritized according to the live active projection or be Nodus-wide, but it is not structural unless the active Constellation has admitted the corresponding obligation.

The [current-view boundary](../architecture/current-view.md) translates current-Nodus refinement demand into executable work and owns deduplication, currentness, completion coordination, incorporation, and publication. [Knowledge Acquisition](knowledge-acquisition.md) and source providers own the source-specific acquisition/reconciliation behavior used to satisfy that work.

## Settlement

**A Nodus does not reload as knowledge arrives. The best trustworthy view stays interactive while Chessview finishes deciding the shape of the current view.**

A Nodus is structurally [Settled](../glossary.md#settled) exactly when its active Constellation is Settled. While the active Constellation is [Settling](../glossary.md#settling), the accepted Constellation, Rail, and Evidence remain available until replacement values are completely derived and accepted.

Generic asynchronous or run-owned work is not sufficient to make a Nodus Settling. Only admitted obligations capable of changing the active Constellation participate in structural settlement. Work confined to supplementary Evidence/Rail enrichment or to an inactive sibling projection does not keep the active Nodus structurally unsettled.

A completed structural result must be incorporated into the active Constellation before the Nodus may be called structurally Settled while that obligation remains relevant. Completion requests another current-view recomposition. An in-flight replacement that did not observe the completed result may still be accepted if it is trustworthy, but its active Constellation remains Settling whenever the unresolved obligation remains in its Reading frontier. A later recomposition may settle after incorporating the result or establishing that the obligation is no longer relevant to constrained shape. Supplementary engine or Masters work may continue after settlement, and its completion does not by itself reopen structural settlement. A newly admitted structural obligation may make the active Constellation, and therefore the Nodus, Settling again.

Failure of supplementary work reduces what can be learned from that work; it does not erase an already trustworthy Nodus. Only inability to establish required trustworthy state for a newly selected Nodus may make that new state unavailable.

## Requirements

- The current Nodus is a valid canonical chess position.
- The Nodus is presented as a large playable Chessground board.
- Playing a legal Move on the Nodus requests a Recenter whose target is first materialized into [ChartedGraph](charted-graph.md), even when the move is outside automatic Constellation selection.
- Promotion is part of completing the user's legal Move. Cancelling promotion does not Recenter.
- Clicking another navigable canonical position requests a Recenter to that known target.
- Recenter is the application-level operation that selects another Nodus. A caller may supply a known canonical target or a Move that must first be resolved and materialized.
- `RouteLedger` owns browser address/history mechanics: the shareable URL carries the canonical center and Root/Line mode, while private browser-entry metadata determines whether Chessview Back is available. Nodus/current-view state does not store browser-history depth.
- Browser-history restoration is distinct from Recenter: it restores the recorded Nodus address without creating another history entry.
- Recenter and browser-history restoration start a new current-view run for the resulting Nodus. View-local Candidates, Constellation structure, and current-Nodus refinement demand are rebuilt from durable graph knowledge plus currently available source facts rather than carrying forward a frozen prior projection.
- Explicit refresh starts a replacement run for the same Nodus while keeping the established trustworthy snapshot visible until replacement derivation is accepted. Refresh does not bypass source-provider freshness policy.
- Root/Line mode switching selects between sibling projections within the same Nodus run; it is not a Recenter and does not itself restart source acquisition. After a mode switch, structural settlement follows the newly active Constellation and live demand priority may follow the newly active projection without changing demand ownership.
- The URL identifies the canonical Nodus and selected Root/Line mode rather than the move path used to reach it.
- Stale asynchronous Move materialization or refinement from an obsolete run must not Recenter, publish into, or settle a replacement Nodus.
- Changing the Nodus does not redefine graph identity; `ChartedGraph` remains durable across Recenter operations.

## Verification

Deterministic/browser contract tests should cover:

- URL round-tripping for canonical positions and Root/Line mode;
- Recenter to a known target;
- Recenter after a legal played Move, including a move outside automatic Constellation selection;
- all legal promotion choices and cancellation behavior;
- current-Nodus refinement demand being derived from sibling Constellations and position-centered enrichment rather than from provider/task bookkeeping;
- Reading-frontier positions retaining their Constellation-admitted structural provenance when Nodus combines demand;
- represented-position Explorer, engine, Masters, and Root-context demand remaining supplementary unless a Constellation has admitted a corresponding structural obligation;
- active-projection relevance changing demand priority without creating a second producer identity or changing structural provenance;
- a trustworthy Nodus remaining interactive while its active Constellation is Settling;
- structural settlement following the active Constellation rather than generic run-owned activity;
- a completed structural result leaving the Nodus Settling until that result is incorporated or its structural obligation becomes irrelevant;
- a refinement completion during recomposition causing another recomposition while any intermediate active Constellation that still carries the obligation remains Settling;
- supplementary engine/Masters enrichment continuing after structural settlement without reopening it;
- refinement failure preserving an already trustworthy Nodus when the failed work is supplementary;
- explicit refresh preserving the established same-Nodus snapshot during replacement derivation;
- stale Move materialization/refinement being unable to affect a replacement Nodus;
- browser back/forward restoration without adding another history entry, with Back availability owned by `RouteLedger` rather than Nodus state;
- Recenter/history restoration rebuilding view-local projection state rather than restoring frozen Candidate/Constellation state;
- Root/Line mode switching staying inside the same Nodus run while settlement follows the newly active projection;
- durable graph identity remaining unchanged by Recenter.
