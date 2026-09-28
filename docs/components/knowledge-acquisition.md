# Knowledge acquisition

## Purpose

Own how Chessview obtains or derives information that adds to or reconciles durable position/edge knowledge and evidence.

Knowledge acquisition is independent from what the current view ultimately shows. A request may acquire more information than the resulting [Constellation](constellation.md) contains.

## Requirements

- Knowledge acquisition may fetch, derive, hydrate, or reconcile graph and evidence information needed by product components.
- Acquired position and edge knowledge is reconciled against canonical graph identity rather than stored as view-local duplicates.
- Rated Lichess Explorer snapshots may add or refresh Explorer-backed outgoing edges and their statistical evidence.
- A usable cached Explorer snapshot is reconciled into persisted graph state before a caller relies on it, so cached source data can repair missing or corrupted materialized Explorer-derived edges without requiring another network request.
- Refreshing Explorer data may remove stale Explorer-only knowledge while preserving explicit/manual and independently derived graph provenance.
- Acquisition and visibility are separate decisions. Neither the current visible-space budget nor omission from a Constellation limits what may be acquired or retained.
- Constellation may request information for one position or a larger graph region. Knowledge acquisition owns how that request is fulfilled; request granularity does not change the durable ownership boundary.
- Automatic Constellation discovery is currently bounded by the rated Lichess Explorer data available to Chessview. Knowledge acquisition is not required to search beyond that source merely to determine whether an otherwise unknown-frequency move deserves automatic visibility.
- Explicit Move materialization remains a Position Graph operation. It may establish durable graph knowledge even when the move is outside automatic Constellation selection.
- Transport, scheduling, and Lichess request policy continue to follow the Lichess access and `LichessGateway` boundaries.

## Verification

Deterministic tests should cover:

- acquisition adding or reconciling durable knowledge without requiring that knowledge to become visible;
- cached Explorer data repairing persisted Explorer-derived graph state without a network request;
- Explorer refresh replacing stale statistical evidence while preserving explicit/manual and derived provenance;
- acquisition of a graph region larger than the current Constellation without visibility side effects;
- explicitly materialized moves remaining durable independently of automatic Constellation eligibility.
