# Current view

Own the application boundary that decides which asynchronous domain results are allowed to become part of the current Nodus-centered view.

This architecture coordinates product components without owning their product meaning. [Nodus](../components/nodus.md) owns Recenter semantics, [Constellation](../components/constellation.md) owns visible-subgraph composition and structural settlement of its shape, [Evidence](../components/evidence.md) owns evidence meaning, [Rail](../components/rail.md) owns the supporting control/evidence surface, [Weather](../components/weather.md) presents structural settlement/readiness, and [Interface](../components/interface.md) owns two-dimensional presentation.

## Settlement coordination

[Settled](../glossary.md#settled) is a domain property, not a synonym for task completion. The current-view boundary coordinates asynchronous work and incorporation so the active Constellation can reach its contractual fixed point; it does not define settlement from controller activity.

Structure, Rail, and Evidence derive the best values they can from facts already available; they do not own independent hydration loops, progress callbacks, or provider subscriptions. Source-specific planning outside those projections may nominate opaque keyed work for the current run. Run ownership, a pending task, or a provider request is not by itself a structural settlement obligation.

Only an admitted obligation capable of changing the active Constellation participates in structural settlement. A completed structural result remains part of that settlement obligation until the current-view boundary has recomputed and accepted the active Constellation with that result incorporated. Supplementary work may still cause Evidence or Rail to become richer, but it does not keep or retroactively make an otherwise Settled active Constellation unsettled.

The controller may coordinate structural and supplementary work without learning source payload semantics. The planner must preserve the domain distinction between work that can still change the active Constellation and work that is merely useful; the controller must not infer structural criticality from a source name, task key, or mere run ownership.

Settlement never downgrades an established trustworthy value to loading. While the active Constellation is Settling, structure, Rail, and Evidence remain usable at their last accepted values. When the active Constellation is Settled, supplementary work may continue without changing Weather.

## Publication boundary

- Current-view commands enter `NodusController`; projection contributors return values; the controller publishes immutable current-view values; presentation consumes them.
- `NodusController` is the sole owner allowed to make an asynchronous domain result current. Internal revision identity and publication decisions stay private to that boundary.
- One Nodus-centered run carries sibling Root and Line Constellation projections. The active Root/Line mode selects which sibling presentation consumes; changing mode alone does not replace the Nodus, discard the other projection, restart acquisition, or redefine Nodus-level Rail values. Structural settlement follows the newly active Constellation.
- Structure, Rail, and Evidence contributors are projections over current facts. They may read provider `current`/durable values and durable graph state, but they do not start source acquisition or subscribe to source notifications as part of composition.
- Source-specific planning may nominate work such as Explorer acquisition/reconciliation, cloud evaluation, Masters retrieval, or Root enrichment. A nomination participates in structural settlement only when the active Constellation contract admits it as capable of changing current shape.
- Acquisition demanded by the active Root/Line projection may receive foreground current-view priority. Useful acquisition for the inactive sibling may continue in the background, but inactive-sibling work does not by itself keep the active Nodus structurally Settling. Dynamic participation priority may follow the live active mode without creating a second producer identity.
- When relevant facts become available, recomposition may deliberately be broader than exact invalidation. The controller may recompute both sibling projections, Rail, and Evidence because avoiding source-to-consumer routing is more valuable than minimizing every pure derivation.
- Same-turn or otherwise overlapping structural completions may be coalesced behind one recomputation, but Weather must not claim Settled while a completed relevant structural result still awaits incorporation. If recomputation yields the same published snapshot, no presentation update is required.
- An accepted Constellation projection may nominate bounded supplementary lookahead. Lookahead remains outside structural settlement; its completion may improve later navigation but does not keep the active Nodus unsettled.
- Missing cloud evaluation is outside structural settlement. Engine evidence already admitted when composition is derived may affect selection, but supplementary cloud-evaluation acquisition does not keep or reopen an otherwise Settled active Constellation by itself.
- Rail inventory and tab counts are Nodus-level current-view values, independent of active Constellation mode and presentation-space capacity. Rail is recomputed from available facts when relevant results are incorporated rather than owning hydration itself.
- Publication and settlement are separate decisions. A trustworthy value may publish while the active Constellation is Settling; supplementary Evidence/Rail values may also publish after structural settlement.
- One run may publish successive accepted immutable values as trustworthy structural, Rail, or Evidence facts become available. The previously published value remains current until a replacement is fully derived and accepted.
- A material change to effective presentation constraints invalidates the sibling Constellation derivations for the same Nodus without starting a replacement run. The active projection is recomposed against the new constraints while the previously accepted structure remains usable; any newly admitted structural obligations may make it Settling again. The inactive sibling may be recomposed independently in the same run. A presentation-only redraw does not recompose Constellation or create settlement work.
- Explicit refresh starts a replacement run for the same Nodus but preserves the established trustworthy snapshot while the replacement derivation proceeds. Refresh is not a command to bypass provider freshness policy.
- Recenter or history restoration to another recorded Nodus starts a replacement run. Before accepting any result or settlement state, the controller checks that it still belongs to that run. Obsolete completion cannot mutate, refine, or settle the replacement view.
- Every user Recenter command enters the controller through Nodus behavior. A known canonical target may be accepted directly; a played Move is first materialized into [ChartedGraph](../components/charted-graph.md). `NodusController` also owns the RouteLedger restoration subscription for its lifetime.
- The published current view exposes the current Nodus, active mode, active Constellation projection, accepted Evidence, Nodus-level Rail, and structural settlement/Weather state. Internal task keys, revision tokens, inactive-work bookkeeping, request scheduling, persistence mechanics, DOM handles, and Chessground instances stay private.
- Presentation-only preferences such as Root/Line mode, orientation, Guide, or Debug may redraw/select already-current state without becoming a replacement Nodus run.
- Presentation consumes the published current view without keeping a second mutable copy of that truth.

## Reusable producer lifetime

Current-view lifetime and reusable acquisition lifetime are separate. A run signal expresses current-view relevance; it does not redefine provider freshness or source-cache semantics.

[`PositionRepository`](position-repository.md) owns shared per-position facet producer lifetime. Multiple live participants for the same source facet share one producer. Their effective transport urgency is the highest live demand; joining or leaving may promote or demote queued work without replacing the producer. [Knowledge acquisition](../components/knowledge-acquisition.md) owns durable reconciliation behavior when an Explorer observation is deliberately reconciled into graph knowledge.

Structural settlement does not require provider event subscriptions. The controller already knows when work it coordinates completes and can recompute projections from provider-current/durable facts as appropriate. Provider-local current state may keep a freshly usable observation available even when persistence fails, but that observation state is not a second authoritative durable cache.

Constellation lookahead separately keeps its existing bounded detached-warm semantics: nomination relevance may disappear with the old accepted projection, while already-started supplementary warming may retain its bounded reusable lifetime.

## Verification

Deterministic/browser contract tests should cover:

- a trustworthy current Nodus being published and remaining interactive while its active Constellation is Settling;
- structural settlement following obligations that can change the active Constellation rather than generic run-owned task activity;
- a completed structural result remaining unsettled until recomputation incorporates it;
- overlapping structural completions being coalesced without publishing Settled before every completed relevant result is incorporated;
- supplementary engine/Masters work continuing or completing after settlement without reopening structural Weather;
- unchanged recomputation producing no redundant current-view publication;
- supplementary failure preserving established trustworthy values without becoming a structural failure;
- explicit refresh retaining the established same-Nodus snapshot until a replacement value is accepted;
- changed effective presentation constraints recomposing the active Constellation in the same Nodus run, with a newly exposed Reading frontier able to make it Settling again;
- presentation-only redraw leaving Constellation derivation and acquisition unchanged;
- one Nodus run maintaining sibling Root and Line projections while mode switching selects between them without restarting the run and settlement follows the newly active projection;
- active-projection demand receiving foreground precedence over queued inactive-sibling demand without duplicate source producers;
- inactive-sibling work not keeping the active Nodus structurally Settling by itself;
- Rail deriving from available graph/source/evidence facts without owning acquisition, progress callbacks, or provider subscriptions;
- Constellation exposing missing graph-bearing facts as a Reading frontier rather than fetching them during composition;
- a Reading-frontier structural completion being incorporated before settlement is claimed;
- accepted Constellation lookahead remaining supplementary to structural settlement;
- obsolete run completion being unable to mutate, refine, publish, or settle a replacement Nodus;
- RouteLedger restoration entering through `NodusController` without creating another history entry and being detached on disposal;
- published current-view values containing product state rather than task keys, generation tokens, source transport state, or DOM identity;
- current-view relevance and structural settlement remaining separate from reusable producer/cache lifetime.
