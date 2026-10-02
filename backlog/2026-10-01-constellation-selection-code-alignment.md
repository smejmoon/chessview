# Do:

Align the Line-composition implementation with `docs/components/constellation-selection.md` so `visible-graph.js` consumes already-selected/ranked candidates without depending on the legacy `edge.qualifies` admission-era flag.

Remove the need for `nodus-structure.js` to manufacture `qualifies: true` merely to pass candidates through `rankedLineEdges()`. Preserve the actual Constellation-selection decisions: automatic candidates require usable rated-Lichess Prevalence, explicitly materialized graph knowledge remains separately navigable, and same-source ordering continues to come from the selection layer's Salience result.

Keep the implementation boundary narrow while this protocol is removed. `src/rail-selection.ts`, `src/constellation-discovery.ts`, and `src/rail-source.ts` are now typed implementations behind stable `.js` re-export shims; they do not own the remaining candidate-admission mismatch. `src/nodus-structure.js` and `src/visible-graph.js` should remain JavaScript until this outcome removes the obsolete `qualifies` contract, so a TypeScript conversion does not formalize an interface that is about to disappear.

# Because:

`docs/components/constellation-selection.md` owns automatic eligibility and Salience and explicitly says a fixed `5%` eligibility cutoff is not a product commitment. `src/constellation-selection.ts` already computes candidates and same-source order from Prevalence plus available selection evidence.

`src/visible-graph.js::rankedLineEdges()` still filters with `edge.qualifies || edge.explicit`. The normal Nodus path currently masks that stale dependency by projecting every already-selected automatic candidate with `qualifies: true` in `src/nodus-structure.js`, so a current user-visible 5% cutoff is not established. The mismatch is the redundant implementation protocol: visible composition can independently reject a candidate using an old flag after the owning selection layer has already decided eligibility.

The surrounding Rail/discovery seams have now been converted to TypeScript without changing this behavior, and deterministic tests, TypeScript checking, static build, and Pages all pass on that conversion. This leaves the `nodus-structure.js` / `visible-graph.js` compatibility protocol as the next coherent selection-alignment unit rather than a typing problem elsewhere.

# Edges:

`docs/components/constellation-selection.md` owns eligibility and Salience. `src/constellation-selection.ts` should remain the implementation owner of those decisions; `src/visible-graph.js` should own coherent graph allocation/composition rather than re-deciding candidate eligibility through `qualifies`.

`src/nodus-structure.js` is the projection boundary currently manufacturing `qualifies: true`; `src/visible-graph.js` is the consumer currently requiring it. Their eventual TypeScript conversion can follow once this outcome settles the candidate contract, but conversion itself is not a substitute for removing the redundant protocol.

This outcome does not change Knowledge Acquisition Edge Admission, Explorer source validation, ChartedGraph retention, or the tunable meaning of rarity inside Constellation selection. ChartedGraph's explicit-materialization property is an input to selection/navigation behavior, not a replacement eligibility protocol.

# Complete:

Line composition accepts the candidate set produced by Constellation selection without requiring or consulting `edge.qualifies`, and the Nodus candidate projection no longer sets that flag just to satisfy visible composition. Deterministic tests prove that an already-selected rare candidate is not dropped because `qualifies` is false or absent, while candidates lacking usable Prevalence are still excluded by the selection layer and explicitly materialized navigation remains intact.

# Sync:

After any implementation or verification step that changes what remains, and before ending an implementation pass, synchronize this entry. Also synchronize when an action completes or becomes unavailable, a blocking condition changes, or a judgment is settled. Rewrite around the factual work and verification still open; do not accumulate progress history. If an outcome's completion condition is satisfied, run Backlog Close for that outcome. If Close cannot pass its normal gates, leave the entry open with the blocking condition explicit.
