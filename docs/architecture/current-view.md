# Current view

Own the application boundary that decides which asynchronous domain results are allowed to become part of the current Nodus-centered view.

This architecture coordinates product components without owning their product meaning. [Nodus](../components/nodus.md) owns Recenter semantics and current-Nodus refinement demand, [Constellation](../components/constellation.md) owns visible-subgraph composition and admission of structural obligations that can still change its shape, [Evidence](../components/evidence.md) owns independently addressable semantic evidence by position/Graph Edge, [Rail](../components/rail.md) owns the supporting Line inventory/evidence surface, [Weather](../components/weather.md) presents structural settlement/readiness, and [Interface](../components/interface.md) owns two-dimensional presentation.

## Settlement coordination

[Settled](../glossary.md#settled) is a domain property, not a synonym for task completion. The current-view boundary coordinates asynchronous work and incorporation so the current Constellation can reach its contractual fixed point; it does not define settlement from controller activity.

Constellation and Rail derive the best values they can from facts already available. Evidence is not a downstream Constellation projection: consumers request Evidence directly by canonical position or Graph Edge, and Evidence never needs a Constellation to exist. None of these components owns independent hydration loops, progress callbacks, or provider subscriptions. Nodus derives current-Nodus refinement demand from the current position-centered state. The current-view boundary translates that demand into opaque keyed work for the current run. Run ownership, a pending task, or a provider request is not by itself a structural settlement obligation.

Only an obligation admitted by the current Constellation as capable of changing its shape participates in structural settlement. Nodus preserves that structural provenance when combining demand. A completed structural result remains part of that settlement obligation until the current-view boundary has recomputed and accepted the Constellation with that result incorporated, unless the replacement composition establishes that the obligation is no longer relevant to constrained shape. Supplementary work may make later Evidence or Rail richer, but it does not keep or retroactively make an otherwise Settled Constellation unsettled.

The controller may coordinate structural and supplementary work without learning source payload semantics. Nodus demand must preserve the domain distinction between Constellation-admitted structural need and merely useful enrichment; the controller must not infer structural criticality from a source name, task key, provider type, or mere run ownership.

Settlement never downgrades an established trustworthy value to loading. While the Constellation is Settling, accepted structure and Rail remain usable; presentation may continue using previously accepted Evidence decoration until a replacement decoration is available. When the Constellation is Settled, supplementary work may continue without changing Weather.

When coordinated refinement finishes, current-view requests recomposition. A completion that arrives while recomposition is running marks settlement dirty so another pass follows; overlapping completions may coalesce. The in-flight recomposition remains eligible to publish if it is trustworthy. If a completed structural result was not visible to that composition and its obligation remains relevant, the Constellation's Reading frontier remains open and the published replacement remains Settling. A later pass may clear settlement only after the structural result is incorporated or the obligation is no longer relevant to the new shape.

## Publication boundary

- Current-view commands enter `NodusController`; contributors return values; the controller publishes immutable current-view values; presentation consumes them.
- `NodusController` is the sole owner allowed to make an asynchronous domain result current. Internal revision identity and publication decisions stay private to that boundary.
- One Nodus-centered run carries one Constellation projection. Forward Lines and optional Root/sibling context are composition roles inside that value rather than sibling Root/Line projections.
- Root-context visibility is a current-view presentation preference. Changing it alone does not replace the Nodus or restart the run, but it changes Constellation composition inputs and therefore requests same-Nodus recomposition.
- Constellation requests Evidence while deriving Candidates. Rail requests Evidence for the Graph Edges in its independent Line inventory. A presentation adapter may join independently read Evidence onto currently visible relationship IDs for rendering. That adapter depends on both presentation structure and Evidence; Evidence itself depends on neither Constellation nor relationship identity.
- Structure and Rail contributors may read durable graph/source facts or request semantic Evidence, but they do not start source acquisition or subscribe to source notifications as part of derivation.
- Nodus refinement demand may request work such as Explorer acquisition/reconciliation, cloud evaluation, Masters retrieval, or Root enrichment. Constellation Reading-frontier demand carries structural provenance because Constellation admitted it as capable of changing current shape; other useful Nodus demand remains supplementary unless a Constellation contract admits it structurally.
- Current-view execution maps Nodus demand onto provider/source operations and keyed work. That mapping owns deduplication and execution mechanics, not the domain decision that the work is relevant or structural.
- When relevant facts become available, recomposition may deliberately be broader than exact invalidation. The controller may rederive Constellation, Rail, and presentation Evidence from current facts rather than maintaining fragile source-to-consumer routing.
- Same-turn or otherwise overlapping refinement completions may be coalesced. A completion during recomposition causes another pass after the current one rather than invalidating a trustworthy in-flight result. Intermediate replacements may publish, but Weather must not claim Settled while a completed relevant structural result still awaits incorporation. If recomposition yields the same published snapshot, no presentation update is required.
- An accepted Constellation may nominate bounded supplementary lookahead. Lookahead remains outside structural settlement; its completion may improve later navigation but does not keep the Nodus unsettled.
- Missing cloud evaluation is outside structural settlement. Engine Evidence already available when composition is derived may affect selection, but supplementary cloud-evaluation acquisition does not keep or reopen an otherwise Settled Constellation by itself.
- Rail inventory is a Nodus-level current-view value, independent of Constellation presentation capacity and Root-context visibility. Rail is recomputed from available graph/source facts and requested Evidence rather than owning hydration itself.
- Publication and settlement are separate decisions. A trustworthy value may publish while the Constellation is Settling; supplementary Rail or Evidence presentation may also become richer after structural settlement.
- One run may publish successive accepted immutable values as trustworthy structural or Rail facts become available. Presentation may independently redecorate those accepted values from currently available Evidence without making Evidence itself part of Constellation identity.
- A material change to effective presentation capacities or Root-context visibility invalidates the Constellation derivation for the same Nodus without starting a replacement run. The previous accepted structure remains usable while recomposition proceeds; any newly admitted structural obligations may make the Nodus Settling again. A presentation-only redraw does not recompose Constellation or create settlement work.
- Explicit refresh starts a replacement run for the same Nodus but preserves the established trustworthy snapshot while the replacement derivation proceeds. Refresh is not a command to bypass provider freshness policy.
- Recenter or history restoration to another recorded Nodus starts a replacement run. Before accepting any result or settlement state, the controller checks that it still belongs to that run. Obsolete completion cannot mutate, refine, or settle the replacement view.
- Every user Recenter command enters the controller through Nodus behavior. A known canonical target may be accepted directly; a played Move is first materialized into [ChartedGraph](../components/charted-graph.md). `NodusController` also owns the RouteLedger restoration subscription for its lifetime.
- The published current view exposes the current Nodus, Root-context visibility, Constellation, Nodus-level Rail, presentation Evidence decoration where useful, and structural settlement/Weather state. Internal task keys, revision tokens, request scheduling, persistence mechanics, DOM handles, and Chessground instances stay private.
- Presentation-only preferences such as orientation, Guide, or Debug may redraw already-current state without becoming a replacement Nodus run. Root-context visibility is distinct because it changes Constellation membership.
- Presentation consumes the published current view without keeping a second mutable copy of current-view truth.

## Reusable producer lifetime

Current-view lifetime and reusable acquisition lifetime are separate. A run signal expresses current-view relevance; it does not redefine provider freshness or source-cache semantics.

[`PositionRepository`](position-repository.md) owns shared per-position facet producer lifetime. Multiple live participants for the same source facet share one producer. Their effective transport urgency is the highest live demand; joining or leaving may promote or demote queued work without replacing the producer. [Knowledge acquisition](../components/knowledge-acquisition.md) owns durable reconciliation behavior when an Explorer observation is deliberately reconciled into graph knowledge.

Structural settlement does not require provider event subscriptions. The controller already knows when work it coordinates completes and can trigger fresh component derivations from provider-current/durable facts as appropriate. Provider-local current state may keep a freshly usable observation available even when persistence fails, but that observation state is not a second authoritative durable cache.

Constellation lookahead separately keeps its existing bounded detached-warm semantics: nomination relevance may disappear with the old accepted projection, while already-started supplementary warming may retain its bounded reusable lifetime.

## Verification

Deterministic/browser contract tests should cover:

- Nodus deriving current-Nodus refinement demand while current-view execution only maps that demand to work;
- Constellation Reading-frontier admission retaining structural provenance through Nodus demand into current-view coordination;
- provider/task identity being unable to manufacture structural criticality;
- Evidence being readable by position/Graph Edge without a Constellation and having no Constellation dependency;
- Constellation and Rail independently requesting Evidence rather than duplicating evidence calculation rules;
- presentation joining Evidence to visible relationship identity outside the Evidence component;
- a trustworthy current Nodus being published and remaining interactive while its Constellation is Settling;
- structural settlement following obligations that can change the Constellation rather than generic run-owned task activity;
- a completed structural result remaining unsettled until recomputation incorporates it or makes the obligation irrelevant;
- overlapping refinement completions being coalesced without creating a false Settled interval;
- a refinement completion arriving during recomposition causing another pass while an intermediate replacement that did not incorporate a still-relevant obligation remains Settling;
- supplementary engine/Masters work continuing or completing after settlement without reopening structural Weather;
- unchanged recomputation producing no redundant current-view publication;
- supplementary failure preserving established trustworthy values without becoming a structural failure;
- explicit refresh retaining the established same-Nodus snapshot until a replacement value is accepted;
- changed effective presentation capacities recomposing the Constellation in the same Nodus run, with a newly exposed Reading frontier able to make it Settling again;
- Root-context visibility changes recomposing the same Constellation without starting a replacement Nodus run;
- presentation-only redraw leaving Constellation derivation and acquisition unchanged;
- Rail deriving graph/source Line inventory and requesting Evidence without owning acquisition, progress callbacks, or provider subscriptions;
- Constellation exposing missing graph-bearing facts as a Reading frontier rather than fetching them during composition;
- a Reading-frontier structural completion being incorporated before settlement is claimed while that obligation remains relevant;
- accepted Constellation lookahead remaining supplementary to structural settlement;
- obsolete run completion being unable to mutate, refine, publish, or settle a replacement Nodus;
- RouteLedger restoration entering through `NodusController` without creating another history entry and being detached on disposal;
- published current-view values containing product state rather than task keys, generation tokens, source transport state, or DOM identity;
- current-view relevance and structural settlement remaining separate from reusable producer/cache lifetime.
