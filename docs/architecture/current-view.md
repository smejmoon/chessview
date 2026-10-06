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
Refresh or failed refinement must not erase an established trustworthy value that
still represents the current inputs.

### Spatial projection validity

The accepted spatial Constellation has an explicit validity key: **Nodus plus
Root/Line mode**. Preservation follows that semantic key rather than the command
path that happened to start work.

- Refresh keeps the same projection inputs. The established Constellation remains
  accepted while a replacement refinement run derives a newer value.
- Recomposition after new knowledge or a material Lens-capacity change also keeps
  the same Nodus and mode. The established Constellation remains accepted until a
  coherent replacement is ready; derivation failure leaves the established value
  usable.
- A Root/Line mode change keeps the Nodus but changes the spatial question being
  asked. The old Constellation is not relabeled as the new mode's projection; the
  new spatial projection is established before becoming accepted.
- Recenter changes the Nodus and therefore establishes a new accepted spatial
  projection.
- Browser-history restoration applies the same rule to the restored inputs: an
  exact same-Nodus/same-mode restoration may preserve the established projection
  while refreshing it; a different Nodus or mode establishes a new projection.

There is still one semantically current Constellation around the one Nodus.
Root/Line mode changes what context is composed; it does not create a second
Nodus or a sibling accepted lifetime. An implementation may cache derivations for
another mode, but that cache is not another accepted current view and does not own
settlement.

Rail has a different validity boundary. Its inventory is Nodus-scoped, so an
accepted Rail may remain useful across a same-Nodus Root/Line transition while the
new Constellation is established. A different Nodus establishes new Rail state.
Presentation Evidence decoration is projection-facing and may update independently
as richer values arrive, but it must not be carried onto a spatial projection it
does not describe.

Lens orientation/Guide/Debug and browser-history state are outside accepted-view
identity. Current View may publish Lens orientation and `RouteLedger.canGoBack()`
as renderer-facing affordances without becoming their authority.

## Refinement run

A **refinement run** is the replaceable child lifetime representing what Current
View is presently trying to improve about its accepted view.

Run-local state includes cancellation/currentness, live refinement
participation, structural provenance carried from Constellation admission,
working/retry-waiting/satisfied/unavailable/failed execution phases, successful
structural work still awaiting a settlement recomposition, and recomposition
scheduling. This state is coordination state, not Nodus identity and not durable
chess knowledge.

Explicit refresh keeps the same accepted projection while replacing the
refinement run. Recenter or restoration to a different Nodus replaces the Nodus,
accepted spatial projection, and refinement run. Mode change establishes a new
spatial projection for the same Nodus. An obsolete run cannot mutate, publish
into, or settle its replacement.

Reusable source producer/cache lifetime remains separate. [`PositionRepository`](position-repository.md)
owns shared per-position facet producers and participants may detach from them;
providers own source-specific policy and `LichessGateway` owns transport policy.
A refinement run owns only its current-view participation and interpretation of
semantic run outcomes supplied by those lower boundaries.

## Refinement planning

Current-view refinement planning derives what work is worth pursuing from the
accepted current-view state. It may combine:

- Constellation Reading-frontier demand, preserving Constellation-owned
  structural provenance;
- useful Explorer context around represented positions;
- supplementary engine or Masters evidence;
- Root enrichment and other view-local enrichment;
- bounded sampled-game Root bootstrap when Root context has no authoritative incoming topology.

Planning does not make Nodus an acquisition owner. Current View maps demand onto
opaque keyed refinement work and coordinates run-local participation. Planning
is a synchronous, side-effect-free derivation from the accepted structure:
planning never waits; the refinement work it describes may wait. A newly
composed ready structure has its refinement participation reconciled before that
structure is published, so a published Reading frontier has already had the
opportunity to acquire matching structural participation.

Some refinement work joins reusable source acquisition owned by
PositionRepository and source providers; other refinement work, such as
graph/topology enrichment, may have a different producer lifetime. Providers and
Knowledge Acquisition retain source meaning, freshness/fallback/retry policy,
and durable reconciliation behavior.

When Root context has no authoritative incoming topology, planning may nominate bounded sampled-game bootstrap work. The bootstrap reuses representative game IDs from the center Explorer Reading, batch-exports/replays them to discover predecessor source positions, then asks ordinary Explorer refinement to reconcile those sources. The sampled games themselves never become accepted topology or quantitative Evidence. Once a predecessor Reading is reconciled, its outgoing graph knowledge naturally supplies both the Root relationship and sibling relationships from that source.

A source name, task key, provider type, or mere run ownership cannot manufacture
structural criticality. Only a Constellation-admitted obligation participates in
structural settlement. Currently Explorer Reading refinement may carry that
structural provenance; cloud evaluation, Masters, root-transposition enrichment,
and lookahead remain supplementary unless a separate contract explicitly admits
them structurally.

## Settlement coordination

[Settled](../glossary.md#settled) is derived, not stored as a second mutable
truth. Constellation exposes the structural facts that could still change its
shape, most importantly its Reading frontier. The active refinement run exposes
whether the current attempt still has an automatic progress witness for the
corresponding admitted obligation.

A frontier obligation keeps the accepted projection structurally Settling while
its current participation is actively working, waiting on a semantic retry gate,
or has completed successfully and still has a settlement recomposition pending.
A nonzero Reading frontier alone is not a progress witness.

Successful execution and pending incorporation are deliberately separate. A
participant may remain `satisfied` as run history after the settlement drain has
attempted recomposition. Before that drain, Current View marks the successful
structural participant as **incorporation pending** and Weather remains Updating.
After the corresponding recomposition attempt completes, that pending marker is
consumed. If the same Reading remains on the accepted frontier, the old success
no longer proves that this run can automatically advance it; another new result
or replacement run is required to create a new progress path.

A semantic terminal-unavailable outcome also stops the matching run-local
structural obligation from blocking. The chess fact remains unknown and may remain
on Constellation's Reading frontier. Unavailability does not create synthetic
Evidence, alter ChartedGraph, persist into PositionRepository, or become a durable
source conclusion. A replacement refinement run begins without the old run's
discharge and may try again under normal source policy.

A retryable result is not terminal unavailability. It remains Settling while its
lower-owned retry gate can wake another attempt. Current View must not infer
retryability or terminality from HTTP status, UI strings, or raw transport
errors; the lower boundary that owns fallback/recovery policy must keep retrying
internally or expose a semantic outcome and wakeup/eligibility condition.

`failed` and `unplanned` are terminal coordination diagnostics for the current
automatic settlement cycle, not source unavailability and not progress witnesses.
A failed participant has no automatic retry path unless a lower-owned retry gate
was supplied; an unplanned frontier Reading means the synchronous planning result
did not attach current participation. Neither keeps primary Weather Updating by
itself. A later refresh, replacement run, or genuinely changed plan may create a
new progress path without reclassifying either condition as unavailable chess
knowledge.

Supplementary completion or failure does not affect structural settlement merely
because it belongs to the same refinement run.

## Publication boundary

- Current-view commands enter the Current View controller/coordinator;
  contributors return values; Current View publishes immutable snapshots; Lens
  and renderer delegates consume them.
- Current View is the sole owner allowed to make an asynchronous domain result
  current. Revision/currentness tokens and publication decisions remain private.
- A newly composed ready Constellation is planned and its refinement participation
  reconciled synchronously before publication. Publication must not expose the
  transient gap between structural admission and participation attachment.
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
  Constellation may remain visible and interactive while its same projection is
  structurally Settling.
- Accepted supplementary lookahead remains outside structural settlement.
- Missing cloud evaluation is outside structural settlement; currently available
  engine Evidence may influence composition, but acquiring it does not keep or
  reopen settlement by itself.
- A material Lens capacity change recomposes the same projection and may admit new
  structural obligations. A presentation-only relayout redraws without changing
  composition or refinement demand.
- Current View may publish aggregate Weather diagnostics derived from the accepted
  Reading frontier and active-run participation. Those diagnostics expose counts
  and phases only; task keys, Reading identities, source/provider names, and
  revision tokens remain private.
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
- aggregate Weather diagnostics such as accepted-structure lifecycle, Reading
  frontier size, structural participation counts by phase, incorporation-pending
  count, detached structural participation, and supplementary active/total counts;
- orientation from Lens;
- Back availability from RouteLedger.

The diagnostic aggregate is deliberately lossy. It exists so Weather/Debug can
show several measures during development without exporting the identity or
provider details of the refinement run and without becoming another mutable owner
of settlement.

Publishing values together does not make them share identity or lifetime.
Internal task keys, run/revision tokens, browser-history bookkeeping, source
transport state, persistence mechanics, DOM handles, and Chessground instances
remain private.

## Verification

Deterministic/browser contract tests should cover:

- Nodus remaining exactly one canonical position while Current View owns mode,
  accepted Constellation/Rail state, and refinement lifetime;
- refresh and same-mode recomposition preserving an established coherent spatial
  projection while a replacement is derived;
- mode switching and Nodus changes establishing a new spatial projection instead
  of relabeling an old one;
- same-Nodus/same-mode history restoration preserving the accepted projection and
  same-Nodus/different-mode restoration preserving Rail but not spatial structure;
- Constellation Reading-frontier admission retaining structural provenance through
  synchronous refinement planning and live participation;
- no ready Constellation publication occurring between frontier admission and
  refinement-participation reconciliation;
- failed structural participation and unplanned frontier demand remaining visible
  as coordination diagnostics without falsely implying automatic progress;
- provider/task identity being unable to manufacture structural criticality;
- a trustworthy accepted projection remaining interactive while structural
  refinement is active or retry-waiting;
- a completed structural result remaining unsettled exactly while its settlement
  recomposition is pending, then ceasing to block solely because its old success
  remains recorded;
- semantic terminal unavailability discharging only the matching run-local
  structural obligation without manufacturing Evidence or durable knowledge;
- replacement runs being free to try a previously unavailable Reading again;
- supplementary work/failure remaining outside structural settlement;
- obsolete completion, retry gates, and unavailable outcomes being unable to
  mutate a replacement view/run;
- aggregate Weather diagnostics distinguishing working, retry-waiting, satisfied,
  incorporation-pending, unavailable, failed, unplanned, detached, and
  supplementary participation without exposing task/position identity;
- Lens-owned orientation/presentation state and RouteLedger-owned browser state
  remaining outside accepted-view and Nodus identity;
- Evidence remaining readable independently of Constellation;
- current-view relevance and structural settlement remaining separate from
  reusable PositionRepository producer/cache lifetime;
- empty Root context being allowed to bootstrap from bounded sampled games without treating a sampled predecessor as graph truth;
- sampled predecessor discovery flowing back through ordinary Explorer reconciliation, with one predecessor Reading able to establish both Root and sibling topology;
- published snapshots aggregating authoritative values without duplicating their
  mutable ownership.
