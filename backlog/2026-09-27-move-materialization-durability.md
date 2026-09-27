# Do:

Make played-Move materialization preserve graph consistency when one durable write fails, so Chessview cannot leave an edge durably pointing at a target position record that was never established.

# Because:

`docs/components/position-graph.md` §Requirements says materialization ensures both the durable graph edge and the target position record. `src/move-materialization.js::materializeMove()` currently stores the edge first with `putManualEdge(edge)` and only afterward calls `positionRepository.merge(target, { fen })`; failure of that second step can therefore leave only half of the required durable fact.

# Edges:

Preserve Position Graph ownership of materialization and `PositionRepository` ownership of application-level node records. Recenter must continue to consume the materialized result rather than becoming part of the persistence transaction. Existing Explorer evidence/provenance on an already-known edge must still survive explicit materialization.

# Unsettled:

Choose the consistency mechanism: one IndexedDB transaction spanning the necessary stores, target-first write ordering with proven safe semantics, or compensating cleanup on failure.

Decide what durable invariant should be asserted when the target record already exists or the edge is being promoted from Explorer provenance.

# Complete:

A deterministic fault-injection test demonstrates that any failed materialization leaves no durable edge whose target position record is missing; successful materialization still preserves existing statistical evidence/provenance and returns the canonical target expected by Resolve Move.

# Steps:

Map the current `putManualEdge`, `PositionRepository.merge`, and IndexedDB transaction boundaries.

Implement the smallest consistency mechanism that preserves current ownership and evidence semantics.

Add failure-path and existing-edge tests, then run deterministic tests/build.

# Sync:

After any implementation or verification step that changes what remains, and before ending an implementation pass, rewrite this entry around the factual work and verification still open; do not accumulate progress history. If `Complete:` is satisfied, run Backlog Close. If Close cannot pass its normal gates, leave the entry open with the blocking condition explicit.
