# Nodus

## Purpose

Own the current canonical position and the position-centered navigation behavior organized around it.

The Nodus is presented as the primary playable board, but its product meaning is broader than that rendering: it is the position the current view, URL, history state, Rail, and Constellation are organized around.

## Requirements

- The current Nodus is a valid canonical chess position.
- The Nodus is presented as a large playable Chessground board.
- Playing a legal Move on the Nodus requests a Recenter whose target is first materialized into [ChartedGraph](charted-graph.md), even when the move is outside automatic Constellation selection.
- Promotion is part of completing the user's legal Move. Cancelling promotion does not Recenter.
- Clicking another navigable canonical position requests a Recenter to that known target.
- Recenter is the application-level operation that selects another Nodus. A caller may supply a known canonical target or a Move that must first be resolved and materialized.
- Browser-history restoration is distinct from Recenter: it restores recorded position-centered state without creating another history entry.
- Recenter and browser-history restoration start a new current-view projection for the resulting Nodus. View-local Candidates and Constellation structure are rebuilt from durable graph knowledge plus current evidence rather than carrying forward or restoring a frozen prior projection.
- The URL identifies the canonical Nodus rather than the move path used to reach it.
- Stale asynchronous Move materialization from an obsolete view must not Recenter a replacement view.
- Changing the Nodus does not redefine graph identity; `ChartedGraph` remains durable across Recenter operations.

## Verification

Deterministic/browser contract tests should cover:

- URL round-tripping for canonical positions;
- Recenter to a known target;
- Recenter after a legal played Move, including a move outside automatic Constellation selection;
- all legal promotion choices and cancellation behavior;
- stale Move materialization being unable to Recenter a replacement view;
- browser back/forward restoration without adding another history entry;
- Recenter/history restoration rebuilding view-local projection state rather than restoring frozen Candidate/Constellation state;
- durable graph identity remaining unchanged by Recenter.
