# Do:

Finish the semantic Evidence boundary required by `docs/components/evidence.md` §Engine evidence, §Human evidence, §Frequency evidence, and §Root rarity. Keep the existing source-local frequency, human-result quality, and Root-rarity derivation in `src/evidence-signals.js`, and add the smallest Evidence-owned representation that makes engine availability and engine quality unambiguous to consumers. Route Constellation selection, Rail, and Interface through that semantic boundary so they stop reconstructing meaning from raw transport/cache values.

Default to plain derived semantic values or helpers, not a new persisted per-edge lifecycle or class hierarchy. Keep acquisition/loading control flow in the existing facet owners. Infer routine naming and placement from the current code and durable docs; only stop for clarification if two choices would produce materially different Evidence semantics.

# Because:

`docs/components/evidence.md` §Purpose makes Evidence the sole owner of signal meaning, calculation, and epistemic state. `docs/components/constellation-selection.md` §Eligibility consumes engine/human signals for rare-candidate rescue/omission, `docs/components/rail.md` §Requirements consumes them for Rail filtering/navigation, and `docs/components/interface.md` §Requirements renders their visual treatment.

The semantic boundary must preserve distinctions that affect behavior: usable engine value, request failure, genuine absence/not-returned move, insufficient evaluation depth, and stale-but-usable cached evidence. Missing, failed, or insufficient evidence remains unknown rather than negative chess evidence. Source-position facet hydration remains owned by `PositionRepository`; Evidence must not introduce a second loading state machine.

# Edges:

Rated Explorer, Masters, and cloud-evaluation transport/failure behavior remains subject to `docs/components/lichess-access.md` §Data sources / §Cache and failure semantics and `docs/architecture/lichess-gateway.md` §Boundary. Constellation selection owns eligibility/order consequences; Rail owns Rail keep/suppress behavior; Interface owns rendered evidence channels. Evidence owns the semantic value they consume.

Prefer keeping transport/cache mechanics in `eval.js` and semantic interpretation beside `src/evidence-signals.js`. Split or rename existing helpers only when doing so removes duplicated interpretation or makes the ownership boundary directly testable; do not refactor merely to create a new module shape.

# Unsettled:

Choose the smallest consumer-facing engine-evidence value that preserves semantic quality plus the availability distinctions above. Default to an ephemeral derived value with explicit finite states rather than persisted pending/available/failed edge state. Pending acquisition remains control flow owned by the facet load.

If `eval.js` currently mixes transport mechanics with semantic chess judgments, move only the judgment logic needed by more than one consumer into the Evidence owner and leave endpoint/cache behavior in its existing owner.

# Complete:

Focused deterministic tests prove the semantic contract once: engine quality, human-result favorable/unfavorable/unknown state, source-local frequency, Root rarity, and request-failure/absence/insufficient distinctions are calculated by an Evidence owner and consumed without reinterpretation by selection, Rail, or Interface behavior. Reuse acquisition/cache tests for transport behavior and avoid duplicate tests that merely restate helper implementation.

# Sync:

After implementation or verification changes what remains, rewrite this entry around the factual open work rather than accumulating progress history. Continue through routine follow-up fixes and required checks without asking for confirmation. If the completion condition is satisfied, run Backlog Close; if Close cannot pass its normal gates, leave the entry open with the blocking condition explicit.
