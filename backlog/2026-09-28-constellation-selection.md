# Do:

Add structural engine-rescue hydration to Constellation selection. For a rare candidate whose engine evidence can still change constrained membership, Salience, or selected relationships, request usable source data through `LichessEval.get(position, { signal })`, derive chess meaning through Evidence, and recompose. Keep the current trustworthy Constellation publishable while that structurally relevant request is unresolved; when the provider supplies no usable evaluation, settle the dependency as unknown rather than negative evidence.

Keep the implemented Line composition/refinement model as the baseline: automatic candidacy does not imply visible membership; locally ordered immediate candidates and continuations compete for constrained space through one structural composition decision without a fixed sibling or depth cap; composition inspects durable outgoing knowledge for selected positions; and the Explorer Reading frontier contains only selected positions whose unresolved Reading can still change constrained membership or selected relationships.

Keep Prevalence and Salience distinct. Prevalence remains observed local human-play evidence used directly by Rail ordering and Line-width presentation. Same-source Constellation Salience starts from Prevalence order, applies the documented local evidence promotion/demotion policy, and supplies the local sibling order consumed by Line composition without rewriting the underlying Prevalence values.

# Because:

`docs/vision.md` §Experience principles and `docs/product.md` §Progressive truth require Chessview to show the best trustworthy view available now, continue useful refinement visibly, and not withhold a usable view merely because it may still change. `docs/components/constellation.md` §Requirements owns coherent constrained composition and its structural Reading frontier; `docs/components/constellation-selection.md` §Eligibility / §Salience / §Ranking owns automatic candidacy and comparable same-source ordering.

Knowledge acquisition owns which legal relationships have entered the durable graph and remains permissive enough for rare-candidate rescue. `LichessEval` owns cloud-evaluation source usability/acquisition policy; Evidence owns engine/human/Prevalence meaning; Constellation selection owns only the request trigger and the resulting eligibility, Salience, and visible-composition consequences. No usable provider value therefore means unknown engine evidence regardless of whether the provider internally encountered absence, insufficient depth, stale fallback, or request failure.

# Edges:

`docs/components/knowledge-acquisition.md` owns Explorer Reading acquisition, Edge Admission, persistence, reconciliation, and stale-cache policy. Cached Explorer Readings are reconciled into durable graph knowledge before Constellation treats their outgoing knowledge as known. The implemented Explorer refinement asks for another Reading only when the constrained composition says it can still matter to visible membership or relationships; visibility limits do not tighten Edge Admission.

Evidence supplies the final `strong` / `dubious` / `bad` engine-quality grammar from usable `LichessEval` data. Constellation rescue should consume that semantic value directly; do not introduce an acquisition-state enum, revive `good` compatibility, or inspect `LichessEval` operational status.

`backlog/2026-09-28-weather-component.md` owns global settlement/presentation semantics. A structurally relevant rescue request participates in Weather because Constellation/controller knows it is outstanding, not because `LichessEval.subscribe()` reports aggregate provider activity. Supplementary engine requests remain local and do not control Weather.

`docs/components/rail.md` owns Rail selection and presentation. Rail sibling ordering consumes Evidence Prevalence where candidates share the same source position; it does not consume Constellation Salience as a substitute for observed popularity. `docs/components/interface.md` owns presentation-space constraints and uses first-move Line Prevalence for connector width. Genuine canonical transpositions merge; synthetic grouping for overflow branches is not required.

# Unsettled:

Choose the smallest engine-rescue frontier/request trigger that can answer whether a rare candidate can still enter or reorder the constrained composition. Do not prefetch engine evidence for every candidate, and do not wait for evidence whose result can no longer change membership, Salience, or selected relationships.

Choose how the current-view controller represents one outstanding structural rescue dependency so a trustworthy provisional Constellation can remain published while the request is live and can settle cleanly when `LichessEval.get()` returns usable data or `null`. Keep the dependency in control flow rather than inventing a persisted Evidence lifecycle state.

Keep current Root cross-source behavior unless a deterministic dense-Root case demonstrates a concrete coherence/usefulness failure; unrelated source-local Prevalence still must not become one global rank.

# Complete:

Focused deterministic/integration tests prove that structurally relevant rare-candidate engine rescue can change constrained membership when usable Evidence warrants it; no usable provider result settles as unknown without invalidating an already trustworthy composition; and structurally irrelevant engine evidence is neither requested nor allowed to keep Weather unsettled. Existing selection/composition coverage remains green for Prevalence remaining independent from Salience, same-source Salience applying local positive/negative evidence adjustments without global scoring, frequent-bad eligibility, broad constrained Lines, depth competing with breadth without fixed caps or family-iteration accidents, cached Reading reconciliation before structural settlement, Explorer refinement stopping only when neither constrained membership nor selected relationships can change, canonical transposition coalescing, and Root-family coherence. Do not turn `5%`, `19`, a fixed sibling count, or a fixed opening depth into product limits.

# Sync:

After any implementation or verification step that changes what remains, and before ending an implementation pass, synchronize this entry. Also synchronize when an action completes or becomes unavailable, a blocking condition changes, or a judgment is settled. Rewrite around the factual work and verification still open; do not accumulate progress history. If an outcome's completion condition is satisfied, run Backlog Close for that outcome. If Close cannot pass its normal gates, leave the entry open with the blocking condition explicit.
