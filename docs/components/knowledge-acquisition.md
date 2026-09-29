# Knowledge acquisition

## Purpose

Own how Chessview obtains or derives information that adds to durable position/edge knowledge and refreshes attached evidence.

Knowledge acquisition is independent from what the current view ultimately shows. A request may acquire more information than the resulting [Constellation](constellation.md) contains.

## Terms

**Explorer Reading** is the usable rated Lichess Explorer evidence for one canonical source position at one fetch/cache point: the source-position totals plus the returned moves and their human-game statistics. An Explorer Reading is refreshable source evidence, not durable graph identity. A later Reading may change statistics or omit a move without retracting graph knowledge already established from an earlier Reading.

**Edge Admission** is the one-time acquisition decision that allows a previously unknown legal relationship observed in an Explorer Reading to enter Chessview's durable `PositionGraph`. Once admitted, the edge is known topology; later Readings refresh evidence on it but do not re-admit or revoke it.

## Requirements

- Knowledge acquisition may fetch, derive, hydrate, or reconcile graph and evidence information needed by product components.
- Acquired position and edge knowledge is reconciled against canonical graph identity rather than stored as view-local duplicates.
- The legal chess graph is fixed by chess rules, while Chessview's persisted graph is a monotonically discovered useful subset. Acquisition may add newly established legal positions/edges but does not retract already-known topology during ordinary refresh.
- Automatic Edge Admission is an acquisition decision. The current rule uses source-sample sufficiency only: once an Explorer Reading meets the tunable acquisition sample floor, every legal relationship returned by that Reading may be admitted. A move's local share is not an Edge Admission threshold.
- When an Explorer Reading is below the acquisition sample floor, unknown returned relationships are not automatically admitted, but any returned relationship that is already known still receives refreshed mutable statistics.
- Edge Admission is separate from Constellation selection. Admission must not silently become a visibility threshold, and rare admitted relationships remain available for rescue behavior required by [Constellation selection](constellation-selection.md).
- Rated Lichess Explorer Readings may add newly admitted outgoing edges and refresh statistical evidence on already-known outgoing edges.
- When an Explorer Reading contains a move for an already-known edge, acquisition updates that edge's current statistical fields even if the move would not qualify for Edge Admission if it were still unknown.
- Omission from a later Explorer Reading, a lower frequency, or falling below a later threshold does not mean the legal relationship ceased to exist. Acquisition leaves the durable edge in place; absence from the new Reading supplies no replacement statistics for that edge.
- A usable cached Explorer Reading is reconciled into persisted graph state before a caller relies on it, so cached source data can repair missing materialization and refresh known-edge statistics without requiring another network request.
- Refreshing Explorer data preserves explicit/manual and independently derived graph provenance while updating mutable statistics for returned known edges.
- Acquisition and visibility are separate decisions. Acquisition itself does not inspect the current visible-space budget or Constellation membership to decide which relationships a requested Explorer Reading may admit or retain.
- Constellation may request an Explorer Reading for one position or request Readings incrementally while composing a larger graph region. Knowledge acquisition owns how each request is fulfilled; the caller owns whether another Reading can still affect its result.
- Automatic Constellation discovery is currently bounded by the rated Lichess Explorer data available to Chessview. Knowledge acquisition is not required to search beyond that source merely to determine whether an otherwise unknown-frequency move deserves automatic visibility.
- Explicit Move materialization remains a Position Graph operation. It may establish durable graph knowledge even when the move is outside automatic acquisition or Constellation selection.
- Transport, scheduling, and Lichess request policy continue to follow the Lichess access and `LichessGateway` boundaries.

## Verification

Deterministic tests should cover:

- acquisition adding durable knowledge without requiring that knowledge to become visible;
- a sufficiently sampled Explorer Reading admitting a rare returned legal relationship without a move-share cutoff;
- an insufficiently sampled Explorer Reading declining Edge Admission for an unknown relationship while still refreshing returned known edges;
- cached Explorer data repairing persisted graph state without a network request;
- Explorer refresh updating statistics on returned known edges while preserving explicit/manual and derived provenance;
- a previously materialized edge remaining durable when a later Explorer Reading omits it;
- a previously materialized edge remaining durable when refreshed statistics fall below a rule that would govern a still-unknown relationship;
- concurrent provenance addition and Explorer statistical refresh retaining both results;
- acquisition from a selected source learning more outgoing relationships than the current Constellation shows;
- a caller stopping further Explorer Reading requests once additional outgoing knowledge cannot change its current structural result;
- explicitly materialized moves remaining durable independently of automatic Constellation eligibility.
