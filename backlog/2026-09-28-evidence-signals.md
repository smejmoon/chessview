# Do:

Establish the smallest Evidence-owned engine-evidence value needed by consumers before Constellation implements structural engine rescue. It must make semantic chess quality and evidence availability unambiguous without exposing consumers to raw transport/cache interpretation: usable evaluation, request failure, genuine absence/not-returned move, insufficient evaluation depth, and stale-but-usable evidence must remain distinguishable.

Keep the existing source-local frequency, human-result quality, and Root-rarity derivation in `src/evidence-signals.js`, and route Constellation selection, Rail, and Interface through the Evidence semantic boundary so they stop reconstructing meaning from raw endpoint/cache values. Default to plain derived semantic values or helpers, not a new persisted per-edge lifecycle or class hierarchy. Keep acquisition/loading control flow in the existing facet owners.

# Because:

`docs/components/evidence.md` §Purpose makes Evidence the sole owner of signal meaning, calculation, and epistemic state. `docs/components/constellation-selection.md` §Eligibility consumes engine/human signals for rare-candidate rescue/omission, `docs/components/rail.md` §Requirements consumes them for Rail filtering/navigation, and `docs/components/interface.md` §Requirements renders their visual treatment.

The semantic boundary must preserve distinctions that affect behavior while keeping missing, failed, absent, or insufficient evidence unknown rather than negative chess evidence. Source-position facet hydration remains owned by `PositionRepository`; Evidence must not introduce a second loading state machine.

# Edges:

Rated Explorer, Masters, and cloud-evaluation transport/failure behavior remains subject to `docs/components/lichess-access.md` §Data sources / §Cache and failure semantics and `docs/architecture/lichess-gateway.md` §Boundary. Prefer keeping transport/cache mechanics in `eval.js` and semantic interpretation beside `src/evidence-signals.js`; move only judgment logic that consumers otherwise duplicate.

`backlog/2026-09-28-constellation-selection.md` can proceed with broad-Line composition independently. Its structural engine-rescue outcome is blocked until this entry exposes the engine-evidence semantics above; once available, Constellation selection owns when unresolved evidence is structurally worth requesting and what eligibility consequence the semantic result has. Rail owns Rail keep/suppress behavior, and Interface owns rendered evidence channels.

# Unsettled:

Choose the smallest consumer-facing engine-evidence representation that preserves both semantic quality and availability. Default to an ephemeral derived finite-state value rather than persisted pending/available/failed edge state; pending acquisition remains control flow owned by the facet load.

If `eval.js` currently mixes transport mechanics with semantic chess judgments, move only the judgment logic needed by more than one consumer into the Evidence owner and leave endpoint/cache behavior in its existing owner.

# Complete:

Focused deterministic tests prove the semantic contract once: engine quality plus usable/failure/absence/insufficient/stale-usable distinctions, human-result favorable/unfavorable/unknown state, source-local frequency, and Root rarity are calculated by an Evidence owner and consumed without reinterpretation by selection, Rail, or Interface behavior. Reuse acquisition/cache tests for transport behavior and avoid duplicate tests that merely restate helper implementation.

# Sync:

After any implementation or verification step that changes what remains, and before ending an implementation pass, rewrite this entry around the factual work and verification still open; do not accumulate progress history. If an outcome's completion condition is satisfied, run Backlog Close for that outcome. If Close cannot pass its normal gates, leave the entry open with the blocking condition explicit.
