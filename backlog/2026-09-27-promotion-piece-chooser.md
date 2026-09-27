# Do:

Replace the browser-text promotion prompt with a board-native promotion chooser that preserves explicit queen, rook, bishop, or knight intent before issuing Recenter.

# Because:

`src/recenter-input.js::promptPromotion()` currently delegates promotion choice to `window.prompt`, while `docs/components/interface.md` §Requirements defines the Nodus as a playable board whose legal Move input recenters through the normal application path. Promotion choice changes the resulting Move and canonical target, so the choice belongs at the Interface input boundary rather than being inferred later.

# Edges:

Keep `resolveMove()` as the chess-rule authority for which promotion pieces are legal, and keep `NodusController` as the owner of Recenter. This outcome changes promotion interaction only; it does not redesign Move materialization, graph identity, or browser-history behavior.

# Unsettled:

Choose the smallest board-native interaction that remains clear on desktop and narrow layouts: destination-square overlay, piece tray, or equivalent.

Define cancel/dismiss behavior so abandoning promotion leaves the current Nodus unchanged and restores a playable board without creating a Recenter.

# Complete:

All legal promotion pieces can be selected without a textual browser prompt; the selected piece reaches the existing Move/Recenter pipeline unchanged; cancel creates no Move or Recenter; deterministic Interface/renderer coverage protects all four choices and cancel behavior.

# Steps:

Replace `promptPromotion()` with a presentation-owned chooser surface while preserving `promotionChoices()` as the legality source.

Wire the chooser into the existing center-board move callback and cover queen, rook, bishop, knight, and cancel at the renderer boundary.

Verify responsive interaction manually and run deterministic tests/build.

# Sync:

After any implementation or verification step that changes what remains, and before ending an implementation pass, rewrite this entry around the factual work and verification still open; do not accumulate progress history. If `Complete:` is satisfied, run Backlog Close. If Close cannot pass its normal gates, leave the entry open with the blocking condition explicit.
