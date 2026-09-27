# Do:

Run the deterministic test verification and manually verify the published board-native promotion chooser on desktop and narrow layouts; fix any failures that verification exposes.

# Blocked:

Completion awaits the deterministic test run and manual browser verification of the latest preview. The current promotion implementation, including the coordinate-label correction, has passed the repository's static Pages build and publish path.

# Because:

`src/promotion-chooser.js` owns a Lichess-style destination-file promotion overlay using Chessground's existing piece theme, while `src/recenter-input.js::promotionChoices()` still derives legal promotion pieces through `resolveMove()`. The selected piece is passed unchanged through the existing Move/Recenter path; backdrop or Escape dismissal resolves as cancel and the existing handler redraws without Recenter.

Chessground's stock coordinate CSS positions labels partly outside the board, which conflicted with Chessview's clipped Nodus frame and made file/rank labels look shifted. `src/chessground-overrides.css` now keeps center-board coordinates inside their squares without changing move, FEN, or promotion geometry.

# Edges:

Keep `resolveMove()` as the chess-rule authority for which promotion pieces are legal, and keep `NodusController` as the owner of Recenter. This outcome changes promotion interaction and its board presentation only; it does not redesign Move materialization, graph identity, or browser-history behavior.

# Complete:

All legal promotion pieces can be selected without a textual browser prompt; the selected piece reaches the existing Move/Recenter pipeline unchanged; cancel creates no Move or Recenter; deterministic Interface/renderer coverage protects all four choices and cancel behavior; board coordinates remain visually aligned at supported responsive sizes and orientations.

# Steps:

Run deterministic tests against the promotion implementation.

Verify the published destination-file chooser manually for White and Black promotion, flipped orientation, backdrop/Escape cancel, coordinate alignment, and narrow responsive layouts.

If verification passes, run Backlog Close; otherwise repair the observed failures and repeat verification.

# Sync:

After any implementation or verification step that changes what remains, and before ending an implementation pass, rewrite this entry around the factual work and verification still open; do not accumulate progress history. If `Complete:` is satisfied, run Backlog Close. If Close cannot pass its normal gates, leave the entry open with the blocking condition explicit.
