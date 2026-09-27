# Do:

Add directional arrow treatment for unambiguous visible Move relationships, derived from the existing visible relationship/graph edge rather than introducing navigation state into presentation.

# Because:

`docs/components/interface.md` §Requirements says Root move cues point toward the Nodus and Line move cues identify the Move that produced the displayed child. `docs/glossary.md` §Move cue explicitly names an arrow as a valid treatment. `src/map-render.js::drawVisibleEdges()` currently renders plain SVG paths without directional markers, so the connector already has the relationship identity needed for an arrow treatment but does not express direction visually.

# Edges:

Do not change graph identity, Recenter semantics, or visible-composition ownership. Preserve connector thickness for Line popularity, evidence color, Root rarity styling, and transposition convergence. At a shared Root merge where no single next Move is unambiguous, do not add one misleading board-level cue; connector-level direction must remain truthful.

# Unsettled:

Choose arrowhead placement and scale so dense neighborhoods remain legible across responsive layouts.

Decide whether SAN remains only in board labels/Rail or whether connector-local labeling is needed in addition to direction.

# Complete:

Line connectors visibly indicate source-to-target Move direction; Root connectors visibly point toward the Nodus; shared/transposed Root structures do not imply a false unique Move; evidence/popularity styling remains intact; deterministic connector tests protect directional semantics without relying on pixel snapshots.

# Steps:

Extend the SVG connector representation with reusable marker/arrow semantics derived from each visible relationship.

Add structural tests for Line, Root, and shared-Root cases, then manually inspect dense/responsive maps.

Run deterministic tests/build.

# Sync:

After any implementation or verification step that changes what remains, and before ending an implementation pass, rewrite this entry around the factual work and verification still open; do not accumulate progress history. If `Complete:` is satisfied, run Backlog Close. If Close cannot pass its normal gates, leave the entry open with the blocking condition explicit.
