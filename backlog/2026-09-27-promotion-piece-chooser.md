# Do:

Manually verify the latest published board-native promotion chooser on desktop and narrow layouts after simplifying outside-selection cancellation.

# Blocked:

Completion awaits manual browser verification of the latest preview. Deterministic repository verification runs through task-branch CI, including chooser/renderer coverage, TypeScript checking, and the production build; the exact current tip must retain a successful `Verify` result.

# Because:

`src/promotion-chooser.js` owns a Lichess-style destination-file promotion overlay using Chessground's existing piece theme, while `src/recenter-input.js::promotionChoices()` derives legal promotion pieces through `resolveMove()`. The selected piece is passed unchanged through the existing Move/Recenter path; cancellation resolves as null and the existing handler redraws without Recenter.

While a promotion choice is pending, the chooser now owns one document-capture pointer rule: a pointer target inside a rendered promotion option is allowed through for normal selection; every other pointer target cancels the chooser before Chessground can consume the gesture. The overlay itself is presentation only and no longer carries separate backdrop click/pointer cancellation handlers. Escape remains the keyboard cancel path.

The chooser still tolerates orientation changes while pending, but flip-during-promotion is not part of this outcome's required behavior or manual close gate.

Chessground's stock coordinate CSS positions labels partly outside the board, which conflicts with Chessview's clipped Nodus frame. `src/chessground-overrides.css` keeps center-board coordinates inside their squares and is imported by `src/nodus-renderer.js`.

# Edges:

Keep `resolveMove()` as the chess-rule authority for legal promotion pieces and keep `NodusController` as the owner of Recenter. This outcome changes promotion interaction and board presentation only; it does not redesign Move materialization, graph identity, browser-history behavior, or migrate the application entrypoint to TypeScript.

# Complete:

All legal promotion pieces can be selected without a textual browser prompt; the selected piece reaches the existing Move/Recenter pipeline unchanged; any pointer outside the promotion options and Escape cancel without creating a Move or Recenter; deterministic coverage protects all four choices and cancel behavior; board coordinates remain visually aligned at supported responsive sizes and orientations.

# Steps:

Verify the published chooser manually for White and Black promotion, outside-selection cancel, Escape cancel, coordinate alignment, and narrow responsive layouts.

If manual verification passes and the latest task-branch `Verify` gate remains green, run Backlog Close; otherwise repair the observed failure and repeat verification.

# Sync:

After any implementation or verification step that changes what remains, and before ending an implementation pass, rewrite this entry around the factual work and verification still open; do not accumulate progress history. If `Complete:` is satisfied, run Backlog Close. If Close cannot pass its normal gates, leave the entry open with the blocking condition explicit.
