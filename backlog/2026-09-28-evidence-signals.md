# Do:

Implement the semantic evidence states required by `docs/components/evidence.md` §Engine evidence, §Human evidence, §Frequency evidence, and §Root rarity so consumers receive stable signal meaning without recalculating it. In particular, expose human-result quality with favorable, unfavorable, and unknown/insufficient states; preserve missing/failed/insufficient evidence as unknown; and keep rated Explorer frequency local to its immediate source position.

# Because:

`docs/components/evidence.md` §Purpose now makes Evidence the sole owner of signal meaning, calculation, and epistemic state. `docs/components/constellation-selection.md` §Eligibility consumes engine/human signals for rare-candidate rescue/omission, `docs/components/rail.md` §Requirements consumes them for Rail filtering/navigation, and `docs/components/interface.md` §Requirements renders their visual treatment. None of those consumers should independently derive the same evidence semantics.

# Edges:

Rated Explorer, Masters, and cloud-evaluation transport/failure behavior remains subject to `docs/components/lichess-access.md` §Data sources / §Cache and failure semantics and `docs/architecture/lichess-gateway.md` §Boundary. Constellation selection owns eligibility/order consequences under `docs/components/constellation-selection.md` §Eligibility / §Ranking; Rail owns Rail keep/suppress behavior under `docs/components/rail.md` §Requirements; Interface owns rendered evidence channels under `docs/components/interface.md` §Requirements.

# Unsettled:

Choose the initial favorable/unfavorable human-result score thresholds and sample-sufficiency thresholds. They are Evidence tunables unless deliberately promoted into durable requirements.

Choose the smallest implementation seam that computes each semantic signal once and exposes it to consumers without creating a second mutable copy of position/evidence truth. A new module is optional unless it is the simplest way to avoid duplicated calculations.

Decide how stale values, request failure, insufficient samples, and genuine absence are represented in the consumer-facing signal shape while preserving the distinctions required by `docs/components/evidence.md` §Product criticality / §Human evidence.

# Complete:

Deterministic tests cover `docs/components/evidence.md` §Verification and demonstrate that engine quality, human-result favorable/unfavorable/unknown state, source-local frequency, Root rarity, and request-failure/insufficient distinctions are calculated once by an Evidence owner and consumed without reinterpretation by selection, Rail, or Interface behavior.

# Sync:

After any implementation or verification step that changes what remains, and before ending an implementation pass, rewrite this entry around the factual work and verification still open; do not accumulate progress history. If an outcome's completion condition is satisfied, run Backlog Close for that outcome. If Close cannot pass its normal gates, leave the entry open with the blocking condition explicit.
