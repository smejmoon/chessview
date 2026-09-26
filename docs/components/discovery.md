# Discovery

## Purpose

Own how Chessview learns useful nearby graph structure and chooses a branch-balanced visible neighborhood.

## Requirements

- Opening Explorer statistics are fetched for a position when the required cached data is stale or missing.
- A fresh cached Explorer snapshot is reconciled into persisted outgoing edges before discovery relies on those edges, so cached source data can repair missing or corrupted materialized graph state without another network request.
- Refreshing a source position reconciles its Explorer-derived edges against the latest response: stale automatic edges are removed while manual/explicit and derived edges are preserved.
- A move qualifies for automatic expansion when it accounts for at least 5% of games at its immediate source position and the source has a meaningful sample.
- Qualification is local to each source position; percentages are not multiplied cumulatively from the Nodus.
- Sub-5% moves contribute to an aggregated “other moves” share rather than automatic expansion.
- Discovery has no arbitrary opening-depth cap. Practical limits come from the visible-board budget, sample floor, and obsolete-work cancellation.
- Recentring cancels discovery work that is no longer useful.
- Known Root context receives part of the visible budget before deeper Lines consume it.
- Each qualifying first-level Line receives a fair first slot before remaining capacity is spent deeper.
- Remaining Line capacity is spent round-robin across first-level Lines, with deterministic ordering and a preference for useful narrow continuations before excessive breadth from one bushy branch.
- Qualifying siblings must remain discoverable when capacity remains; discovery must not collapse a Line to a single descendant spine.
- Each known immediate Root receives a fair first slot before one Root family consumes deeper ancestry.
- Remaining Root capacity is spent round-robin across immediate Root families, shallow-first within each family.
- When Root families reach the same canonical upstream position, that position is represented once. The visible structure keeps every visible downstream edge into the converged position, and ancestry above the convergence is shared rather than duplicated per Root family.
- The desktop neighborhood is capped at 19 surrounding boards with smaller responsive budgets.

## Discovery flow

1. Canonicalize and persist the current Nodus.
2. Load the Nodus's rated Explorer data through the Lichess access component when needed.
3. Reconcile either the fresh cached Explorer snapshot or a newly fetched response into Explorer-derived outgoing edges while preserving non-automatic graph knowledge.
4. Mark locally qualifying moves using the threshold and sample floor.
5. Advance deterministic per-first-level-Line frontiers while useful capacity remains.
6. Stop a Line frontier when its source sample becomes too small or its work becomes obsolete.
7. Select known Root ancestry with fair per-immediate-Root frontiers, merging canonical transpositions instead of duplicating them.
8. Combine known Root context and discovered Line context into the visible branch-balanced neighborhood.

## Line frontier policy boundary

`src/line-frontier.js` is the single owner of within-Line scheduling shared by automatic discovery and visible Line-neighborhood selection. It decides which pending candidate inside one first-level Line is considered next; its callers decide what that candidate means operationally.

A frontier candidate carries a canonical position `key` plus scheduling metadata:

- `depth` — distance from the Nodus within that Line;
- `breadth` — accumulated sibling rank along the candidate's path. The first child adds `0`, later siblings add their deterministic child index, and descendants inherit the accumulated value.

The current deterministic priority is `depth + breadth`, lower first. Equal priorities prefer the deeper candidate, then preserve insertion order. This gives a useful narrow continuation some opportunity to deepen while each additional ply raises its priority cost, allowing waiting siblings to become competitive instead of being starved indefinitely.

The frontier intentionally does **not** own move qualification, canonical/transposition deduplication, request or board budgets, cancellation, Explorer loading, persistence, or presentation. Callers also supply candidates in stable edge order before adding them to a frontier. Automatic discovery and visible-neighborhood selection therefore share one scheduling policy without sharing their lifecycle or side effects.

## Root frontier policy boundary

`chooseRootNeighborhood` owns visible Root scheduling over already-known incoming graph state. Unlike Line discovery, Root selection does not fetch recursively while it schedules, so it uses a simpler policy: one shallow-first FIFO frontier per immediate Root, with one new visible position taken from each frontier per round.

Canonical position identity is global across those Root frontiers. If another frontier reaches a position that is already visible, the position does not consume another board slot. Instead its additional downstream edge and Root-family membership are merged into the existing visible entry. Any ancestry selected above that convergence inherits the full set of Root families that have converged there.

The Root scheduler owns fairness and visible canonical merging only. Incoming-edge discovery, transposition derivation, board budget, rendering, move cues, and layout remain with their existing owners.

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
- round-robin use of remaining Line capacity;
- a bushy Line with multiple qualifying children so siblings are not starved by single-spine traversal;
- fair immediate-Root representation and round-robin deeper ancestry across Root families;
- shallow-first ordering within a Root family;
- a canonical ancestor reached through multiple Root families appearing once while retaining all visible downstream edges and shared family ownership;
- capacity limits and Root-budget reservation.

Manual verification should include a broad opening, a narrow forcing Line whose local percentages remain high, and a practical transposition reached through different move orders.
