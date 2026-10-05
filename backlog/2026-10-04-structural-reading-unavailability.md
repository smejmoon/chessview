# Do:

Resolve the Current View lifecycle around progressive structural refinement and structural Reading unavailability, using Debug Weather's independent measures to make the competing states observable before collapsing them into one primary status.

Establish one product rule for when an already trustworthy Constellation remains usable while Chessview learns more about the same view, and when a displayed Constellation no longer represents the user's current inputs closely enough to remain the accepted map. Apply that rule consistently to refresh, recomposition after new knowledge, Root/Line mode changes, material presentation-capacity changes, Recenter, and browser-history restoration instead of preserving or blanking structure according to the command path that initiated work.

Settle the readiness rule for a Constellation-admitted Reading whose missing knowledge could still change shape after the current refinement run has exhausted the work and retry paths that could obtain or incorporate it. Unavailable acquisition must remain unknown chess knowledge rather than being converted into synthetic Evidence merely to reach Ready.

Use Weather's aggregate development measures to verify the distinctions directly while the primary UX remains compact. Failed or unplanned participation may remain visible as diagnostics, but their lifecycle semantics belong to the participation/planning work unless they are necessary to resolve structural Reading unavailability itself.

# Because:

Chessview's product direction is progressive truth: show the best trustworthy view available now and continue improving it visibly rather than withholding a usable map until every useful refinement finishes. This is a UX property, not a requirement that every Current View transition preserve the same projection.

`CurrentViewController` still stores structure as a lifecycle value while separately deriving structural Settling from the active run. Refresh preserves an established `ready` structure, Root/Line mode changes replace it with `loading`, and recomposition preserves it again. Whether the existing map survives therefore still depends on the initiating path rather than an explicit validity rule for the accepted Constellation.

The primary Weather surface also still compresses establishment and refinement into the same Updating presentation. Debug Weather can expose the independent measures behind that state without making those measures authoritative, so the remaining UX judgment can be based on observable combinations rather than inferred from controller paths.

Structural Reading unavailability exposes the readiness ambiguity from another side. Constellation can correctly say that missing Reading could still change the constrained shape even after the current refinement run has exhausted every pending work item and legitimate retry path that could obtain or incorporate that Reading. If readiness is derived only from missing structural knowledge, Weather can remain Updating forever; if unavailability is converted into Evidence or treated as factual absence, Chessview overstates what it knows.

# Edges:

Nodus remains the one canonical position currently organizing the map. Root/Line mode is a Current View input, not Nodus identity. Recenter selects another Nodus; browser-history restoration restores recorded current-view inputs without changing canonical chess identity.

Constellation owns coherent composition and identifies structural obligations such as its Reading frontier. It does not own provider/cache/transport state and must not manufacture chess facts from acquisition failure.

Evidence owns chess meaning. Unavailable acquisition remains unknown unless a semantic Evidence rule independently establishes a value.

Weather presents current structural readiness and may expose aggregate Debug measures; it does not define source retry policy, chess knowledge, or structural admission merely by displaying those measures.

Lens owns presentation preferences/environment/constraints. `RouteLedger` owns browser address/history and Back availability. `PositionRepository` owns reusable source-facet producer/state lifetime. Providers, Knowledge Acquisition, and `LichessGateway` retain the source, reconciliation, fallback, retry, and transport semantics they already own.

Generic supplementary work such as engine, Masters, Rail enrichment, Evidence presentation, or lookahead must not by itself determine global structural readiness, even though Debug Weather may report aggregate supplementary participation for diagnosis.

A later attempt may legitimately try an unknown Reading again. An unavailable outcome for one attempt must not silently become durable graph, repository, provider-cache, Evidence, Nodus, or Constellation truth.

`backlog/2026-10-04-refinement-participation-priority.md` separately tracks live source-work participation, planning correctness, execution phases, and priority. Failed or unplanned structural participation is diagnostic evidence here only when it directly bears on the unavailable-Reading UX; this outcome does not otherwise define those states.

# Unsettled:

- What exactly makes a previously accepted Constellation still trustworthy enough to remain the displayed map while a replacement for the same Nodus is being derived?
- Is Nodus identity the hard preservation boundary, so refresh, mode change, and material capacity changes refine/reproject in place while Recenter/history to another Nodus establishes a new map, or do some same-Nodus composition inputs require a stronger invalidation rule?
- When the current refinement run has exhausted all work and legitimate retry paths that could obtain or incorporate a structurally relevant Reading, should that still-unknown Reading continue to keep primary Weather Updating?
- When a participant is `satisfied` but the same Reading remains in the accepted frontier after the settlement drain, what evidence establishes that incorporation is still pending rather than that the current attempt has already exhausted its useful progress?
- What should remain interactive while no trustworthy structure has yet been established for the current inputs, versus while an accepted structure is merely improving?
- Should Rail and presentation Evidence inherit the same same-Nodus stability rule as the spatial Constellation, or may they replace independently as richer values arrive?

# Complete:

The outcome is complete when product, architecture, implementation, and tests agree on observable lifecycle behavior and no implementation-specific mechanism is required merely to explain the UX.

Deterministic/browser verification demonstrates that:

- once a trustworthy Constellation is usable, work intended to improve that same displayed view does not unnecessarily blank, disable, or downgrade the map;
- when the user's current Nodus or other composition-defining inputs cross the chosen validity boundary, the interface does not misrepresent an old projection as trustworthy structure for the new inputs;
- the interface accurately communicates the difference between having no trustworthy current structure yet and having a usable structure that can still improve;
- Debug Weather exposes enough independent aggregate measures to diagnose structural progress without becoming the source of settlement truth;
- structural results that can still change the displayed shape remain visibly unresolved until incorporated or no longer relevant under the chosen readiness rule;
- a structurally relevant Reading whose current refinement run has no remaining work or retry path capable of obtaining or incorporating it does not keep Weather permanently Updating solely because the chess fact remains unknown;
- unavailable acquisition does not create zero, negative, empty, or otherwise synthetic chess Evidence;
- supplementary work and failure do not determine primary structural readiness;
- a later attempt can retry still-unknown source knowledge without inheriting a durable false conclusion from an earlier attempt;
- obsolete work cannot alter the currently displayed view or its readiness;
- the final UX remains position-centered, coherent during transitions, and consistent with Chessview's progressive-truth principle.

# Sync:

After any implementation or verification step that changes what remains, and before ending an implementation pass, synchronize this entry. Also synchronize when an action completes or becomes unavailable, a blocking condition changes, or a judgment is settled. Rewrite around the factual work and verification still open; do not accumulate progress history. If
an outcome's completion condition is satisfied, run Backlog Close for that
outcome. If Close cannot pass its normal gates, leave the entry open with the
blocking condition explicit.
