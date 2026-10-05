# Current view

Own the application boundary that decides what is current and which asynchronous
domain results are allowed to become part of the published view around the
[Nodus](../components/nodus.md).

Nodus itself is only the one canonical position currently organizing the map.
Current View owns the larger accepted state organized around it and the temporary
refinement run trying to improve that state. [Constellation](../components/constellation.md)
owns visible-subgraph composition and structural admission, [Evidence](../components/evidence.md)
owns independently addressable semantic evidence, [Rail](../components/rail.md)
owns the supporting Line inventory/evidence surface, [Weather](../components/weather.md)
presents structural readiness, [Lens](../components/lens.md) owns presentation
preferences/environment/constraints, and `RouteLedger` owns browser
address/history mechanics.

## Accepted view

Current View retains the best trustworthy state established around the Nodus.
Conceptually that accepted state includes:

- the Nodus canonical position;
- active Root/Line mode;
- the accepted Constellation for those current composition inputs;
- accepted Nodus-level Rail values;
- presentation-facing Evidence decoration when useful.

These values are accepted independently of work still trying to improve them.
Refresh or failed refinement must not erase an established trustworthy view.

There is one semantically current Constellation around the one Nodus. Root/Line
mode is a Current View input that changes what context is composed; it does not
create a second Nodus or a sibling semantic projection lifetime. An implementation
may cache derivations for another mode, but that cache is not another accepted
current view and does not own settlement.

Lens orientation/Guide/Debug and browser-history state are outside accepted-view
identity. Current View may publish Lens orientation and `RouteLedger.canGoBack()`
as renderer-facing affordances without becoming their authority.

## Refinement run

A **refinement run** is the replaceable child lifetime representing what Current
View is presently trying to improve about its accepted view.

Run-local state includes cancellation/currentness, live source-work
participation, structural provenance carried from Constellation admission,
working/retry-waiting/satisfied/unavailable execution phases, and recomposition
scheduling. This state is coordination state, not Nodus identity and not durable
chess knowledge.

Explicit refresh keeps the same Nodus and accepted trustworthy view while
replacing the refinement run. Recenter or browser-history restoration to another
canonical position replaces the Nodus, accepted view, and refinement run. An
obsolete run cannot mutate, publish into, or settle its replacement.

Mode changes and material Lens-capacity changes keep the same Nodus. They may
recompose the accepted Constellation and reconcile the existing run's live demand
rather than manufacturing a new Nodus lifetime.

Reusable source producer/cache lifetime remains separate. [`PositionRepository`](position-repository.md)
owns shared per-position facet producers and participants may detach from them;
providers own source-specific policy and `LichessGateway` owns transport policy.
A refinement run owns only its current-view participation and interpretation of
semantic run outcomes supplied by those lower boundaries.

## Refinement planning

Current-view refinement planning derives what knowledge is worth pursuing from
the accepted current-view state. It may combine:

- Constellation Reading-frontier demand, preserving Constellation-owned
  structural provenance;
- useful Explorer context around represented positions;
- supplementary engine or Masters evidence;
- Root enrichment and other view-local enrichment.

Planning does not make Nodus an acquisition owner. Current View maps demand onto
opaque keyed source work and coordinates live participation; providers and
Knowledge Acquisition retain source meaning, fallback/retry policy, and durable
reconciliation behavior.

A source name, task key, provider type, or mere run ownership cannot manufacture
structural criticality. Only a Constellation-admitted obligation participates in
structural settlement.

## Settlement coordination

[Settled](../glossary.md#settled) is derived, not stored as a second mutable
truth. Constellation exposes the structural facts that could still change its
shape, most importantly its Reading frontier. The active refinement run exposes
what is happening to the corresponding admitted obligations.

A frontier obligation keeps the current view structurally Settling while its
run participation is actively working, waiting on a semantic retry gate, or has
completed successfully but still awaits incorporation. It stops blocking only
when recomposition incorporates the result or makes the obligation irrelevant,
or when a lower boundary reports semantic terminal unavailability for that
run's structural obligation.

Terminal unavailability is run-local coordination state. It does not remove the
position from Constellation's Reading frontier as structural knowledge, create
synthetic Evidence, alter ChartedGraph, or persist into PositionRepository. A
replacement refinement run begins without the old run's discharge and may try
again under normal source policy.

A failed supplementary task does not affect structural settlement. A retryable
failure is not terminal unavailability and remains Settling while a legitimate
progress path exists. Current View must not infer retryability or terminality
from HTTP status, UI strings, or raw transport errors; the lower boundary that
owns fallback/recovery policy must keep retrying internally or expose a semantic
outcome and wakeup/eligibility condition.

Successful structural completion still requires incorporation. Completion marks
settlement dirty and requests recomposition; a trustworthy in-flight composition
may publish, but Weather cannot claim Settled while a completed relevant result
still awaits incorporation.

## Publication boundary

- Current-view commands enter the Current View controller/coordinator;
  contributors return values; Current View publishes immutable snapshots; Lens
  and renderer delegates consume them.
- Current View is the sole owner allowed to make an asynchronous domain result
  current. Revision/currentness tokens and publication decisions remain private.
- Recenter selects another canonical position as the Nodus. A played Move is
  first materialized into ChartedGraph; a known canonical target may be selected
  directly.
- Root/Line mode is Current View state, not Nodus identity and not a Lens
  preference. Lens consumes mode as presentation context when deriving geometry
  and capacities.
- `RouteLedger` owns serialization/restoration of `{center, view}`, private
  browser-entry ancestry metadata, and Back availability. URL co-location does
  not transfer semantic ownership of Nodus or mode to RouteLedger.
- Constellation derives one coherent accepted subgraph for the active Current
  View inputs. Root context and Lines are roles inside that value.
- Structure and Rail contributors may read durable graph/source facts or request
  semantic Evidence, but derivation does not itself own source acquisition.
- Evidence remains independently addressable by canonical position or Graph Edge.
  Presentation may join current Evidence onto accepted visible relationships
  without making Evidence part of Constellation identity.
- Rail inventory remains independent of Constellation presentation capacity and
  is recomputed from available graph/source facts and Evidence rather than
  owning hydration.
- Relevant completion may trigger broad recomposition rather than fragile exact
  invalidation. Same-turn completions may coalesce; a completion during
  recomposition dirties settlement so another pass follows.
- Publication and settlement are separate decisions. A trustworthy accepted
  Constellation may remain visible and interactive while the refinement run is
  still structurally Settling.
- Accepted supplementary lookahead remains outside structural settlement.
- Missing cloud evaluation is outside structural settlement; currently available
  engine Evidence may influence composition, but acquiring it does not keep or
  reopen settlement by itself.
- A material Lens capacity change recomposes the same Nodus and may admit new
  structural obligations. A presentation-only relayout redraws without changing
  composition or refinement demand.
- Lens and renderer delegates consume the published Current View snapshot without
  keeping a second mutable copy of current-view truth.

## Published snapshot

The renderer-facing snapshot is an aggregate, not an ownership object. It may
contain values from several authorities, for example:

- Nodus canonical position and active mode from Current View;
- accepted Constellation and Rail from Current View;
- presentation Evidence decoration read through Evidence;
- structural readiness derived from accepted Constellation plus the active
  refinement run;
- orientation from Lens;
- Back availability from RouteLedger.

Publishing values together does not make them share identity or lifetime.
Internal task keys, run/revision tokens, browser-history bookkeeping, source
transport state, persistence mechanics, DOM handles, and Chessground instances
remain private.

## Verification

Deterministic/browser contract tests should cover:

- Nodus remaining exactly one canonical position while Current View owns mode,
  accepted Constellation/Rail state, and refinement lifetime;
- Recenter replacing the Nodus and refinement run while refresh replaces only the
  run and preserves the established same-Nodus accepted view;
- mode switching preserving the Nodus and recomposing one accepted Constellation
  rather than creating a second semantic Nodus projection;
- Constellation Reading-frontier admission retaining structural provenance through
  refinement planning and live participation;
- provider/task identity being unable to manufacture structural criticality;
- a trustworthy accepted view remaining interactive while structural refinement
  is active or retry-waiting;
- a completed structural result remaining unsettled until recomposition
  incorporates it or makes its obligation irrelevant;
- semantic terminal unavailability discharging only the matching run-local
  structural obligation without manufacturing Evidence or durable knowledge;
- replacement runs being free to try a previously unavailable Reading again;
- supplementary work/failure remaining outside structural settlement;
- obsolete completion, retry gates, and unavailable outcomes being unable to
  mutate a replacement view/run;
- Lens-owned orientation/presentation state and RouteLedger-owned browser state
  remaining outside accepted-view and Nodus identity;
- Evidence remaining readable independently of Constellation;
- current-view relevance and structural settlement remaining separate from
  reusable PositionRepository producer/cache lifetime;
- published snapshots aggregating authoritative values without duplicating their
  mutable ownership.
