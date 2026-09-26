# Do:

Unify Root and Line visible composition around one explicit node/edge keyed visible-graph model so both directions represent canonical positions, visible relationships, family membership, convergence, and board budgeting consistently while preserving their distinct scheduling policies.

# Because:

`docs/components/position-graph.md` defines one canonical position graph in which transpositions merge, while `docs/components/interface.md` presents Roots and Lines as opposite spatial directions around the Nodus. The implementation now reflects that graph unevenly: Root neighborhood selection can retain multiple downstream edges and Root-family membership for one canonical merged position, while Line neighborhood selection still carries one selected edge/branch and uses `seen` to discard a later relationship when another Line reaches an already-visible canonical position.

`src/line-frontier.js` intentionally owns the Line `depth + breadth` candidate policy, while Root selection intentionally stays shallow-first within each immediate Root family. Those policy differences are behavioral, not a reason for the two directions to expose different visible graph semantics.

Root presentation also reconstructs graph relationships that selection already knows: `src/root-pgn.js` reads rendered satellite depth/labels, reloads graph edges, derives Root family sets, and then draws connectors. That makes the DOM an accidental second graph model and prevents Root/Line rendering machinery from converging cleanly.

# Edges:

The existing Line discovery/frontier behavior documented in `docs/components/discovery.md` and implemented by `src/line-frontier.js` remains binding. This outcome may extract common family/frontier mechanics only after a shared visible-graph model proves the common shape; it must preserve the distinct Line `depth + breadth` and Root shallow-first policies and does not redesign network discovery.

`backlog/2026-09-25-browser-composition-boundary.md` owns controller lifecycle, navigation APIs, contributor settlement, synthetic browser-event removal, and integration at the application boundary. This outcome supplies the explicit visible model that controller/contributors consume but does not own their lifecycle protocol.

`backlog/2026-09-25-evidence-request-lifetime.md` owns evidence-request subscriber/coalescing semantics. This outcome may expose stable node/edge/family identity used by evidence presentation, but it does not own request lifetime or Lichess scheduling.

# Unsettled:

Choose the smallest `VisibleGraph`-like contract that can represent the Nodus, direction, one canonical visible node per position, every visible graph edge, family membership, distance, and convergence without duplicating graph/persistence state.

Decide how a downstream transposition shared by several Lines carries per-family presentation state such as inherited first-move `lineShare`: the canonical board is one node, while connectors and family-specific evidence may still need distinct edge/family state.

Choose the smallest shared renderer/layout boundary: node/edge/merge rendering and interaction should be common, while Root-left and Line-right placement and family-lane geometry may remain direction-specific.

Decide whether a generic family-frontier mechanism is earned after both selectors emit the same visible-graph shape; do not generalize the distinct candidate policies merely to make the implementations look symmetric.

# Complete:

Root and Line selection both emit the same explicit visible-graph contract. A canonical position appears once in that visible model while every visible relationship and family that reaches it is retained; Line transpositions therefore no longer lose the second relationship merely because the node was already selected. Root and Line scheduling policies remain independently testable and behaviorally unchanged except for the intended Line convergence retention.

A shared map-rendering path consumes explicit visible nodes, edges, families, and merge state with direction-specific layout where needed. Root/Line presentation no longer reconstructs graph meaning from DOM row depth, labels, rendered order, or secondary graph lookups that exist only to recover relationships selection already knew.

Deterministic automated tests cover Root and Line convergence, visible-board budgeting, preservation of their distinct frontier policies, stable node/edge/family identity, and correct rendering of one canonical board with every visible relationship that reaches it.

# Steps:

Introduce the smallest shared visible-graph data shape and adapt the existing Root and Line selectors to emit it without changing layout or frontier policy.

Retain every visible Line relationship when several first-level Lines converge on one canonical position, counting the shared board once while preserving family/edge-specific state such as inherited `lineShare`.

Make Root and Line presentation consume the explicit visible graph directly; remove Root DOM depth/label relationship reconstruction and migrate connector/evidence association from rendered order to stable node/edge identity.

Extract common board, connector, merge, highlight, and navigation rendering behind direction-specific Root/Line layout strategies.

Only after both directions use the same proven visible model, extract shared family-frontier mechanics if a small genuinely common mechanism remains.

# Sync:

After any implementation or verification step that changes what remains, and before ending an implementation pass, rewrite this entry around the factual work and verification still open; do not accumulate progress history. If `Complete:` is satisfied, run Backlog Close. If Close cannot pass its normal gates, leave the entry open with the blocking condition explicit.
