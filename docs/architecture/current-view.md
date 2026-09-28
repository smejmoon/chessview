# Current view

Own the application boundary that decides which asynchronous domain results are allowed to become part of the current Nodus-centered view.

This architecture coordinates product components without owning their product meaning. [Nodus](../components/nodus.md) owns Recenter semantics, [Constellation](../components/constellation.md) owns visible-subgraph composition, [Evidence](../components/evidence.md) owns evidence meaning, [Rail](../components/rail.md) owns the supporting control/evidence surface, [Weather](../components/weather.md) owns structural readiness semantics, and [Interface](../components/interface.md) owns two-dimensional presentation.

## Publication boundary

- Current-view commands enter `NodusController`; domain contributors return values; the controller publishes one immutable current view; presentation consumes it.
- `NodusController` is the sole owner allowed to make an asynchronous domain result current. Internal revision identity and publication decisions stay private to that boundary.
- Structural and evidence contributors receive explicit domain inputs and return values keyed by stable position, node, or edge identity. They do not discover current application state from shared DOM or mutable module globals.
- Every user Recenter command enters the controller through Nodus behavior. A known canonical target may be accepted directly; a played Move is first materialized by the Position Graph. Browser-history restoration enters separately as recorded route state and does not create another history entry.
- Before accepting an asynchronous result, the controller checks that the result still belongs to the current view. Completion from obsolete work cannot mutate or settle a replacement view.
- The published current view contains the current Nodus-centered product state plus the Constellation, accepted evidence, Rail inputs, and Weather state for that view.
- Browser-history metadata, persistence mechanisms, request scheduling, generation/revision tokens, DOM handles, and Chessground instances remain outside the published current-view value.
- Presentation-only preferences such as Guide or Debug may persist independently and request a redraw without becoming current-view truth.
- Presentation consumes the published current view without keeping a second mutable copy of that truth.

## Reusable producer lifetime

Current-view lifetime and reusable acquisition lifetime are separate. A view-scoped cancellation signal may detach an obsolete caller from work it no longer needs without implying that the view owns or cancels reusable enrichment still needed elsewhere.

[`PositionRepository`](position-repository.md) owns shared per-position facet producer lifetime. [Knowledge acquisition](../components/knowledge-acquisition.md) owns durable enrichment/reconciliation behavior. This architecture owns only the rule that current-view obsolescence must not turn a view into the lifetime owner of reusable producers.

## Verification

Deterministic/browser contract tests should cover:

- obsolete asynchronous completion being unable to mutate or settle a replacement view;
- browser-history restoration remaining distinct from a new Recenter command;
- one immutable published current-view value carrying accepted Nodus, Constellation, Evidence/Rail inputs, and Weather state without DOM or generation-token identity;
- contributors returning domain values without reading mutable presentation state;
- an obsolete caller detaching from reusable acquisition while equivalent work can remain useful to another live caller or later view.
