# Interface

## Purpose

Own Chessview's position-centered navigation model and spatial presentation.

## Requirements

- The Nodus is a large playable Chessground board.
- Surrounding positions are smaller Chessground boards used for navigation rather than direct play.
- Root boards sit to the left of the Nodus; Line boards sit to the right.
- Root move cues point toward the Nodus; Line move cues identify the move that produced the displayed child position.
- Immediate Root families retain distinct visual lanes while they remain distinct. When visible Root paths reach the same canonical upstream position, the paths converge on one shared board rather than duplicating that position.
- A Root transposition merge draws every visible downstream connector from the shared position. Because there is no single unambiguous next move at that merge, the shared board does not show one misleading move cue; the connectors carry the convergence meaning instead.
- Ancestry above a visible Root merge stays on the shared lane instead of splitting back into duplicate family copies.
- In Lines view, connector thickness encodes the first move's rated-Explorer share from the Nodus. Every deeper segment belonging to that Line inherits the same thickness; deeper local move shares do not change it.
- Connector color does not encode popularity. It is reserved for per-edge move-quality evidence when available, while a connector without usable evaluation stays neutral.
- Root rarity remains a separate dash/opacity treatment and does not reuse Line thickness.
- Siblings, cousins, and merged transpositions may occupy lateral context where useful without changing Root/Line direction semantics.
- The right-side control and evidence surface is the Rail.
- The `Lines` tab count reports qualifying first-level graph Lines represented by the structural discovery model. Supplementary Rail filtering must not overwrite that count with a broader evidence-row count.
- The enriched Lines Rail may show additional selectable/evidenced moves that are not automatic Line boards; each such row keeps its rated-Explorer share visible so the distinction from the 5% structural threshold is understandable.
- Clicking a miniature board recenters immediately.
- Playing a legal move on the Nodus recenters even when that move is below the automatic-discovery threshold.
- All visible boards share one global orientation controlled by the flip action.
- The URL identifies the canonical Nodus, not the navigation path used to reach it.
- Browser history navigation restores position-centered state consistently.
- Evidence presentation follows the [Evidence](evidence.md) component rather than deriving chess meaning from DOM layout.
- The application indicates when the critical structural state of the current visible view is still settling and when it has reached a terminal outcome.
- Normal `Ready` means the visible Root/Line structure has been established successfully, including legitimate empty/absent structure where applicable. Supplementary evidence does not block this state and may continue hydrating afterward.
- A critical structural failure is terminal for loading but must not present the normal success-style `Ready` / check state; it is shown as degraded or unavailable.
- Readiness is scoped to the current view generation: completion from an obsolete position/view must not settle a newer one.
- The readiness treatment stays subtle: delayed `Updating…`, a brief `Ready`, then a persistent low-emphasis check for successful structural settlement.

The product-level classification of critical, supplementary, and decorative behavior is owned by [`docs/product.md`](../product.md) §Product usability bar.

## Composition direction

The durable target is a single application/controller owner for render and navigation lifecycle. Root/transposition/evidence behavior should supply explicit data keyed by stable node/edge identity rather than discovering domain meaning by observing and rewriting shared rendered DOM.

Current-view settlement belongs to that controller lifecycle rather than to Lichess transport or a generic request counter. Critical structural contributors report generation-scoped terminal completion to the controller. Supplementary evidence may hydrate independently after structural readiness and must not reopen global `Updating…` unless it actually changes critical visible structure.

This composition refactor is tracked separately in the browser-composition backlog outcome; this component records the product/interface contract it must preserve.

## Verification

Deterministic/browser contract tests should cover:

- URL round-tripping for canonical positions;
- recentering by mini-board click;
- recentering after a legal Nodus move, including a sub-threshold move;
- browser back/forward navigation;
- Root-left / Line-right directional semantics;
- global orientation behavior;
- stable identity between rendered positions/connectors and their graph edges;
- fair visual representation of multiple immediate Root families before one family consumes deeper ancestry;
- Root transpositions rendering one shared canonical board with connectors to every visible downstream parent;
- ancestry above a Root convergence remaining shared rather than duplicating the same canonical positions per family;
- Line descendants inheriting the first move's Nodus share for connector-width semantics;
- the Lines tab retaining its structural first-level-Line count while the evidence Rail hydrates a broader move set;
- current-view settlement waiting for every critical structural contributor;
- supplementary evidence hydration not blocking or reopening a successfully settled structural view;
- stale work from an obsolete generation being unable to settle the current view;
- fast cached structural work avoiding a distracting `Updating…` flash while still acknowledging `Ready`;
- critical structural failure ending loading without showing the normal success-style settled state;
- supplementary request failures remaining locally visible without downgrading structural readiness.

Manual verification should include dense Root and Line neighborhoods, a transposition, responsive layouts, and evidence-rich positions where visual cues remain attached to the correct edge after recentering. In Roots view, it should include a position reachable through several move orders (for example a Panov Attack position) and confirm that immediate Root families remain legible, visible convergence produces one shared board with multiple incoming-to-Nodus routes, and ancestry above the merge remains shared. It should confirm that every segment of one Line keeps the same popularity thickness even when deeper local move percentages differ, while quality color may change edge by edge. It should also confirm that the Lines tab counts structural first-level Lines, while broader Rail-only moves keep their Explorer share visible without changing that tab count. For network-backed structural navigation it should confirm `Updating…` → `Ready` → subtle check; cached structural navigation that settles inside the delay should skip `Updating…` and still acknowledge `Ready` before fading to the check. Supplementary evidence should be allowed to appear afterward without reopening the global loading state.
