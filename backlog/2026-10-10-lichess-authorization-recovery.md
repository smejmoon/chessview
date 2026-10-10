# Do:

Provide explicit Lichess authorization recovery for an already-running ChessView after a session's token is rejected with HTTP 401, and ensure terminal OAuth callback failures allow a clean explicit retry.

When a source request receives HTTP 401 and `LichessSession` invalidates the access token, make the need to reauthorize visible to the user through a central application action. Source providers must not initiate redirects.

Ensure `LichessSession` removes OAuth transaction state and callback parameters when a completed token exchange cannot be consumed, including malformed successful JSON and failure to persist a returned token, so a retry cannot replay an already-used authorization code.

# Because:

`src/lichess-session.ts` clears a rejected token on HTTP 401, but `src/main.ts` currently presents a sign-in retry only if initial authorization fails. Thus an active session can lose primary Lichess acquisition without a user-facing recovery action.

`src/lichess-session.ts` also parses a successful exchange using `response.json()` and writes the access token before calling `clearTransaction({ cleanUrl: true })`. If parsing or storage fails, the old callback URL and PKCE transaction survive, and an explicit retry may repeat the same code exchange. This contradicts the terminal callback cleanup promise in [Lichess access](../docs/components/lichess-access.md) §Authentication.

# Edges:

Preserve the startup-owned authentication boundary in [Lichess access](../docs/components/lichess-access.md) §Authentication and [ChessView product contract](../docs/product.md) §Authorization: incidental Explorer, Masters, and Root Bootstrap requests never initiate OAuth navigation. Expired authorization must not erase established graph knowledge or prevent useful cached navigation.

Do not change gateway scheduling or the Lichess work-demand migration tracked by [work-context implementation](2026-10-07-work-context-implementation.md). OAuth token exchange stays inside `LichessGateway`.

A failed persistence operation is not proof of a usable stored token; recovery must not falsely report authorization as established.

# Complete:

An active session receiving HTTP 401 loses its invalid token and offers a visible, deliberate reauthorization action without request-driven redirection. Deterministic tests cover this transition and recovery while retaining the accepted view.

After malformed token-exchange JSON or token-storage failure, the OAuth callback URL and PKCE transaction are clean, and a subsequent deliberate retry begins a new sign-in rather than reusing the original code. Tests cover successful, denied, malformed and network-failed callback paths.

# Sync:

Use `backlog-tend` for routine synchronization of this open outcome.
