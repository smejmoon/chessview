# Do:

Move the `composeNodusStructure` call contract to its source-owned boundary so `src/main.ts` can call it directly without the `composeStructure` type assertion.

# Because:

The initial TypeScript integration exposed a real contract mismatch: `src/main.ts` currently has to assert that `composeNodusStructure` accepts `{ center, mode, max?, signal? }`, even though those are the inputs its caller actually supplies. The workaround makes the consumer describe the producer's API and can hide drift between the implementation and its intended contract.

# Edges:

Keep this outcome focused on the `composeNodusStructure` boundary and its direct consumers. It does not require a repository-wide TypeScript migration, `strict` mode, or `checkJs`. If making the contract explicit exposes an incorrect API shape, fix the smallest owning boundary rather than preserving a consumer-side cast.

# Unsettled:

Decide the smallest source-owned representation for the contract: migrate the owning module to TypeScript, or keep JavaScript and expose an equivalent checked contract. Settle the real optionality and domain shape of `mode`, `max`, and `signal` from implementation and callers rather than copying the temporary assertion mechanically.

# Complete:

`src/main.ts` uses `composeNodusStructure` directly with no consumer-side type assertion; the accepted options are explicit at the source-owned boundary; and tests, TypeScript checking, and the production build pass without weakening compiler settings to hide the mismatch.

# Steps:

Inspect `src/nodus-structure.js` and every direct caller to establish the actual call shape and optionality.

Define the contract at the owning module in the smallest checked form that fits the current incremental TypeScript strategy.

Remove the `composeStructure` assertion from `src/main.ts` and use `composeNodusStructure` directly.

Run deterministic tests, TypeScript checking, and the production build; update this entry around anything that remains.

# Sync:

After any implementation or verification step that changes what remains, and before ending an implementation pass, rewrite this entry around the factual work and verification still open; do not accumulate progress history. If `Complete:` is satisfied, run Backlog Close. If Close cannot pass its normal gates, leave the entry open with the blocking condition explicit.
