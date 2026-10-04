# Nodus

## Purpose

Own the current canonical position and the position-centered navigation behavior organized around it.

The Nodus is presented as the primary playable board, but its product meaning is broader than that rendering: it is the position the current view, URL, history state, Rail, and Constellation are organized around.

## Settling

**A Nodus does not reload as knowledge arrives. It settles: the best trustworthy view stays interactive while new facts refine it in place.**

After a Nodus has a trustworthy structure, later Explorer, graph, engine, Masters, or enrichment work must not replace that usable view with a loading state. Run-owned work may keep the Nodus visibly Updating, but the accepted Constellation, Rail, and Evidence remain available until a better replacement value is completely derived.

When run-owned work settles, current-view composition is repeated from facts now available. Refinement is therefore a replacement immutable view value for the same Nodus, not mutation of an old value and not a new navigation event. Multiple source completions may be coalesced into one settlement pass.

Failure of optional/refining work reduces what can be learned from that work; it does not erase an already trustworthy Nodus. Only inability to establish required trustworthy state for a newly selected Nodus may make that new state unavailable.

## Requirements

- The current Nodus is a valid canonical chess position.
- The Nodus is presented as a large playable Chessground board.
- Playing a legal Move on the Nodus requests a Recenter whose target is first materialized into [ChartedGraph](charted-graph.md), even when the move is outside automatic Constellation selection.
- Promotion is part of completing the user's legal Move. Cancelling promotion does not Recenter.
- Clicking another navigable canonical position requests a Recenter to that known target.
- Recenter is the application-level operation that selects another Nodus. A caller may supply a known canonical target or a Move that must first be resolved and materialized.
- Browser-history restoration is distinct from Recenter: it restores recorded position-centered state without creating another history entry.
- Recenter and browser-history restoration start a new current-view run for the resulting Nodus. View-local Candidates and Constellation structure are rebuilt from durable graph knowledge plus currently available source facts rather than carrying forward a frozen prior projection.
- Explicit refresh starts a replacement run for the same Nodus while keeping the established trustworthy snapshot visible until replacement derivation is accepted. Refresh does not bypass source-provider freshness policy.
- Root/Line mode switching selects between sibling projections within the same Nodus run; it is not a Recenter and does not itself restart source acquisition.
- The URL identifies the canonical Nodus rather than the move path used to reach it.
- Stale asynchronous Move materialization or refinement from an obsolete run must not Recenter, publish into, or settle a replacement Nodus.
- Changing the Nodus does not redefine graph identity; `ChartedGraph` remains durable across Recenter operations.

## Verification

Deterministic/browser contract tests should cover:

- URL round-tripping for canonical positions;
- Recenter to a known target;
- Recenter after a legal played Move, including a move outside automatic Constellation selection;
- all legal promotion choices and cancellation behavior;
- a trustworthy Nodus remaining interactive while refinement work is pending;
- settlement replacing the current immutable view from newly available facts without a loading downgrade;
- refinement failure preserving an already trustworthy Nodus;
- explicit refresh preserving the established same-Nodus snapshot during replacement derivation;
- stale Move materialization/refinement being unable to affect a replacement Nodus;
- browser back/forward restoration without adding another history entry;
- Recenter/history restoration rebuilding view-local projection state rather than restoring frozen Candidate/Constellation state;
- Root/Line mode switching staying inside the same Nodus run;
- durable graph identity remaining unchanged by Recenter.
