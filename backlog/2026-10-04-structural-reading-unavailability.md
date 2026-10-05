# Do:

Resolve the Current View lifecycle problem around progressive structural
refinement and structural Reading unavailability.

The product should keep a trustworthy spatial map useful while Chessview learns
more about the same view, without presenting stale structure as though it belongs
to different current inputs and without allowing unavailable source knowledge to
leave Weather permanently Updating.

Investigate the user-visible semantics of initial establishment, background
refinement, refresh, recomposition after new knowledge, Root/Line mode changes,
Recenter, and browser-history restoration. Establish which of those situations
may continue presenting an already trustworthy Constellation, when a displayed
Constellation no longer represents the user's current view, and what Weather
should communicate in each case.

The resulting behavior must also account for a Constellation-admitted Reading
whose missing knowledge could still change shape but for which the current
attempt can no longer make automatic progress. Missing or unavailable Reading
must remain unknown chess knowledge rather than being converted into synthetic
Evidence merely to reach a ready state.

# Because:

Chessview's product direction is progressive truth: show the best trustworthy
view available now and continue improving it visibly rather than withholding a
usable map until every useful refinement finishes. This is a UX property, not a
requirement that every Current View transition preserve the same projection.

The current implementation does not express that distinction directly.
`CurrentViewController` stores structure as a lifecycle value and separately
derives structural settling from the active run. Some paths preserve an
established `ready` structure while work continues, while other paths replace it
with `loading` before a new composition is established. Whether the existing map
survives therefore depends on the command/path that initiated work rather than on
an explicit product distinction between "we have no trustworthy map yet" and
"we have a trustworthy map that may still improve."

`view-status.js` also presents both `structure.status === loading` and structural
`settling` through the same Updating state. Those states can correspond to very
different user situations: Chessview may still be establishing any trustworthy
current structure, or it may already have a usable map while admitted structural
work can still improve it.

Structural Reading unavailability exposes the same ambiguity from another side.
Constellation can correctly say that missing Reading could still change the
constrained shape even when acquisition for the current attempt has no remaining
automatic progress path. If readiness is derived only from missing structural
knowledge, Weather can remain Updating forever; if failure is converted into
Evidence or treated as factual absence, Chessview overstates what it knows.

# Edges:

Nodus remains the one canonical position currently organizing the map. Root/Line
mode is a Current View input, not Nodus identity. Recenter selects another Nodus;
browser-history restoration restores recorded current-view inputs without
changing canonical chess identity.

Constellation owns coherent composition and identifies structural obligations
such as its Reading frontier. It does not own provider/cache/transport state and
must not manufacture chess facts from acquisition failure.

Evidence owns chess meaning. Missing, failed, or unavailable acquisition remains
unknown unless a semantic Evidence rule independently establishes a value.

Weather presents current structural readiness; it does not define source retry
policy or chess knowledge.

Lens owns presentation preferences/environment/constraints. `RouteLedger` owns
browser address/history and Back availability. `PositionRepository` owns reusable
source-facet producer/state lifetime. Providers, Knowledge Acquisition, and
`LichessGateway` retain the source, reconciliation, fallback, retry, and
transport semantics they already own.

Generic supplementary work such as engine, Masters, Rail enrichment, Evidence
presentation, or lookahead must not by itself determine global structural
readiness.

A later attempt may legitimately try an unknown Reading again. An unavailable
outcome for one attempt must not silently become durable graph, repository,
provider-cache, Evidence, Nodus, or Constellation truth.

`backlog/2026-10-04-refinement-participation-priority.md` separately tracks live
source-work participation and priority. This outcome is about the user-visible
and architectural meaning of trustworthy current structure while structural work
is active, completes, fails, retries, or becomes unavailable.

# Unsettled:

- What exactly does "a trustworthy Constellation should remain usable while
  refinement happens" mean from the player's perspective?
- Which operations are improvements of the same displayed view, and which are
  transitions to a different view for which retaining the old Constellation
  would be misleading?
- When Current View has a trustworthy Constellation and structural work is still
  live, what should remain interactive and what should Weather communicate?
- How should the UX distinguish establishing the first trustworthy current
  structure from improving one that is already usable?
- What should happen when recomposition/refinement cannot improve an already
  trustworthy view?
- What should happen when Chessview cannot establish trustworthy structure for
  the current inputs at all?
- When a Reading remains structurally relevant but the current attempt has no
  remaining automatic progress path, when should that obligation stop blocking
  readiness, and what scope should that conclusion have?
- How should refresh, Root/Line mode changes, Recenter, history restoration, and
  material presentation-capacity changes differ, if at all, in preservation and
  transition behavior?
- Does the same stability expectation apply to Rail and presentation Evidence,
  or only to the spatial Constellation?

# Complete:

The outcome is complete when product, architecture, implementation, and tests
agree on observable lifecycle behavior and no implementation-specific mechanism
is required merely to explain the UX.

Deterministic/browser verification demonstrates that:

- once a trustworthy Constellation is usable, work intended to improve that same
  displayed view does not unnecessarily blank, disable, or downgrade the map;
- when the user's current Nodus or other composition-defining inputs change, the
  interface does not misrepresent an old projection as trustworthy structure for
  the new inputs;
- the interface accurately communicates the difference between having no
  trustworthy current structure yet and having a usable structure that can still
  improve;
- structural results that can still change the displayed shape remain visibly
  unresolved until incorporated or no longer relevant;
- a structurally relevant Reading whose current attempt can no longer make
  automatic progress does not keep Weather permanently Updating solely because
  the chess fact remains unknown;
- unavailable acquisition does not create zero, negative, empty, or otherwise
  synthetic chess Evidence;
- supplementary work and failure do not determine structural readiness;
- a later attempt can retry still-unknown source knowledge without inheriting a
  durable false conclusion from an earlier attempt;
- obsolete work cannot alter the currently displayed view or its readiness;
- the final UX remains position-centered, coherent during transitions, and
  consistent with Chessview's progressive-truth principle.

# Sync:

After any implementation or verification step that changes what remains, and
before ending an implementation pass, synchronize this entry. Also synchronize
when an action completes or becomes unavailable, a blocking condition changes,
or a judgment is settled. Rewrite around the factual work and verification
still open; do not accumulate progress history. If
an outcome's completion condition is satisfied, run Backlog Close for that
outcome. If Close cannot pass its normal gates, leave the entry open with the
blocking condition explicit.
