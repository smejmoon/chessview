# Nodus

## Purpose

Own the current canonical position and the position-centered navigation behavior organized around it.

The Nodus is presented as the primary playable board, but its product meaning is broader than that rendering: it is the position the current view, URL, history state, Rail, and Constellation are organized around.

## Settlement

**A Nodus does not reload as knowledge arrives. The best trustworthy view stays interactive while Chessview finishes deciding the shape of the current view.**

A Nodus is structurally [Settled](../glossary.md#settled) exactly when its active Constellation is Settled. While the active Constellation is [Settling](../glossary.md#settling), the accepted Constellation, Rail, and Evidence remain available until replacement values are completely derived and accepted.

Generic asynchronous or run-owned work is not sufficient to make a Nodus Settling. Only admitted obligations capable of changing the active Constellation participate in structural settlement. Work confined to supplementary Evidence/Rail enrichment or to an inactive sibling projection does not keep the active Nodus structurally unsettled.

A completed structural result must be incorporated into the active Constellation before the Nodus may be called structurally Settled. Supplementary engine or Masters work may continue after settlement, and its completion does not by itself reopen structural settlement. A newly admitted structural obligation may make the active Constellation, and therefore the Nodus, Settling again.

Failure of supplementary work reduces what can be learned from that work; it does not erase an already trustworthy Nodus. Only inability to establish required trustworthy state for a newly selected Nodus may make that new state unavailable.

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
- Root/Line mode switching selects between sibling projections within the same Nodus run; it is not a Recenter and does not itself restart source acquisition. After a mode switch, structural settlement follows the newly active Constellation.
- The URL identifies the canonical Nodus rather than the move path used to reach it.
- Stale asynchronous Move materialization or refinement from an obsolete run must not Recenter, publish into, or settle a replacement Nodus.
- Changing the Nodus does not redefine graph identity; `ChartedGraph` remains durable across Recenter operations.

## Verification

Deterministic/browser contract tests should cover:

- URL round-tripping for canonical positions;
- Recenter to a known target;
- Recenter after a legal played Move, including a move outside automatic Constellation selection;
- all legal promotion choices and cancellation behavior;
- a trustworthy Nodus remaining interactive while its active Constellation is Settling;
- structural settlement following the active Constellation rather than generic run-owned activity;
- a completed structural result leaving the Nodus Settling until that result is incorporated;
- supplementary engine/Masters enrichment continuing after structural settlement without reopening it;
- refinement failure preserving an already trustworthy Nodus when the failed work is supplementary;
- explicit refresh preserving the established same-Nodus snapshot during replacement derivation;
- stale Move materialization/refinement being unable to affect a replacement Nodus;
- browser back/forward restoration without adding another history entry;
- Recenter/history restoration rebuilding view-local projection state rather than restoring frozen Candidate/Constellation state;
- Root/Line mode switching staying inside the same Nodus run while settlement follows the newly active Constellation;
- durable graph identity remaining unchanged by Recenter.
