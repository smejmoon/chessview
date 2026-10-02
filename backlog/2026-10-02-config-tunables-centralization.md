# Do:

Inventory existing implementation-tunable policy values that are still defined inside their consumers and move the qualifying source values into named exports from `src/config.ts`, updating consumers and verification without changing behavior. Known examples include Constellation's `0.05` rarity threshold, Rail's `100`-game sample floor and `0.05` popular-share threshold, and the `30_000 ms` supplementary Explorer-warm timeout.

Use the ownership rule already documented in `src/config.ts`: centralize concrete limits, thresholds, sample floors, timeouts, and similar maintainer-adjustable policy values so their algorithms do not retain private magic-number homes.

# Because:

`src/config.ts` is now the declared central source-value home for Chessview implementation tunables, while several existing tunables still live in component or acquisition modules. Leaving those values distributed makes the new ownership rule incomplete and forces maintainers to keep hunting through consuming algorithms for knobs that are intended to be centrally discoverable.

This outcome inherits the existing behavior of each tunable. It is a source-ownership migration, not an opportunity to change threshold meanings or values.

# Edges:

Product and component documents continue to own what each tunable means, the behavior it controls, and any invariant around it. Centralizing a numeric source value in `src/config.ts` does not by itself promote that number into a product commitment or remove semantic ownership from its component.

Do not move user preferences, environment or secret configuration, source facts, canonical identities, protocol constants, or intrinsic invariants into `src/config.ts`. Remaining numeric constants may stay local when they fall into those excluded categories rather than tunable policy.

Keep this separate from behavior-changing outcomes such as `backlog/2026-10-01-constellation-selection-code-alignment.md`; centralization should preserve current selection, Rail, acquisition, and presentation behavior while making tunable values centrally discoverable.

# Complete:

A bounded source inventory has identified the existing implementation tunables covered by the `src/config.ts` ownership rule. Every qualifying value is sourced from `src/config.ts` rather than privately defined in a consumer, remaining local constants are excluded by the documented boundary rather than overlooked, and affected deterministic tests plus TypeScript checks pass without intentional behavior changes.

# Sync:

After any implementation or verification step that changes what remains, and before ending an implementation pass, synchronize this entry. Also synchronize when an action completes or becomes unavailable, a blocking condition changes, or a judgment is settled. Rewrite around the factual work and verification still open; do not accumulate progress history. If an outcome's completion condition is satisfied, run Backlog Close for that outcome. If Close cannot pass its normal gates, leave the entry open with the blocking condition explicit.
