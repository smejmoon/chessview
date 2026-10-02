# Quantitative values and constants

Chessview uses numeric values in several different roles. The goal is not to eliminate literals or centralize every number; it is to make ownership clear enough that a maintainer can tell what may be tuned, what belongs to one implementation, and what is constrained by another authority.

The main question is: **who owns the authority to change this value, and what kind of change would changing it represent?**

## Preferred homes

### Central Chessview policy

Use `src/config.ts` for Chessview-chosen quantitative policy that maintainers intentionally adjust as application behavior: thresholds, sample floors, timeouts, cache lifetimes, bounded lookahead, voluntary request spacing, and similar knobs.

A value does not need multiple consumers to belong in central config. It belongs there when its meaning is policy-level and a maintainer should reasonably be able to discover and adjust it without first reading the consuming algorithm.

Examples include Constellation rarity, Evidence thresholds and sample floors, source cache lifetimes, Cloud Eval minimum depth, and supplementary Explorer warm lifetime.

The owning component or architecture document still defines what the value means and any invariant around it. `src/config.ts` owns the concrete current value, not the semantic contract.

### Local named constants

Keep a value beside its consumer when it has semantic meaning but is primarily an implementation, presentation, diagnostic, or defensive choice whose meaning depends on that local code.

Prefer a descriptive local constant over an unexplained semantic literal. Examples include viewport breakpoints and board budgets, resize debounce, visible-composition fallback budgets, PGN formatting/search bounds, transposition search safety bounds, debug retention, and presentation widths.

Local does not mean unimportant. It means the surrounding module is the best place to understand and change the value.

### Boundary and identity constants

Keep values owned or constrained by another authority at that boundary rather than presenting them as ordinary Chessview tunables. This includes external protocol requirements, endpoint/source facts, canonical identities, database and schema names, schema versions, key paths, and migration markers.

If Chessview chooses a value within an externally constrained range, keep the external invariant visible at the boundary. Promote only the genuinely discretionary Chessview choice to `src/config.ts` when maintainers have a useful range to tune.

### Intrinsic arithmetic

Do not name arithmetic merely to remove a number. Operations such as advancing one ply, converting parity with modulo two, clamping to zero, or adding the current item are usually clearer inline when the operation itself carries the meaning.

## Decision heuristic

When introducing or reviewing a quantitative value, ask:

1. **What would changing it mean?** A change in Chessview policy, a local implementation choice, an external/protocol change, a schema migration, or merely different arithmetic?
2. **Who has authority to change it?** Chessview product/application policy, the local module, an external service/specification, or the storage/schema boundary?
3. **Where would a maintainer look for it?** If they should find it without understanding the consumer, central config is a good candidate. If changing it requires understanding the local algorithm or presentation, keep it local and named.
4. **Is the meaning actually shared?** Two equal numbers are not one policy just because their values match. Centralize shared semantics, not coincidental equality.
5. **Is the value still live policy?** Delete obsolete policy rather than preserving it as a configurable relic.

When uncertain, prefer the narrower home. A local constant can be promoted later when repeated maintenance proves that central discoverability is valuable.

## Promotion and demotion

Centralization is not permanent architecture. Promote a local value when it becomes a deliberate application-level knob, gains shared semantic ownership, or repeatedly causes maintainers to hunt through consumers. Keep or move a value local when central placement no longer helps understand or maintain behavior.

When policy disappears, remove the value rather than keeping a dead knob. When a public module historically exported a value that moves to central config, a compatibility re-export may remain if callers rely on that surface, but there should still be one source value.

## Review discipline

Treat this as a review guideline rather than a numeric-literal ban:

- question unexplained literals when they encode a threshold, limit, timeout, sample floor, capacity, or other semantic choice;
- expect central config additions to have a clear policy meaning and an owning consumer/document;
- expect meaningful local numbers to have descriptive local names when the name improves comprehension;
- do not centralize presentation details, diagnostic limits, algorithm safeguards, protocol facts, or identities merely because they are numeric;
- prefer behavioral tests over tests that enumerate where constants are stored; add a focused wiring test only when it protects a meaningful default from drifting away from its central source.

A linter that bans numeric literals or requires every constant in `src/config.ts` would be counterproductive: it would reward mechanical extraction instead of clear ownership. Code review should enforce the question and the naming discipline, while architecture remains free to evolve as values earn a different home.
