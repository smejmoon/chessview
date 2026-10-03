# Current view

Own the application boundary that decides which asynchronous domain results are allowed to become part of the current Nodus-centered view.

This architecture coordinates product components without owning their product meaning. [Nodus](../components/nodus.md) owns Recenter semantics, [Constellation](../components/constellation.md) owns visible-subgraph composition and supplementary lookahead relevance, [Evidence](../components/evidence.md) owns evidence meaning, [Rail](../components/rail.md) owns the supporting control/evidence surface, [Weather](../components/weather.md) owns structural readiness semantics, and [Interface](../components/interface.md) owns two-dimensional presentation.

## Settlement rule

**A Nodus does not reload as knowledge arrives. It settles: the best trustworthy view stays interactive while new facts refine it in place.**

A current Nodus has one run-scoped settlement boundary. Structure, Rail, and Evidence derive the best values they can from facts already available; they do not own independent hydration loops, progress callbacks, or provider subscriptions. Source-specific planning outside those projections nominates opaque refinement tasks for the run. `NodusController` knows only that a keyed task belongs to the current run and has settled; it does not route Explorer, Masters, or evaluation payloads between consumers.

When one or more run-owned refinement tasks settle, the controller coalesces their completions and recomputes the current Nodus from facts now available. Both sibling Constellation projections, their Evidence, and Nodus-level Rail may therefore improve together without a dependency-routing graph saying which source completion belongs to which consumer.

Settlement never downgrades an established trustworthy value to loading. While refinements are pending, structure, Rail, and Evidence remain usable at their last accepted values and the published view exposes only a separate `settling` activity fact for Weather/presentation. A failed supplementary refinement leaves established values current; only failure to establish a trustworthy required value for a new Nodus can make that value failed.

## Publication boundary

- Current-view commands enter `NodusController`; projection contributors return values; the controller publishes immutable current-view values; presentation consumes them.
- `NodusController` is the sole owner allowed to make an asynchronous domain result current. Internal revision identity and publication decisions stay private to that boundary.
- One Nodus-centered run carries sibling Root and Line Constellation projections. The active Root/Line mode selects which sibling presentation consumes; changing mode alone does not replace the Nodus, discard the other projection, restart acquisition, or redefine Nodus-level Rail values.
- Structure, Rail, and Evidence contributors are projections over current facts. They may read provider `current`/durable values and durable graph state, but they do not start source acquisition or subscribe to source notifications as part of composition.
- Source-specific refinement planning nominates run-owned work such as Explorer acquisition/reconciliation, cloud evaluation, Masters retrieval, or Root enrichment. The planner supplies opaque stable task keys and work functions; `NodusController` does not know source payload semantics.
- Acquisition demanded by the active Root/Line projection is foreground current-view work. Useful acquisition for the inactive sibling may continue in the background. Dynamic participation priority may follow the live active mode without creating a second producer identity.
- When refinement work settles, recomposition is deliberately broader than exact invalidation. The controller may recompute both sibling projections, Rail, and Evidence from current facts because avoiding source-to-consumer routing is more valuable than minimizing every pure derivation.
- Same-turn or otherwise overlapping completions are coalesced behind one settlement pass. If recomputation yields the same published snapshot, no presentation update is required.
- An accepted Constellation projection may nominate bounded supplementary lookahead. Lookahead remains outside settlement prerequisites; its completion may improve later navigation but does not keep the current Nodus unsettled.
- Rail inventory and tab counts are Nodus-level current-view values, independent of active Constellation mode and presentation-space capacity. Rail is recomputed from available facts when the Nodus settles rather than hydrating itself.
- Publication and settlement are separate decisions. A trustworthy value may publish while refinement tasks that can improve it remain unresolved.
- One run may publish successive accepted immutable values as trustworthy structural, Rail, or Evidence facts become available. The previously published value remains current until a replacement is fully derived and accepted.
- Explicit refresh starts a replacement run for the same Nodus but preserves the established trustworthy snapshot while the replacement derivation/refinement proceeds. Refresh is not a command to bypass provider freshness policy.
- Recenter or history restoration to another recorded Nodus starts a replacement run. Before accepting any result or settlement, the controller checks that it still belongs to that run. Obsolete completion cannot mutate, refine, or settle the replacement view.
- Every user Recenter command enters the controller through Nodus behavior. A known canonical target may be accepted directly; a played Move is first materialized into [ChartedGraph](../components/charted-graph.md). `NodusController` also owns the RouteLedger restoration subscription for its lifetime.
- The published current view exposes the current Nodus, active mode, active Constellation projection, accepted Evidence, Nodus-level Rail, and settlement/Weather state. Internal task keys, revision tokens, inactive-work bookkeeping, request scheduling, persistence mechanics, DOM handles, and Chessground instances stay private.
- Presentation-only preferences such as Root/Line mode, orientation, Guide, or Debug may redraw/select already-current state without becoming a replacement Nodus run.
- Presentation consumes the published current view without keeping a second mutable copy of that truth.

## Reusable producer lifetime

Current-view lifetime and reusable acquisition lifetime are separate. A run signal expresses current-view relevance; it does not redefine provider freshness or source-cache semantics.

[`PositionRepository`](position-repository.md) owns shared per-position facet producer lifetime. Multiple live participants for the same source facet share one producer. Their effective transport urgency is the highest live demand; joining or leaving may promote or demote queued work without replacing the producer. [Knowledge acquisition](../components/knowledge-acquisition.md) owns durable reconciliation behavior when an Explorer observation is deliberately reconciled into graph knowledge.

Run-owned settlement does not require provider event subscriptions. The controller already knows when work it owns has settled, then recomputes projections from provider current/durable facts. Provider-local current state may keep a freshly usable observation available even when persistence fails, but that observation state is not a second authoritative durable cache.

Constellation lookahead separately keeps its existing bounded detached-warm semantics: nomination relevance may disappear with the old accepted projection, while already-started supplementary warming may retain its bounded reusable lifetime.

## Verification

Deterministic/browser contract tests should cover:

- a trustworthy current Nodus being published and remaining interactive while run-owned refinement is pending;
- `settling` driving non-blocking Updating presentation without changing an accepted structure/Rail/Evidence lifecycle back to loading;
- run-owned refinement settlement recomputing current projections from facts now available;
- multiple same-turn completions coalescing into one settlement recomputation;
- unchanged recomputation producing no redundant current-view publication;
- refinement failure preserving established trustworthy values while ending only the failed task's participation;
- explicit refresh retaining the established same-Nodus snapshot until a replacement value is accepted;
- one Nodus run maintaining sibling Root and Line projections while mode switching selects between them without restarting the run;
- active-projection demand receiving foreground precedence over queued inactive-sibling demand without duplicate source producers;
- Rail deriving from available graph/source/evidence facts without owning acquisition, progress callbacks, or provider subscriptions;
- Constellation exposing missing graph-bearing facts as refinement frontier rather than fetching them during composition;
- accepted Constellation lookahead remaining supplementary to publication and settlement;
- obsolete run completion being unable to mutate, refine, publish, or settle a replacement Nodus;
- RouteLedger restoration entering through `NodusController` without creating another history entry and being detached on disposal;
- published current-view values containing product state rather than task keys, generation tokens, source transport state, or DOM identity;
- current-view relevance remaining separate from reusable producer/cache lifetime.
