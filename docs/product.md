# Chessview product contract

[Chessview vision](vision.md) owns durable product direction and the [glossary](glossary.md) owns canonical terms. This document owns the product-wide experience and flow conditions that must remain true. Component documents own detailed behavior and verification; architecture documents own technical boundaries; unfinished outcomes belong in `backlog/`.

## Core experience

Chessview is a position-centered spatial map. The current Nodus is the reference point, meaningful Roots provide upstream context, meaningful Lines provide downstream possibilities, the Constellation keeps those relationships coherent, and the Rail supports inspection and navigation without becoming the map itself.

A user should be able to:

- understand where the current position came from and where play can go without reconstructing a move tree mentally;
- select a surrounding board or navigable Rail row and recenter on that canonical position;
- recognize transpositions as convergence on the same place rather than duplicated positions;
- move through positions without losing the sense that they are exploring one connected chess space;
- use human and engine evidence to understand or prioritize alternatives without making evidence the navigation model;
- revisit or share a position directly, independent of the route used to reach it.

The visible Constellation adapts to the available presentation space and the shape of the position. Broad positions may spend space on breadth; forcing Lines may spend it on useful depth. A fixed surrounding-board count or fixed opening depth is not a product rule.

## Progressive truth

Chessview shows the best trustworthy current view it can establish instead of waiting for every useful refinement to finish.

When unresolved information can still materially change the Constellation, the current trustworthy view remains visible and navigable while Weather shows that refinement is still in progress. Accepted refinements may add, remove, or rearrange visible boards and relationships without first blanking the usable view.

If further refinement ends without usable information, the unresolved dependency settles as unknown rather than being converted into positive or negative chess evidence. A trustworthy view already established from available knowledge remains usable. The product becomes globally degraded only when Chessview cannot establish trustworthy current structure at all.

Work that can only enrich an already established view — for example supplementary evidence or presentation detail — may continue after structural settlement and must not keep Weather unsettled by itself.

## Evidence experience

Evidence should make the map easier to understand without overstating what Chessview knows.

- Popularity, move quality, human results, mismatch, rarity, and similar signals keep their own meanings rather than collapsing into one score.
- Missing, insufficient, or unavailable evidence is unknown; it is not silently treated as good, bad, common, rare, successful, or unsuccessful.
- A failure to obtain useful evidence must not be presented as confirmed absence or as positive or negative chess evidence.
- Existing usable evidence may remain useful when newer evidence cannot be obtained.
- Supplementary evidence failure reduces richness, not the user's ability to navigate a trustworthy Constellation.

## Weather

Weather communicates structural settlement of the current view rather than general network activity.

- `Updating…` means unresolved structural work can still materially change the Constellation. The trustworthy current view may remain visible and interactive.
- Normal `Ready` / subtle check means the current structural view has settled successfully, including a legitimate empty or absent result where appropriate. Supplementary enrichment may still continue.
- A degraded or unavailable state means Chessview could not establish trustworthy current structure. Failure of optional or further refinement does not replace an already trustworthy view with a global failure state.

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
