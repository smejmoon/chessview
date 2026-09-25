# Do:

Refactor browser composition so one application controller owns render and navigation lifecycle, while Roots/transposition and evaluation subsystems contribute explicit view-model data keyed by stable node/edge identity instead of discovering relationships by observing and rewriting shared DOM.

# Because:

`audits/2026-09-25-17-30-00-gpt-5.6-sol-chatgpt.md`, finding “UI composition is an implicit multi-writer DOM protocol,” records that `src/main.js`, `src/root-pgn.js`, and `src/eval-ui.js` independently mutate the same rendered surface, with DOM order/labels and synthetic browser events carrying application meaning between them. That mechanism makes correctness depend on render timing and markup shape rather than explicit interfaces.

`docs/components/interface.md` §Requirements, §Composition direction, and §Verification require stable Roots/Lines navigation, recentering, URL position identity, browser history consistency, stable graph-edge identity in presentation, and a single controller-owned render/navigation lifecycle. The missing composition contract is therefore a product-boundary problem, not only a presentation cleanup.

# Edges:

This outcome includes the audit finding “Product-critical browser composition has no automated contract test” because tests should pin the replacement boundary rather than preserve the current observer protocol.

Branch-balanced discovery behavior is tracked separately in `backlog/2026-09-25-branch-balanced-discovery.md`; this outcome must preserve its eventual graph-selection semantics but does not need to change discovery policy.

Shared Lichess transport/rate-limit handling is outside this outcome. Data-loading APIs may be adapted only as needed to expose explicit state to the controller.

# Unsettled:

Choose the smallest explicit composition boundary that lets Root layout, transposition enrichment, evaluation evidence, navigation, and edge drawing exchange stable identities without DOM inference. Decide whether that is best expressed as one controller-owned render model, explicit application events, or a combination, while avoiding a second hidden state machine.

Decide the minimum browser-level contract suite needed to cover recenter/history behavior, Roots/Lines composition, edge association, and URL round-tripping without turning tests into pixel/layout snapshots.

# Complete:

A single application owner controls the `#app` render/navigation lifecycle; core Root/evaluation composition no longer relies on `MutationObserver`, DOM row depth/label parsing, satellite/path array index pairing, or synthetic `resize`/`popstate` events to communicate application state.

Root, Line, transposition, and evaluation decorations associate through stable node/edge identifiers or equivalent explicit model references, and deterministic automated tests exercise the product-critical composition boundary including URL round-tripping and representative recenter/history behavior.

# Steps:

Introduce or extract explicit position/navigation helpers and pin URL round-tripping with deterministic tests.

Define stable node/edge keyed composition data and the controller-owned render/update lifecycle.

Migrate Root/transposition behavior and evaluation/Rail behavior off DOM discovery and synthetic lifecycle events.

Add focused browser/composition tests for identity association, recenter/history, and Roots/Lines integration; remove obsolete observer-coupling code once the contracts pass.

# Sync:

After any implementation or verification step that changes what remains, and before ending an implementation pass, rewrite this entry around the factual work and verification still open; do not accumulate progress history. If `Complete:` is satisfied, run Backlog Close. If Close cannot pass its normal gates, leave the entry open with the blocking condition explicit.
