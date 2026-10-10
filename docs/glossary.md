# Chessview glossary

This glossary is the canonical index of Chessview terminology. It defines what a term means; it does **not** become a second specification. Product, component, and architecture documents own behavior, constraints, ownership, and verification and should link here rather than restating competing definitions.

## Canonical position

Chessview's stable identity for a playable chess state, independent of the route used to reach it. [ChartedGraph](components/charted-graph.md#nodes) owns the exact node-identity rule.

## SourceChannel

A named category of independently maintained source observations for a canonical position, such as `explorer`, `masters`, or `cloud-eval`. `PositionRepository` identifies admitted observations and equivalent shared acquisitions by the pair (canonical position, SourceChannel). A SourceChannel names a data category, not a transport connection or event stream. See [PositionRepository](architecture/position-repository.md).

## OpeningLabel

Optional source-supplied opening-classification metadata (typically an ECO code and opening name) carried inside the `opening` field of an Explorer observation or its move data. An OpeningLabel is not canonical-position identity and does not establish which move order the user actually followed. See [Opening Explorer databases](components/opening-explorer-databases.md).

## Nodus

The canonical position currently organizing the map.

## Root

Visible upstream context showing positions from which play can reach the Nodus.

## Line

A downstream continuation from the Nodus through one or more legal Moves.

## Constellation

The coherent current-view subgraph selected around the Nodus. A Constellation is a projection of `ChartedGraph`: positions may be known without belonging to the current Constellation.

## Settled

An object is **Settled** when it has reached a fixed point with respect to the obligations admitted by its contract: no unresolved admitted obligation can still change it, and no completed relevant result remains to be incorporated. Repeating its derivation from the same admitted facts would therefore produce the same result.

Settled does not mean all related work is finished. Supplementary work may continue, and a newly admitted relevant obligation may make the object Settling again. The fixed point is the invariant that makes Settled precise; it is not a separate product state.

## Settling

An object is **Settling** while it is not Settled because an admitted obligation can still change it or because a completed relevant result still has to be incorporated.

## Candidate

Current-view selection state for one known Graph Edge combined with currently available evidence. A Candidate may carry Prevalence, human-result or engine evidence, eligibility, Salience, and local ordering needed for one composition. A Candidate is not persisted `ChartedGraph` state.

## Rail

The supporting control and evidence surface beside the spatial map.

## Weather

The presentation of the current view's structural settlement/readiness state.

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

## ObsoleteWork

Intentional termination of work whose result is no longer wanted by the owning lifetime or live demand. `ObsoleteWork` is semantic control flow established by a boundary that owns the relevant lifetime provenance; an abort-shaped platform error is not sufficient by itself to establish this meaning.

## PersistenceFailure

Failure to make an otherwise valid application result or state transition durable in local persistence. A `PersistenceFailure` does not by itself make an already obtained in-memory value invalid.

## RejectedObservation

An external observation that was obtained but is not admitted as usable source data because it violates the source-facing contract Chessview requires. Rejection is distinct from failure to obtain an observation at all.
