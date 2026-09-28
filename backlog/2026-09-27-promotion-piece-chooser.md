# Do:

Manually verify the latest published board-native promotion chooser on desktop and narrow layouts.

# Blocked:

Completion awaits manual browser verification of the latest preview. Deterministic repository verification now passes through task-branch CI, including the chooser/renderer coverage, TypeScript check, and production build; subsequent pushed checkpoints rerun those gates automatically.

# Because:

`src/promotion-chooser.js` owns a Lichess-style destination-file promotion overlay using Chessground's existing piece theme, while `src/recenter-input.js::promotionChoices()` still derives legal promotion pieces through `resolveMove()`. The selected piece is passed unchanged through the existing Move/Recenter path; backdrop or Escape dismissal resolves as cancel and the existing handler redraws without Recenter.

A pending chooser now synchronizes its placement inputs from each renderer publication, so flipping the current Nodus preserves the pending choice while remapping it to the newly oriented destination file and promotion edge. Deterministic chooser and renderer coverage exercise that same-center orientation change and now run in the task-branch `Verify` gate.

Chessground's stock coordinate CSS positions labels partly outside the board, which conflicts with Chessview's clipped Nodus frame. `src/chessground-overrides.css` keeps center-board coordinates inside their squares and is imported by `src/nodus-renderer.js`, so the presentation fix no longer depends on whether the application entrypoint is JavaScript or TypeScript.

# Edges:

Keep `resolveMove()` as the chess-rule authority for which promotion pieces are legal, and keep `NodusController` as the owner of Recenter. This outcome changes promotion interaction and its board presentation only; it does not redesign Move materialization, graph identity, browser-history behavior, or migrate the application entrypoint to TypeScript.

# Complete:

All legal promotion pieces can be selected without a textual browser prompt; the selected piece reaches the existing Move/Recenter pipeline unchanged; cancel creates no Move or Recenter; flipping while promotion is pending keeps the chooser aligned to the displayed board; deterministic Interface/renderer coverage protects all four choices, cancel, and flip behavior; board coordinates remain visually aligned at supported responsive sizes and orientations.

# Steps:

Verify the published destination-file chooser manually for White and Black promotion, flipped orientation while the chooser is open, backdrop/Escape cancel, coordinate alignment, and narrow responsive layouts.

If manual verification passes and the latest task-branch `Verify` gate remains green, run Backlog Close; otherwise repair the observed failures and repeat verification.

# Sync:

After any implementation or verification step that changes what remains, and before ending an implementation pass, rewrite this entry around the factual work and verification still open; do not accumulate progress history. If `Complete:` is satisfied, run Backlog Close. If Close cannot pass its normal gates, leave the entry open with the blocking condition explicit.
