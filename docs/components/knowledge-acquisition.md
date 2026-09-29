# Knowledge acquisition

## Purpose

Own how Chessview obtains or derives information that adds to durable position/edge knowledge and refreshes attached evidence.

Knowledge acquisition is independent from what the current view ultimately shows. A request may acquire more information than the resulting [Constellation](constellation.md) contains.

## Requirements

- Knowledge acquisition may fetch, derive, hydrate, or reconcile graph and evidence information needed by product components.
- Acquired position and edge knowledge is reconciled against canonical graph identity rather than stored as view-local duplicates.
- The legal chess graph is fixed by chess rules, while Chessview's persisted graph is a monotonically discovered useful subset. Acquisition may add newly established legal positions/edges but does not retract already-known topology during ordinary refresh.
- Automatic first admission of a newly observed graph relationship is an acquisition decision. The admission rule may use rated-Explorer frequency, sample sufficiency, or another usefulness floor, but that rule is applied when deciding whether to materialize new topology; it is not a retention rule for an edge that is already known.
- The automatic-admission rule is separate from Constellation selection. It must not silently become a visibility threshold, and it must leave enough source data available for rare-candidate rescue behavior required by [Constellation selection](constellation-selection.md).
- Rated Lichess Explorer snapshots may add newly admitted outgoing edges and refresh statistical evidence on already-known outgoing edges.
- When an Explorer snapshot contains a move for an already-known edge, acquisition updates that edge's current statistical fields even if the move would no longer pass the first-admission rule.
- Omission from a later Explorer snapshot, a lower frequency, or falling below a later threshold does not mean the legal relationship ceased to exist. Acquisition leaves the durable edge in place; absence from the new snapshot supplies no replacement statistics for that edge.
- A usable cached Explorer snapshot is reconciled into persisted graph state before a caller relies on it, so cached source data can repair missing materialization and refresh known-edge statistics without requiring another network request.
- Refreshing Explorer data preserves explicit/manual and independently derived graph provenance while updating mutable statistics for returned known edges.
- Acquisition and visibility are separate decisions. Neither the current visible-space budget nor omission from a Constellation limits what may be acquired or retained.
- Constellation may request information for one position or a larger graph region. Knowledge acquisition owns how that request is fulfilled; request granularity does not change the durable ownership boundary.
- Automatic Constellation discovery is currently bounded by the rated Lichess Explorer data available to Chessview. Knowledge acquisition is not required to search beyond that source merely to determine whether an otherwise unknown-frequency move deserves automatic visibility.
- Explicit Move materialization remains a Position Graph operation. It may establish durable graph knowledge even when the move is outside automatic acquisition or Constellation selection.
- Transport, scheduling, and Lichess request policy continue to follow the Lichess access and `LichessGateway` boundaries.

## Verification

Deterministic tests should cover:

- acquisition adding durable knowledge without requiring that knowledge to become visible;
- cached Explorer data repairing persisted graph state without a network request;
- Explorer refresh updating statistics on returned known edges while preserving explicit/manual and derived provenance;
- a previously materialized edge remaining durable when a later Explorer snapshot omits it;
- a previously materialized edge remaining durable when refreshed statistics fall below the rule that would govern first admission;
- a newly observed legal relationship being added only when the acquisition admission decision permits it;
- concurrent provenance addition and Explorer statistical refresh retaining both results;
- acquisition of a graph region larger than the current Constellation without visibility side effects;
- explicitly materialized moves remaining durable independently of automatic Constellation eligibility.
