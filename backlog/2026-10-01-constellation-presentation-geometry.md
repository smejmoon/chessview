# Do:

Align Constellation sizing and Interface layout with the actual presentation space available to the map rather than the browser viewport as a proxy.

Have Interface derive the usable map constraints that matter to legible board placement and supply those constraints to Constellation composition. Unify Root and Line board placement around one authoritative presentation-geometry decision so center position, surrounding boards, and connector space do not independently compete for the same area.

# Because:

`docs/components/constellation.md` requires the amount shown to be constrained by available presentation space and legibility, and explicitly allows Presentation to provide the constraints needed to compose the view. `docs/components/interface.md` makes that responsibility explicit: Interface derives presentation-space constraints from the available viewport and supplies them to Constellation composition.

The current implementation does not yet match that contract. `src/main.ts::boardBudget()` derives a scalar capacity from `window.innerWidth * window.innerHeight`, before accounting for the actual map region left after the header and Rail. `src/nodus-renderer.js` places the generic/Line composition from viewport-width-based percentages, while `src/root-presentation.js::layoutRoots()` performs a second Root-specific geometry pass from DOM rectangles and `src/root-ui.css` overrides center positioning separately.

Narrow-screen screenshots exposed the mismatch as board collisions, clipping, and competing center/satellite placement. Mobile support is not the requirement here; the screenshots are evidence that the current geometry model can measure and allocate the wrong space. The same class of defect can appear on supported desktop layouts under unusual aspect ratios, zoom, split-screen, or future Rail changes.

# Edges:

The Candidate/composition ownership boundary is already landed in `docs/components/constellation-selection.md` and `docs/components/constellation.md`: selection constructs evidence-backed Candidates and supplies same-source order, while Constellation owns coherent cross-branch allocation under presentation constraints. This outcome may change which selected Candidates fit as available space changes, but it must not change Candidate eligibility, recreate explicit-navigation admission, or re-rank siblings from the same source.

Constellation continues to own which canonical positions and relationships belong in the coherent view. Interface continues to own two-dimensional coordinates, board sizes, and connector paths. This outcome is about making the constraint passed between those owners truthful and making presentation geometry internally coherent.

Rail inventory and tab counts are Nodus/source-level Rail facts under `docs/components/rail.md`, not presentation-capacity outputs. Changing map geometry may add, remove, or rearrange Constellation boards without changing settled Rail rows or counts.

The recomposition trigger boundary is settled: a material change in effective composition constraints rederives the sibling Constellations inside the existing Nodus run, while a viewport change that only affects placement redraws the accepted projection. Constraint-driven recomposition may expose new Reading-frontier work and therefore make the active Constellation Settling again; it is not a new Nodus run and does not make Rail capacity-dependent.

Do not make mobile support a completion dependency. A later mobile-specific interaction/layout outcome may choose a different presentation regime after this boundary is sound.

Future user-controlled Constellation zoom is tracked separately; this outcome establishes the truthful presentation-space/geometry boundary that zoom can later vary.

This outcome does not change ChartedGraph identity, Knowledge Acquisition, Explorer behavior, Rail evidence meaning, or Weather semantics.

# Unsettled:

Decide the smallest presentation-space contract Constellation needs in order to spend visible space correctly. A raw viewport-derived board count is insufficient; avoid inventing a richer geometry protocol than the composition decision actually needs.

Decide the single Interface owner for Root and Line placement so mode-specific semantics can differ without center/satellite geometry being independently authored by generic renderer code, Root decoration code, and CSS overrides.

# Complete:

The current view composes against constraints derived from the actual usable map presentation area rather than browser area alone, and deterministic/browser coverage proves that changing those constraints can change Constellation membership without changing durable graph knowledge or settled Rail inventory/counts.

Root and Line presentation consume one authoritative geometry source for center and surrounding-board placement; mode-specific layout semantics remain possible without conflicting independent placement rules.

Supported desktop layouts remain legible across materially different window shapes and Rail allocations, including cases that previously over-selected or overlapped boards because the viewport was larger than the usable map. Mobile-specific polish and interaction design may remain unfinished.

# Sync:

After any implementation or verification step that changes what remains, and before ending an implementation pass, synchronize this entry. Also synchronize when an action completes or becomes unavailable, a blocking condition changes, or a judgment is settled. Rewrite around the factual work and verification still open; do not accumulate progress history. If an outcome's completion condition is satisfied, run Backlog Close for that outcome. If Close cannot pass its normal gates, leave the entry open with the blocking condition explicit.
