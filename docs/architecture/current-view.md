# Current view

Own the application boundary that decides which asynchronous domain results are allowed to become part of the current Nodus-centered view.

This architecture coordinates product components without owning their product meaning. [Nodus](../components/nodus.md) owns Recenter semantics, [Constellation](../components/constellation.md) owns visible-subgraph composition and supplementary lookahead relevance, [Evidence](../components/evidence.md) owns evidence meaning, [Rail](../components/rail.md) owns the supporting control/evidence surface, [Weather](../components/weather.md) owns structural readiness semantics, and [Interface](../components/interface.md) owns two-dimensional presentation.

## Publication boundary

- Current-view commands enter `NodusController`; domain contributors return values; the controller publishes immutable current-view values; presentation consumes them.
- `NodusController` is the sole owner allowed to make an asynchronous domain result current. Internal revision identity and publication decisions stay private to that boundary.
- One Nodus-centered generation may carry sibling Root and Line Constellation projections. The active Root/Line mode selects which sibling projection presentation consumes; changing mode alone does not create a replacement Nodus generation, discard the other projection, restart acquisition, or redefine Nodus-level Rail values.
- Acquisition demanded by the active Root/Line projection is foreground current-view work. Useful acquisition for an inactive sibling may continue opportunistically in the background, but queued background work must yield the next available Lichess transport slot to foreground demand. This demand classification follows the live active mode so a queued shared acquisition can become foreground or background without restarting its projection.
- An accepted Constellation projection may nominate bounded supplementary lookahead. The controller may keep only the lookahead participation that remains relevant to the current accepted projection; refinement, mode changes, or Recenter may replace that participation without making warmed source data view-local or deleting reusable producer state.
- Supplementary lookahead is never part of the publication or settlement prerequisites for the projection that nominated it. Its completion may improve later navigation, but its pending or failed state does not delay publication or keep Weather unsettled.
- Rail inventory and tab counts are Nodus-level current-view input, independent of the active Constellation projection and of presentation-space capacity. Rail may refine while its underlying source/graph/evidence information is still arriving, but mode selection itself does not invalidate it.
- Publication and settlement are separate decisions. A trustworthy current-generation result may be accepted and published while structural work that can still improve it remains unresolved; [Weather](../components/weather.md) communicates that unsettled state.
- One current-view generation may publish successive accepted values as trustworthy structural, Rail, or evidence information arrives. Each accepted replacement is a new immutable value for that same generation rather than mutation of the previously published value.
- Structural, Rail, and evidence contributors receive explicit domain inputs and return values keyed by stable position, node, or edge identity. They do not discover current application state from shared DOM or mutable module globals.
- Every user Recenter command enters the controller through Nodus behavior. A known canonical target may be accepted directly; a played Move is first materialized into [ChartedGraph](../components/charted-graph.md). `NodusController` also owns the RouteLedger restoration subscription for its lifetime, so browser-history restoration enters the same command boundary as recorded route state while remaining distinct from Recenter and creating no additional history entry.
- Recenter, history restoration to another recorded Nodus state, or explicit refresh may start a replacement generation. Before accepting any asynchronous result, including refinement of either sibling projection, the controller checks that the result still belongs to the current generation. Completion from obsolete work cannot mutate, refine, or settle a replacement view.
- The published current view exposes the current Nodus, active presentation mode, the active sibling Constellation projection, accepted evidence for that projection, Nodus-level Rail input, and Weather state. The inactive sibling projection and lookahead participation may remain private controller state.
- Browser-history metadata, persistence mechanisms, request scheduling, generation/revision tokens, speculative lookahead bookkeeping, DOM handles, and Chessground instances remain outside the published current-view value.
- Presentation-only preferences such as Root/Line mode, board orientation, Guide, or Debug may persist independently. Changing a presentation-only preference may redraw or select already-current state without becoming a new Nodus generation.
- Presentation consumes the published current view without keeping a second mutable copy of that truth.

## Reusable producer lifetime

Current-view lifetime and reusable acquisition lifetime are separate. A view-scoped cancellation signal may detach an obsolete caller from work it no longer needs without implying that the view owns or cancels reusable enrichment still needed elsewhere.

[`PositionRepository`](position-repository.md) owns shared per-position facet producer lifetime. When multiple live callers share one producer, its effective transport urgency is the highest current demand among those callers; joining or leaving the shared work may therefore promote or demote queued transport without replacing the producer. [Knowledge acquisition](../components/knowledge-acquisition.md) owns durable reconciliation behavior and fulfillment of nominated source work. This architecture owns only the rule that current-view obsolescence must not turn a view into the lifetime owner of reusable producers or cached source data.

Constellation lookahead therefore behaves as participation, not ownership: the current view may express ephemeral background demand for reusable source work and later withdraw that demand. Equivalent foreground demand can join the same producer and promote its effective urgency; withdrawing obsolete lookahead cannot cancel work that another live caller still needs.

## Verification

Deterministic/browser contract tests should cover:

- a trustworthy current-generation result being publishable before that generation is structurally settled;
- accepted refinement publishing a replacement immutable current-view value within the same generation;
- one Nodus generation maintaining sibling Root and Line projections while Root/Line switching selects between them without recomputing solely because the mode changed;
- active-projection acquisition receiving foreground precedence over queued speculative sibling work, including promotion of already-shared queued work when mode demand changes;
- accepted Constellation lookahead remaining supplementary to publication and Weather, with obsolete lookahead participation being replaceable when the accepted projection changes;
- foreground demand for a position already being warmed sharing and promoting the same reusable producer rather than creating duplicate source work;
- settled Nodus-level Rail input surviving Root/Line display switching while being replaced on Recenter to another Nodus;
- obsolete asynchronous completion being unable to mutate, refine, or settle a replacement view;
- RouteLedger history restoration entering through `NodusController`, remaining distinct from a new Recenter command, and being detached when the controller is disposed;
- one immutable published current-view value carrying accepted Nodus, active Constellation projection, Evidence, Rail input, and Weather state without DOM, generation-token, or lookahead-bookkeeping identity;
- contributors returning domain values without reading mutable presentation state;
- an obsolete caller detaching from reusable acquisition while equivalent work can remain useful to another live caller or later view.
