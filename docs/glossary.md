# Chessview glossary

This glossary is the canonical index of Chessview terminology. It defines what a term means; it does **not** become a second specification. Product, component, and architecture documents own behavior, constraints, ownership, and verification and should link here rather than restating competing definitions.

## Nodus

The canonical position currently organizing the map.

## Root

Visible upstream context showing positions from which play can reach the Nodus.

## Line

Visible downstream continuation showing positions reachable from the Nodus.

## Rail

The supporting control and evidence surface beside the spatial map.

## Recenter

Application-level selection of another canonical position as the Nodus. A Recenter may target a known position directly or first resolve a played Move into its target. Restoring previously recorded browser-history state is not a Recenter.

## Move

A legal chess move connecting two adjacent canonical positions. A distance-1 Recenter may be associated with this Move whether the user traverses the relationship in the Move's forward direction or navigates backward across it.

## Resolve Move

Given a source position and a Move, determine the canonical target and move notation. Resolution is a pure Position Graph operation: it establishes the directed chess fact from source to target, including target FEN plus SAN and UCI notation, without persisting graph state or deciding whether the target becomes the Nodus.

## Graph edge

The durable directed graph fact representing exactly one legal Move from a source canonical position to a target canonical position.

## Materialize a move

Resolve a played legal Move from a source position, then ensure the corresponding graph edge and target position are durably represented. Materialization establishes graph knowledge; it does not itself decide whether the target becomes the current Nodus.

## Visible relationship

A current-view projection of graph connectivity used to compose the visible map. A visible relationship refers back to durable graph identity but belongs to the visible composition rather than persisted graph state.

## Move cue

Presentation derived from a visible relationship or graph edge that communicates the associated Move. An arrow is one possible move-cue treatment. A move cue does not define graph identity, navigation, or current-view state.
