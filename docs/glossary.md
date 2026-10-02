# Chessview glossary

This glossary is the canonical index of Chessview terminology. It defines what a term means; it does **not** become a second specification. Product, component, and architecture documents own behavior, constraints, ownership, and verification and should link here rather than restating competing definitions.

## Canonical position

Chessview's stable identity for a playable chess state, independent of the route used to reach it. [ChartedGraph](components/charted-graph.md#nodes) owns the exact node-identity rule.

## Nodus

The canonical position currently organizing the map.

## Root

Visible upstream context showing positions from which play can reach the Nodus.

## Line

A downstream continuation from the Nodus through one or more legal Moves.

## Constellation

The coherent current-view subgraph selected around the Nodus. A Constellation is a projection of `ChartedGraph`: positions may be known without belonging to the current Constellation.

## Candidate

Current-view selection state for one known Graph Edge combined with currently available evidence. A Candidate may carry Prevalence, human-result or engine evidence, eligibility, Salience, and local ordering needed for one composition. A Candidate is not persisted `ChartedGraph` state.

## Rail

The supporting control and evidence surface beside the spatial map.

## Weather

The current view's structural lifecycle/readiness state and the user-facing status derived from it.

## Recenter

Application-level selection of another canonical position as the Nodus. A Recenter may target a known position directly or first resolve a played Move into its target. Restoring previously recorded browser-history state is not a Recenter.

## Move

A legal chess move connecting two adjacent canonical positions. A distance-1 Recenter may be associated with this Move whether the user traverses the relationship in the Move's forward direction or navigates backward across it.

## ChartedGraph

Chessview's durable subset of the fixed legal chess graph: the canonical positions and legal Move relationships Chessview has established so far. [ChartedGraph](components/charted-graph.md) owns the exact graph semantics and retention rules.

## Resolve Move

The pure operation that interprets a legal Move from a canonical source position and determines the corresponding target relationship. [ChartedGraph](components/charted-graph.md#resolve-move) owns the exact result and non-effects of resolution.

## Graph Edge

The durable directed `ChartedGraph` fact representing exactly one legal Move from a source canonical position to a target canonical position. Current source statistics, selection annotations, and visible-layout metadata are not Graph Edge state.

## Materialize a move

Resolve a played legal Move from a source position, then ensure the corresponding `ChartedGraph` edge and target position are durably represented. Materialization establishes graph knowledge; it does not itself decide whether the target becomes the current Nodus.

## Visible relationship

A current-view relationship selected into a Constellation from a Candidate. It refers back to one durable Graph Edge while carrying Constellation-local structural context such as family or depth. A visible relationship belongs to the current projection rather than persisted graph state.

## Move cue

Presentation derived from a visible relationship or Graph Edge that communicates the associated Move. An arrow is one possible move-cue treatment. A move cue does not define graph identity, navigation, or current-view state.
