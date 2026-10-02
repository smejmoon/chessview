# Do:

Implement the output contract in `docs/components/constellation-selection.md`: Line composition must consume the already-admitted, already-ranked Candidate set without independently re-running automatic eligibility or requiring the legacy `edge.qualifies` flag.

Remove `edge.qualifies` from `src/visible-graph.js::rankedLineEdges()` and stop `src/nodus-structure.js` from manufacturing `qualifies: true` merely to pass selected Candidates through composition. Preserve the actual selection decisions: automatic Candidates require usable rated-Lichess Prevalence, explicitly materialized graph knowledge remains separately navigable, and same-source ordering continues to come from selection-layer Salience.

Keep the change narrow. Do not use TypeScript conversion to formalize the obsolete protocol; `nodus-structure.js` and `visible-graph.js` may be converted after the Candidate/composition boundary no longer depends on `qualifies`.

# Because:

`docs/components/constellation-selection.md` now states the downstream contract directly: selection hands composition an already-admitted, already-ranked Candidate set, and composition may allocate, merge, truncate, or arrange it but must not require a second admission marker. `src/constellation-selection.ts` already owns automatic eligibility and same-source Salience from Prevalence plus available selection evidence.

`src/visible-graph.js::rankedLineEdges()` still filters with `edge.qualifies || edge.explicit`. The normal Nodus path masks that stale dependency by projecting already-selected automatic Candidates with `qualifies: true` in `src/nodus-structure.js`. That redundant protocol lets composition independently reject a Candidate after the owning selection layer has already admitted it.

# Edges:

`docs/components/constellation-selection.md` and `src/constellation-selection.ts` own automatic eligibility and same-source Salience. `src/nodus-structure.js` is the current Candidate projection boundary. `src/visible-graph.js` owns coherent graph allocation/composition and should consume the projected selected/ranked set rather than decide admission again.

Current-view evidence projected alongside a selected Candidate, such as Explorer games/share used by composition or presentation, is not durable Graph Edge state and need not be removed merely to eliminate `qualifies`. Avoid broadening this outcome into unrelated Candidate-shape cleanup unless the composition contract requires it.

This outcome does not change Knowledge Acquisition Edge Admission, Explorer source validation, ChartedGraph retention, Rail Notable-Line classification, or the tunable meaning of rarity inside Constellation selection. ChartedGraph's `explicit` materialization property remains an input to navigation/selection behavior, not a replacement automatic-eligibility protocol.

# Complete:

Line composition accepts the Candidate set produced by Constellation selection without requiring or consulting `edge.qualifies`, and the Nodus Candidate projection no longer sets that flag just to satisfy visible composition. Deterministic tests prove that an already-selected rare Candidate is not dropped because `qualifies` is false or absent, while Candidates lacking usable Prevalence are still excluded by the selection layer and explicitly materialized navigation remains intact.

TypeScript conversion of `nodus-structure.js` and `visible-graph.js` may follow once this contract is settled; it is not a completion gate for this outcome.

# Sync:

After any implementation or verification step that changes what remains, and before ending an implementation pass, synchronize this entry. Also synchronize when an action completes or becomes unavailable, a blocking condition changes, or a judgment is settled. Rewrite around the factual work and verification still open; do not accumulate progress history. If an outcome's completion condition is satisfied, run Backlog Close for that outcome. If Close cannot pass its normal gates, leave the entry open with the blocking condition explicit.
