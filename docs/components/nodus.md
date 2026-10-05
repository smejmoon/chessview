# Nodus

## Purpose

The **Nodus** is the canonical position currently organizing the map.

There is exactly one Nodus in the current view. “Current Nodus” is therefore
redundant product language rather than a second concept, and Nodus is not a
session, controller, projection container, or refinement lifetime.

The Nodus is presented as the primary playable board. Roots are upstream of it,
Lines are downstream of it, the Constellation is selected around it, and the
Rail supports the view organized around it.

## Identity and transitions

Nodus identity is canonical-position identity. The route used to reach that
position, browser-history ancestry, Root/Line mode, presentation preferences,
accepted Constellation structure, Evidence, Rail values, Weather, source state,
and refinement progress are not part of Nodus identity.

[Recenter](../glossary.md#recenter) is the application-level transition that
selects another canonical position as the Nodus. A caller may supply a known
canonical target directly or a played Move whose target must first be resolved
and materialized into [ChartedGraph](charted-graph.md). Browser-history
restoration selects the recorded Nodus without creating another history entry.

Changing Root/Line mode does not change the Nodus. Refreshing does not change the
Nodus. Refining knowledge around the position does not change the Nodus.

The [current-view boundary](../architecture/current-view.md) owns those
transitions, accepted view state, refinement-run lifetime, currentness, and
publication. `RouteLedger` owns browser address/history mechanics. Lens owns
presentation preferences and environment.

## Refinement and settlement boundary

Nodus does not own acquisition or refinement demand merely because that work is
organized around the Nodus. Current-view refinement planning derives useful work
from the Nodus, the accepted Constellation and its Reading frontier, Rail/Evidence
needs, and other current-view inputs while preserving Constellation-owned
structural provenance.

Nodus itself is neither Settling nor Settled. Those terms apply to objects with
admitted obligations, most importantly the Constellation. Current View combines
the accepted Constellation's structural frontier with the active refinement
run's lifecycle when deciding the structural readiness published to Weather.

A trustworthy accepted view around the Nodus remains usable while refinement
continues, waits, succeeds, or fails. Refresh may replace the refinement run
without replacing the Nodus or discarding the accepted trustworthy view.

## Requirements

- The Nodus is exactly one valid canonical chess position.
- The Nodus is presented as a large playable Chessground board.
- Playing a legal Move on the Nodus requests a Recenter whose target is first
  materialized into [ChartedGraph](charted-graph.md), even when the Move is
  outside automatic Constellation selection.
- Promotion is part of completing the user's legal Move. Cancelling promotion
  does not Recenter.
- Clicking another navigable canonical position requests Recenter to that known
  target.
- The URL identifies the Nodus and may also serialize independent current-view
  state such as Root/Line mode; URL co-location does not make mode part of Nodus
  identity.
- Recenter and browser-history restoration may replace the accepted current view
  and refinement run because they select another Nodus.
- Explicit refresh keeps the same Nodus and established trustworthy view while
  starting replacement refinement work under normal source freshness policy.
- Root/Line mode switching keeps the same Nodus. A mode change may require
  recomposing the one accepted Constellation for new current-view inputs.
- Stale asynchronous Move materialization or refinement from obsolete work must
  not select, publish into, or settle a replacement current view.
- Changing the Nodus does not redefine graph identity; `ChartedGraph` remains
  durable across Recenter operations.

## Verification

Deterministic/browser contract tests should cover:

- URL round-tripping for Nodus canonical position and Root/Line mode without
  treating mode as Nodus identity;
- Recenter to a known target;
- Recenter after a legal played Move, including a Move outside automatic
  Constellation selection;
- all legal promotion choices and cancellation behavior;
- refresh preserving the same Nodus and established trustworthy view while
  replacement refinement proceeds;
- Root/Line mode switching preserving the same Nodus;
- stale Move materialization/refinement being unable to affect a replacement
  current view;
- browser back/forward restoration selecting the recorded Nodus without adding
  another history entry;
- durable graph identity remaining unchanged by Recenter;
- refinement demand, accepted Constellation/Rail state, settlement, Lens state,
  and browser-history bookkeeping remaining outside Nodus identity.
