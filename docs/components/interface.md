# Interface

## Purpose

Own Chessview's position-centered navigation model and spatial presentation.

## Requirements

- The current position is a large playable Chessground board.
- Surrounding positions are smaller Chessground boards used for navigation rather than direct play.
- Root boards sit to the left of the current position; Line boards sit to the right.
- Root move cues point toward the current position; Line move cues identify the move that produced the displayed child position.
- Siblings, cousins, and merged transpositions may occupy lateral context where useful without changing Root/Line direction semantics.
- The right-side control and evidence surface is the Rail.
- Clicking a miniature board recenters immediately.
- Playing a legal move on the center recenters even when that move is below the automatic-discovery threshold.
- All visible boards share one global orientation controlled by the flip action.
- The URL identifies the canonical current position, not the navigation path used to reach it.
- Browser history navigation restores position-centered state consistently.
- Evidence presentation follows the [Evidence](evidence.md) component rather than deriving chess meaning from DOM layout.

## Composition direction

The durable target is a single application/controller owner for render and navigation lifecycle. Root/transposition/evidence behavior should supply explicit data keyed by stable node/edge identity rather than discovering domain meaning by observing and rewriting shared rendered DOM.

This composition refactor is tracked separately in the browser-composition backlog outcome; this component records the product/interface contract it must preserve.

## Verification

Deterministic/browser contract tests should cover:

- URL round-tripping for canonical positions;
- recentering by mini-board click;
- recentering after a legal center-board move, including a sub-threshold move;
- browser back/forward navigation;
- Root-left / Line-right directional semantics;
- global orientation behavior;
- stable identity between rendered positions/connectors and their graph edges.

Manual verification should include dense Root and Line neighborhoods, a transposition, responsive layouts, and evidence-rich positions where visual cues remain attached to the correct edge after recentering.
