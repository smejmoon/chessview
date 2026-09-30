# Do:

Finish the Evidence-owned semantic boundary above `LichessEval`. Consolidate reusable engine move-loss/quality, human-result/mismatch, Prevalence, and Root-rarity calculations under one maintained Evidence owner so Constellation selection, Rail, and Interface consume semantic chess signals rather than reconstructing them from raw source payloads.

Normalize engine move quality to the durable Evidence grammar `strong`, `dubious`, `bad`, or unavailable. Remove the current `good`/`strong` compatibility in Constellation once callers use the single vocabulary.

Remove cloud-evaluation acquisition artifacts that are now semantically dead downstream: `LichessEval` already turns source/cache/transport policy into usable evaluation or absence, with operational activity/issues on its separate status channel. Evidence presentation should not retain raw source/target cloud-eval values merely to infer request failure. Keep source acquisition and cache policy out of Evidence, and keep Rail keep/suppress policy in the Rail outcome rather than moving it into the semantic owner.

# Because:

`docs/components/evidence.md` §Purpose makes Evidence the owner of derived signal meaning and calculation. `docs/architecture/lichess-eval.md` owns cloud-evaluation request parameters, validation, minimum source depth, persistence/cache policy, stale fallback, source absence, and operational request/issues; callers receive usable source data or absence rather than transport/cache sentinels.

`docs/vision.md` §Experience principles and `docs/product.md` §Product usability bar require unavailable evidence to remain unknown rather than negative chess evidence, while trustworthy structure may remain usable during useful refinement.

# Edges:

`LichessEval` is the sole cloud-evaluation provider boundary. `lichessEval.available(position)` supplies already-usable provider data without acquisition; `lichessEval.get(position, { signal })` obtains usable provider data when a caller has decided the information matters. Its `subscribe()` status is an operational source channel rendered by Interface and is not an Evidence state or Weather input.

`backlog/2026-09-28-constellation-selection.md` owns when structurally relevant engine information is worth requesting and what semantic evidence does to membership/Salience. That outcome is no longer blocked on distinguishing cloud-eval request failure, absence, insufficient depth, cache freshness, or stale fallback: those distinctions stay inside `LichessEval`, while absence of a supplied usable evaluation is simply unknown engine evidence.

`backlog/2026-09-28-rail-component.md` owns Rail keep/suppress consequences. Masters and rated Explorer still use older acquisition/failure representations; do not broaden this outcome into a wholesale endpoint-client rewrite unless a concrete Evidence consumer needs that boundary change.

# Unsettled:

Choose the smallest Evidence code seam that becomes the single maintained owner. `src/evidence-signals.js` already owns Prevalence, human-result quality, and Root rarity, while `src/eval.js` still owns engine move evaluation plus overlapping human/rarity helpers and Rail policy. Prefer consolidation by ownership rather than preserving either filename for its own sake.

Decide the smallest semantic value shape callers need after source usability is already guaranteed. Do not add acquisition lifecycle states: no supplied usable source value means unknown semantic evidence, and outstanding work remains caller/provider control flow.

# Complete:

Focused deterministic tests prove each Evidence semantic once: engine move loss/quality, human-result/mismatch, Prevalence, and Root rarity. Engine move quality has one vocabulary (`strong`, `dubious`, `bad`, or unavailable); Constellation no longer accepts a compatibility synonym; and consumer code does not inspect cloud-eval transport/cache/source-quality fields or retain raw cloud-eval values solely to reconstruct acquisition state.

Evidence remains a semantic boundary rather than an acquisition or Rail-policy owner, and unavailable provider output remains unknown rather than negative evidence.

# Sync:

After any implementation or verification step that changes what remains, and before ending an implementation pass, rewrite this entry around the factual work and verification still open; do not accumulate progress history. If an outcome's completion condition is satisfied, run Backlog Close for that outcome. If Close cannot pass its normal gates, leave the entry open with the blocking condition explicit.
