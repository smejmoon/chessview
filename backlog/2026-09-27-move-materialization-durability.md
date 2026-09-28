# Do:

Finish the durability proof for played-Move materialization: deterministically inject target-position establishment failure and show no durable edge is created, then verify the branch tests/build.

# Because:

`docs/components/position-graph.md` §Requirements says materialization ensures both the durable graph edge and the target position record. `src/move-materialization.js::materializeMove()` now delegates target-record establishment to `PositionRepository.ensure(target)` before calling `putManualEdge(edge)`, so target-write failure cannot leave an edge pointing at a missing target. This also leaves `PositionRepository` responsible for deciding how an existing canonical position record is preserved and how its playable FEN is derived.

# Edges:

Preserve Position Graph ownership of materialization and `PositionRepository` ownership of application-level node records. Recenter continues to consume the materialized result rather than participating in persistence. Existing Explorer evidence/provenance on an already-known edge must still survive explicit materialization.

The chosen target-first ordering intentionally does not make node and edge creation atomic: if edge persistence fails after a previously missing target is established, the target node may remain without that outgoing edge. That state is graph-consistent because no durable edge points at a missing node; the backlog's required invariant does not require rolling the standalone node back.

# Unsettled:

Confirm with deterministic fault injection that `PositionRepository.ensure(target)` failure prevents `putManualEdge(edge)` from creating a durable edge. Confirm the new ordering test is deterministic under fake IndexedDB rather than depending on callback timing.

# Complete:

A deterministic fault-injection test demonstrates that any failed target establishment leaves no durable edge whose target position record is missing; successful materialization still preserves existing statistical evidence/provenance and returns the canonical target expected by Resolve Move; deterministic tests/build pass.

# Steps:

Add the target-establishment failure-path test and adjust the ordering test if needed for deterministic IndexedDB observation.

Run deterministic tests/build and resolve any failures without moving node-record ownership out of `PositionRepository`.

# Sync:

After any implementation or verification step that changes what remains, and before ending an implementation pass, rewrite this entry around the factual work and verification still open; do not accumulate progress history. If `Complete:` is satisfied, run Backlog Close. If Close cannot pass its normal gates, leave the entry open with the blocking condition explicit.
