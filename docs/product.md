# Chessview product contract

[Chessview vision](vision.md) owns durable product direction and the [glossary](glossary.md) owns canonical terms. This document owns the product-wide experience and flow conditions that must remain true. Component documents own detailed behavior and verification; architecture documents own technical boundaries; unfinished outcomes belong in `backlog/`.

## Core experience

Chessview is a position-centered spatial map. The Nodus is the reference point, meaningful Roots provide upstream context, meaningful Lines provide downstream possibilities, the Constellation keeps those relationships coherent, and the Rail supports inspection and navigation without becoming the map itself.

A user should be able to:

- understand where the Nodus came from and where play can go without reconstructing a move tree mentally;
- select a surrounding board or navigable Rail row and recenter on that canonical position;
- recognize transpositions as convergence on the same place rather than duplicated positions;
- move through positions without losing the sense that they are exploring one connected chess space;
- use human and engine evidence to understand or prioritize alternatives without making evidence the navigation model;
- revisit or share a position directly, independent of the route used to reach it.

The visible Constellation adapts to the available presentation space and the shape of the position. Broad positions may spend space on breadth; forcing Lines may spend it on useful depth. A fixed surrounding-board count or fixed opening depth is not a product rule.

## Authorization

ChessView establishes visitor Lichess authorization at application startup before starting Current View source work. If authorization is denied or fails, it offers an explicit retry rather than letting an incidental Explorer or Masters request navigate the browser. The interactive view starts after authorization; once started, source outages and missing observations do not erase known graph knowledge or prevent using a trustworthy cached view.

## Progressive truth

Chessview shows the best trustworthy current view it can establish instead of waiting for every useful refinement to finish.

A spatial Constellation is accepted for a specific **Nodus plus Root/Line mode**. Refresh, newly learned facts, and material presentation-capacity changes may improve that same projection; while its replacement is being derived, the previously accepted coherent projection remains visible and navigable. Changing the Nodus or changing Root/Line mode asks for a different spatial projection, so Chessview establishes that projection instead of relabeling the old map as though it represented the new inputs.

Rail is Nodus-scoped rather than spatial-projection-scoped. It may remain useful across a Root/Line mode change for the same Nodus while the new Constellation is established. Presentation Evidence may update independently as richer values arrive, but it must not decorate a different spatial projection as though it belonged to the current one.

While a Constellation-admitted structural obligation still has live work, is waiting for its legitimate retry gate, or has completed successfully but still has a settlement recomposition to perform, the trustworthy accepted projection remains visible and navigable while Weather shows `Updating…`.

Successful execution and pending incorporation are different facts. A successful structural participant may remain recorded as satisfied for the refinement run after its settlement recomposition has been attempted. If the same Reading still belongs to the Constellation frontier after that drain, the old success by itself is no longer evidence that automatic progress remains.

If source acquisition ends without usable information, that absence remains unknown rather than being converted into positive or negative chess evidence. Once lower-owned fallback/recovery policy is exhausted, that unavailable outcome need not keep the accepted view permanently Updating for the same refinement attempt. A later refresh may try the same unknown again. A trustworthy view already established from available knowledge remains usable; the product becomes globally degraded only when Chessview cannot establish trustworthy current structure at all.

Work that can only enrich an already established view — for example supplementary engine or Masters evidence or presentation detail — may continue after structural readiness and must not keep or make Weather unsettled by itself.

## Evidence experience

Evidence should make the map easier to understand without overstating what Chessview knows.

- Popularity, move quality, human results, mismatch, rarity, and similar signals keep their own meanings rather than collapsing into one score.
- Missing, insufficient, or unavailable evidence is unknown; it is not silently treated as good, bad, common, rare, successful, or unsuccessful.
- A failure to obtain useful evidence must not be presented as confirmed absence or as positive or negative chess evidence.
- Existing usable evidence may remain useful when newer evidence cannot be obtained.
- Supplementary evidence failure reduces richness, not the user's ability to navigate a trustworthy Constellation.

## Weather

Weather presents structural readiness of the accepted current projection; it does not define chess knowledge or source failure policy.

- `Updating…` means a Constellation-admitted structural obligation still blocks the current refinement run because it has live work, is waiting for its lower-owned retry gate, or has a successful result whose settlement recomposition is still pending. The trustworthy accepted projection may remain visible and interactive.
- Normal `Ready` / subtle check means no admitted structural obligation still blocks this accepted projection in the active refinement run. Unknown source facts may remain unknown, a satisfied participant may remain as run history after its incorporation attempt, and a replacement refinement run may try unknown knowledge again.
- A degraded or unavailable state means Chessview could not establish trustworthy current structure. Failure of supplementary work or failure to improve an already trustworthy accepted projection does not replace that projection with a global failure state.

## Product-wide invariants

- Chess rules define one canonical space of positions and legal Moves. Chessview reveals and remembers a useful subset of that space; the current Constellation is a projection of knowledge, not the whole graph.
- The same canonical position is one place in the map. Genuine transpositions merge while distinct relationships remain understandable.
- Knowledge and visibility are separate: Chessview may know more positions and relationships than fit in the current view, and presentation limits do not become knowledge-retention limits.
- Automatic selection is grounded in observed human play, but frequency and chess quality remain independent. Frequent bad moves can still matter because users encounter them; rare strong or successful alternatives can still matter because they are significant.
- Explicitly explored or manual graph knowledge may remain navigable even when it is outside automatic Constellation selection.
- Root context remains upstream of the Nodus and Line context downstream; evidence or layout changes must not reverse those meanings.
- Recentring is position-based. The URL identifies the Nodus, and browser history can restore earlier positions without making the route itself part of position identity.
- Evidence and acquisition may refine what is shown, but they do not redefine canonical chess identity or transposition merging.

## Ownership

Detailed component behavior belongs in `docs/components/`. Technical source, persistence, request, and publication boundaries belong in `docs/architecture/`. `docs/product.md` should stay at the level of user-visible flows and product-wide invariants rather than duplicating those implementation contracts.
