# Do:

Add user-controlled Constellation zoom so the map can trade board scale for visible graph coverage. As the effective presentation-space constraint changes, Constellation may add or remove surrounding boards dynamically while preserving the same Nodus and durable graph knowledge.

# Because:

The number of boards in the Constellation is intentionally presentation-dependent. A user should eventually be able to zoom the map to see a broader or narrower coherent subgraph without changing what the Rail knows about the Nodus.

Rail inventory and tab counts are independent of Constellation capacity under `docs/components/rail.md`: zoom may change which boards are visible, but it must not change settled Rail rows or counts merely because the map scale changed.

# Edges:

Constellation continues to own coherent visible-subgraph membership; Lens owns the upstream/downstream regions, board coordinates, scale, capacity derivation, and connector geometry. Zoom must vary that one presentation model rather than introduce a second placement or capacity system. Zoom changes presentation constraints and may cause Constellation recomposition, but it does not redefine canonical graph identity.

If a wider zoom exposes a structural frontier that requires additional source knowledge, normal Constellation/Knowledge Acquisition boundaries continue to apply. Zoom itself does not become a source client or persistence mechanism.

This outcome is not a mobile-layout requirement. Touch/pinch interaction may be considered when mobile support becomes a target, but desktop zoom can complete independently.

# Complete:

At one unchanged Nodus, changing zoom changes board scale and can deterministically add or remove Constellation boards according to the authoritative presentation-space constraints. Root/Line geometry and connectors remain coherent, durable graph knowledge is unchanged, and settled Rail inventory/counts remain unchanged solely because of zoom.

# Sync:

After any implementation or verification step that changes what remains, and before ending an implementation pass, synchronize this entry. Also synchronize when an action completes or becomes unavailable, a blocking condition changes, or a judgment is settled. Rewrite around the factual work and verification still open; do not accumulate progress history. If an outcome's completion condition is satisfied, run Backlog Close for that outcome. If Close cannot pass its normal gates, leave the entry open with the blocking condition explicit.
