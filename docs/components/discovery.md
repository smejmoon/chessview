# Discovery

## Purpose

Own how Chessview learns useful nearby graph structure and chooses a branch-balanced visible neighborhood.

## Requirements

- Opening Explorer statistics are fetched for a position when the required cached data is stale or missing.
- A fresh cached Explorer snapshot is reconciled into persisted outgoing edges before discovery relies on those edges, so cached source data can repair missing or corrupted materialized graph state without another network request.
- Refreshing a source position reconciles its Explorer-derived edges against the latest response: stale automatic edges are removed while manual/explicit and derived edges are preserved.
- A move qualifies for automatic expansion when it accounts for at least 5% of games at its immediate source position and the source has a meaningful sample.
- Qualification is local to each source position; percentages are not multiplied cumulatively from the center.
- Sub-5% moves contribute to an aggregated “other moves” share rather than automatic expansion.
- Discovery has no arbitrary opening-depth cap. Practical limits come from the visible-board budget, sample floor, and obsolete-work cancellation.
- Recentring cancels discovery work that is no longer useful.
- Known Root context receives part of the visible budget before deeper Lines consume it.
- Each qualifying first-level Line receives a fair first slot before remaining capacity is spent deeper.
- Remaining Line capacity is spent round-robin across first-level Lines, with deterministic ordering and a preference for useful narrow continuations before excessive breadth from one bushy branch.
- Qualifying siblings must remain discoverable when capacity remains; discovery must not collapse a Line to a single descendant spine.
- The desktop neighborhood is capped at 19 surrounding boards with smaller responsive budgets.

## Discovery flow

1. Canonicalize and persist the current center position.
2. Load the center's rated Explorer data through the Lichess access component when needed.
3. Reconcile either the fresh cached Explorer snapshot or a newly fetched response into Explorer-derived outgoing edges while preserving non-automatic graph knowledge.
4. Mark locally qualifying moves using the threshold and sample floor.
5. Advance deterministic per-first-level-Line frontiers while useful capacity remains.
6. Stop a frontier when its source sample becomes too small or its work becomes obsolete.
7. Combine known Root context and discovered Line context into the visible branch-balanced neighborhood.

## Tunables

- Automatic move threshold: `0.05`.
- Automatic expansion sample floor: initially `80` games.
- Surrounding-board budget: responsive, capped at `19` on desktop.

The 5% local automatic-expansion threshold is a product commitment. The sample floor and responsive board budget are implementation tunables.

## Verification

Deterministic tests should cover:

- local 5% qualification;
- sample-floor stopping;
- Explorer edge reconciliation, including stale automatic-edge removal and manual-edge preservation;
- fresh cached Explorer snapshots repairing persisted outgoing-edge state without a network request;
- cancellation of stale discovery work;
- deterministic branch ordering;
- fair first slots across multiple first-level Lines;
- round-robin use of remaining capacity;
- a bushy Line with multiple qualifying children so siblings are not starved by single-spine traversal;
- capacity limits and Root-budget reservation.

Manual verification should include a broad opening, a narrow forcing Line whose local percentages remain high, and a practical transposition reached through different move orders.
