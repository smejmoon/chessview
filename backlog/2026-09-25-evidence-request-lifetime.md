# Do:

Run the repository deterministic suite and build on the exact implementation tip that introduces `PositionRepository`; if verification passes, close this outcome and unblock the browser-composition evidence integration.

# Because:

The original evidence-specific framing was too narrow. `src/eval.js` and `src/explorer.js` both coalesced canonical-position work by storing the first caller's promise, so the first caller's `AbortSignal` could own shared work also needed by a replacement caller. Explorer can be critical structural work, so the common problem belongs below evidence composition.

`docs/architecture/position-repository.md` now owns canonical position record access and shared facet lifetime. One in-memory record exists per canonical key after use, IndexedDB remains durable persistence, and Explorer/cloud-eval/Masters stay independently fresh facets rather than giving a whole node one freshness state.

`PositionRepository` gives each equivalent facet load one internal producer `AbortController`. Callers participate with their ordinary scoped `AbortSignal`: an obsolete caller detaches independently; live callers keep the producer alive; the last departing caller removes the shared entry and aborts the producer so queued work can be rejected by `LichessGateway` before `fetch`.

`src/eval.js` and `src/explorer.js` now use repository-managed shared facet loads, and `src/evidence-source.js` passes its existing view-scoped signal directly into cloud-eval and Masters loads. Node reads/writes in structure and transposition persistence also go through the repository so the in-memory identity map is not bypassed by application code.

# Edges:

`NodusController` continues to own current-view obsolescence and publication only. It does not expose revision identity or own shared request lifetime.

`LichessGateway` continues to own application-wide serialization, cooldown, and pre-send `AbortSignal` enforcement. It does not own canonical position identity, endpoint cache TTLs, or parsed-result coalescing.

Endpoint clients still own request parameters, parsing, failure semantics, and facet-specific TTLs. Rated Explorer remains a 24-hour facet; Masters and cloud evaluation remain seven-day facets.

`backlog/2026-09-25-browser-composition-boundary.md` may consume the resulting independent cancellation behavior after this outcome is verified; it should not introduce another evidence-specific subscriber abstraction.

# Complete:

Application-level node access has one canonical-position repository with in-memory reuse and IndexedDB fallback/persistence.

Equivalent cloud-eval, Masters, and Explorer facet loads do not bind shared producer lifetime to the first caller. One obsolete caller can detach while an equivalent live caller remains; when no caller remains, queued producer work is aborted before Lichess transport sends it.

Evidence composition needs only its existing scoped abort signal and does not know repository subscriber identity, controller revision identity, or request scheduling internals.

Deterministic coverage proves repository memory reuse, independent caller cancellation, last-caller producer cancellation, replacement work after cancellation, same-position cloud-eval sharing across an obsolete/current caller pair, and cancellation of all queued cloud-eval callers before `fetch`, while existing cache/failure, Explorer, gateway, controller, graph, and transposition regressions remain green.

# Steps:

Run the exact-tip CI workflow, which executes `npm test` and `npm run build`.

If it passes, run Backlog Close for this entry, then synchronize the browser-composition entry around the cleared dependency and any verification still open there.

# Sync:

After any implementation or verification step that changes what remains, and before ending an implementation pass, rewrite this entry around the factual work and verification still open; do not accumulate progress history. If `Complete:` is satisfied, run Backlog Close. If Close cannot pass its normal gates, leave the entry open with the blocking condition explicit.
