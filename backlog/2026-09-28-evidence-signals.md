# Do:

Finish the semantic Evidence boundary required by `docs/components/evidence.md` §Engine evidence, §Human evidence, §Frequency evidence, and §Root rarity. `src/evidence-signals.js` derives source-local rated-Explorer frequency, human-result quality, and Root rarity without trusting placeholder edge shares, and Constellation selection consumes source Explorer snapshots through that seam. Route the remaining engine availability/quality, mismatch, rarity, and request-failure meaning through one Evidence-owned shape so Rail and Interface stop reconstructing those semantics from raw transport values.

# Because:

`docs/components/evidence.md` §Purpose makes Evidence the sole owner of signal meaning, calculation, and epistemic state. `docs/components/constellation-selection.md` §Eligibility consumes engine/human signals for rare-candidate rescue/omission, `docs/components/rail.md` §Requirements consumes them for Rail filtering/navigation, and `docs/components/interface.md` §Requirements renders their visual treatment. `src/evidence-signals.js` establishes rated-Explorer frequency from the immediate source snapshot and initial human-result quality with a 200-game sufficiency floor, favorable within 2 percentage points of the best sufficiently sampled move, and unfavorable at least 8 percentage points behind; missing/not-returned moves produce no frequency rather than synthetic zero evidence.

# Edges:

Rated Explorer, Masters, and cloud-evaluation transport/failure behavior remains subject to `docs/components/lichess-access.md` §Data sources / §Cache and failure semantics and `docs/architecture/lichess-gateway.md` §Boundary. Constellation selection owns eligibility/order consequences under `docs/components/constellation-selection.md` §Eligibility / §Ranking; Rail owns Rail keep/suppress behavior under `docs/components/rail.md` §Requirements; Interface owns rendered evidence channels under `docs/components/interface.md` §Requirements. Source-position facet hydration remains owned by `PositionRepository`; Evidence must not introduce a second per-edge loading lifecycle.

# Unsettled:

Choose the smallest consumer-facing shape that preserves engine request failure, genuine absence, insufficient depth, stale usable values, and semantic move quality without duplicating the source facet's loading state. Pending acquisition remains control flow owned by the facet load rather than a separately persisted Evidence state.

Decide whether the existing `eval.js` helpers should be narrowed around acquisition/engine calculations or whether more semantic helpers should move beside `src/evidence-signals.js`; prefer the fewest maintained owners that remove duplicated interpretation.

# Complete:

Deterministic tests cover `docs/components/evidence.md` §Verification and demonstrate that engine quality, human-result favorable/unfavorable/unknown state, source-local frequency, Root rarity, and request-failure/insufficient distinctions are calculated once by an Evidence owner and consumed without reinterpretation by selection, Rail, or Interface behavior.

# Sync:

After any implementation or verification step that changes what remains, and before ending an implementation pass, rewrite this entry around the factual work and verification still open; do not accumulate progress history. If an outcome's completion condition is satisfied, run Backlog Close for that outcome. If Close cannot pass its normal gates, leave the entry open with the blocking condition explicit.
