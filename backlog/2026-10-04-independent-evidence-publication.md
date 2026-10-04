# Do:

Remove the remaining Constellation-shaped Evidence lifecycle from `NodusController` now that Evidence itself is independently addressable.

The controller should not require a structure value in order to derive Evidence, should not queue Evidence behind successful Constellation composition, and should not publish one opaque per-projection `evidence` object merely because presentation wants annotations for visible relationships.

Let presentation obtain the Evidence it needs by canonical position/Graph Edge and join it to visible relationship identity outside the Evidence component. Preserve current-view cancellation/currentness so stale presentation work cannot decorate a replacement view.

# Because:

The Evidence dependency inversion is already landed: `src/evidence-source.ts` exposes passive semantic reads by position/Graph Edge, Constellation requests Evidence while building Candidates, Rail requests Evidence for row semantics, and relationship-id joining lives in presentation glue.

`NodusController` still carries the old architecture, however. `EvidenceInput` contains `structure`; each projection owns an `evidence` lifecycle; `#queueEvidence()` waits for ready structure; `#deriveEvidence()` passes Constellation structure into the contributor; and `NodusSnapshot` publishes that structure-shaped Evidence lifecycle.

That remaining lifecycle is no longer the Evidence component, but it still encodes the old assumption that Evidence comes into existence as a projection of an already-built Constellation.

# Edges:

Do not move Evidence meaning into Interface or renderer code. Evidence continues to own semantic calculation; presentation only asks for semantic values and maps them onto visible UI identity.

Do not make presentation-owned Evidence acquisition start source work. Evidence reads remain passive over currently available provider/cache facts; Nodus refinement/source planning remains the place that requests acquisition.

Preserve stale-result rejection. If presentation performs asynchronous passive Evidence reads, those reads need a view-local cancellation/currentness boundary so an old Nodus cannot decorate the replacement UI.

Rail remains an independent Nodus-level projection and may continue asking Evidence directly. Constellation likewise remains free to ask Evidence during Candidate construction. Removing the controller lifecycle must not create shared mutable Evidence state between those consumers.

This outcome is separate from structural settlement. Supplementary Evidence presentation must not control Weather either before or after this cleanup.

# Unsettled:

Choose the smallest presentation boundary after removing `NodusSnapshot.evidence`. Options include giving the presenter/renderer an Evidence reader scoped to the current view, or publishing independently keyed passive Evidence values that do not accept Constellation structure. Prefer the option that leaves current-view truth singular and avoids a second mutable presentation cache.

Decide where passive presentation Evidence failures are surfaced. They should degrade only the affected annotations/guide channels rather than the Constellation or global Weather.

# Complete:

`NodusController` no longer has `EvidenceInput.structure`, per-mode `evidenceTails`, or a structure-gated Evidence derivation lifecycle.

Deterministic/browser coverage proves that:

- Evidence can be presented for a position/edge without constructing a Constellation-shaped Evidence aggregate;
- presentation joins semantic Evidence to visible relationships outside Evidence;
- stale passive Evidence results cannot decorate a replacement Nodus;
- Constellation and Rail can request the same semantic Evidence independently;
- missing/failed supplementary Evidence does not fail structure or reopen Weather;
- no Evidence API accepts Constellation structure or visible relationship identity.

# Sync:

After any implementation or verification step that changes what remains, and before ending an implementation pass, synchronize this entry. Also synchronize when an action completes or becomes unavailable, a blocking condition changes, or a judgment is settled. Rewrite around the factual work and verification still open; do not accumulate progress history. If the completion condition is satisfied, run Backlog Close. If Close cannot pass its normal gates, leave the entry open with the blocking condition explicit.
