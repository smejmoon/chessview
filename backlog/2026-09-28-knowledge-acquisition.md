# Do:

Finish the Knowledge acquisition behavior in `docs/components/knowledge-acquisition.md` §Requirements. First remove visible-board budgets and Constellation membership from acquisition stopping rules except where a caller explicitly limits the information requested. Then define one automatic first-admission rule for newly observed Explorer relationships. Keep first admission separate from retention: admitted legal topology remains durable, while later Explorer refreshes only update mutable statistics on returned known edges.

Use the existing Explorer, `PositionRepository`, and `PositionGraph` seams unless they cannot express the durable contract. Infer routine implementation details from the durable docs and current code and carry the outcome through without stopping for approval. Ask only if a remaining choice would materially change the durable product/architecture contract rather than merely the implementation shape.

# Because:

`docs/product.md` §Cross-product commitments and `docs/components/position-graph.md` §Requirements define Chessview's durable graph as a monotonically discovered subset of the fixed legal chess graph. `docs/components/knowledge-acquisition.md` §Requirements owns first admission and refresh behavior. Explorer facet freshness, stale fallback, and reconciliation remain inside `loadExplorer()` before structural outgoing reads; no-cache acquisition failure remains failure rather than ordinary absence.

Automatic admission must bound topology growth without becoming a Constellation visibility rule. A rare relationship must still be able to enter durable knowledge early enough for `docs/components/constellation-selection.md` §Eligibility to rescue it using engine or favorable human evidence.

# Edges:

All Lichess traffic remains subject to `docs/components/lichess-access.md` §Network boundary, `docs/architecture/lichess-gateway.md` §Boundary / §Dependency direction, and `rules/lichess-gateway.md`. Played-Move materialization remains owned by `docs/components/position-graph.md` §Requirements. Constellation selection remains a consumer of acquired knowledge and must not own transport, persistence, stale-cache policy, or first admission.

Preserve the reusable-producer lifetime in `docs/architecture/current-view.md` §Reusable producer lifetime and `docs/architecture/position-repository.md` §Facet hydration: an obsolete view may stop waiting, but view cancellation must not become ownership of reusable acquisition work.

# Unsettled:

Choose the automatic first-admission rule for newly observed Explorer relationships. Use source-local rated-Explorer evidence and a tunable usefulness/sample floor if that is sufficient. Do not reuse the Constellation rarity/visibility threshold, and do not choose a rule that makes rare-candidate rescue unreachable. Preserve the current Lichess source bound unless a broader source request is required by the durable contract.

Default to the current Explorer/`PositionRepository`/`PositionGraph` interaction. Introduce a new provider/request abstraction only if a focused implementation or test demonstrates that the existing seams cannot express acquisition independently from presentation.

# Complete:

Deterministic tests demonstrate the acquisition contract rather than mirroring implementation details: newly admitted topology can persist beyond the current Constellation; cached/stale Explorer evidence reconciles without presentation-budget truncation; returned known edges refresh statistics; omitted or newly low-frequency known edges remain durable; manual/derived provenance survives concurrent refresh; and view obsolescence cannot cancel reusable enrichment owned elsewhere. Reuse existing coverage where it already proves these facts and add only the focused tests needed for remaining behavior. No application-issued Lichess request bypasses the gateway boundary.

# Sync:

After implementation or verification changes what remains, rewrite this entry around the factual open work rather than accumulating progress history. Continue through routine follow-up fixes and required checks without asking for confirmation. If the completion condition is satisfied, run Backlog Close; if Close cannot pass its normal gates, leave the entry open with the blocking condition explicit.
