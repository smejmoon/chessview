# Do:

Define and implement evidence-request lifetime and coalescing so an obsolete view can stop waiting for its cloud-eval/Masters work without cancelling an equivalent request still needed by a current subscriber, while obsolete queued work with no remaining subscriber is prevented from reaching Lichess.

# Because:

`docs/components/lichess-access.md` §Network boundary requires queued obsolete work to be prevented from reaching the network, and `docs/components/interface.md` §Requirements scopes readiness to the current view generation. Current `src/eval.js` coalesces cloud-eval and Masters loads by canonical position by returning the first in-flight promise before considering a later caller's `AbortSignal`; the first caller's signal therefore effectively owns the shared request lifetime.

`audits/2026-09-25-22-28-08-gpt-5.6-sol-chatgpt.md`, finding “Obsolete evidence work is generation-stale but not request-cancelled,” records that stale evidence results are ignored by presentation but their queued requests can still consume the application-wide serialized Lichess request stream and delay the current view.

# Edges:

`backlog/2026-09-25-browser-composition-boundary.md` owns View Cycle/controller composition and may supply generation cancellation context. This outcome owns the evidence-loader subscriber/coalescing semantics needed to use that context safely.

`LichessGateway` continues to own application-wide serialization, cooldown, and pre-send `AbortSignal` enforcement. This outcome must use that boundary rather than introducing a second scheduler or changing chess/evidence cache meaning.

Existing cache TTLs, stale-evidence fallback, cloud-eval 404-as-absence behavior, and explicit request-failure semantics remain constraints rather than subjects for redesign.

# Unsettled:

Choose the smallest model for separating subscriber lifetime from the underlying same-position request lifetime. In particular, decide when a shared underlying request should be aborted after subscribers become obsolete and how a later current subscriber joins already-started or queued equivalent work.

Decide whether coalescing identity remains canonical position per endpoint or needs any additional request-shape key while preserving current endpoint semantics.

# Complete:

A caller becoming obsolete can stop participating in cloud-eval/Masters work without aborting equivalent work still required by another live subscriber.

When every subscriber to queued evidence work is obsolete, that request is cancelled before it reaches `fetch`; when at least one live subscriber remains, the underlying request may complete and satisfy it.

Deterministic tests cover an obsolete subscriber followed by a live same-position subscriber, all-subscribers-obsolete cancellation before send, normal same-position coalescing, cache/stale fallback behavior, and interaction with the shared serialized gateway.

# Steps:

Add failing deterministic cases for shared same-position work with independently obsolete subscribers.

Define the minimum subscriber/request-lifetime abstraction around the existing cloud-eval and Masters in-flight maps.

Thread view-generation cancellation into evidence loading through that abstraction without moving scheduling out of `LichessGateway`.

Run evidence, gateway, and view-lifecycle regressions and synchronize this entry around any remaining behavior.

# Sync:

After any implementation or verification step that changes what remains, and before ending an implementation pass, rewrite this entry around the factual work and verification still open; do not accumulate progress history. If `Complete:` is satisfied, run Backlog Close. If Close cannot pass its normal gates, leave the entry open with the blocking condition explicit.
