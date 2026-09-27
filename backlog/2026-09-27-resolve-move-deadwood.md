# Do:

Prove that no live caller still depends on `moveToChild()` and remove that compatibility wrapper, migrating any remaining caller to the canonical `resolveMove()` contract first if one is found.

# Because:

`docs/components/position-graph.md` §Implementation names `src/graph.js::resolveMove()` as the single owner of pure source-position + Move resolution. `src/graph.js` still exports `moveToChild()` as a thin `{ target -> key }` compatibility adapter retained only because earlier GitHub code-search evidence was incomplete.

# Edges:

Do not change Resolve Move semantics, Move materialization, canonical-position identity, or Explorer behavior. This is deadwood removal only after reader absence is established from current repository evidence.

# Unsettled:

Determine whether any unindexed test, script, or application module still imports `moveToChild()` and whether any such reader actually requires the old `key` result name.

# Complete:

A repo-wide current-tip reader sweep establishes either that `moveToChild()` has no live callers or migrates every caller; the wrapper/export is removed; no stale references remain; deterministic tests/build pass.

# Steps:

Use exact-tree inspection plus code search/search-recovery to enumerate all possible live readers.

Migrate any real reader to `resolveMove()` with explicit `target` vocabulary.

Remove the wrapper and add or adjust focused tests only if needed to protect the canonical contract.

# Sync:

After any implementation or verification step that changes what remains, and before ending an implementation pass, rewrite this entry around the factual work and verification still open; do not accumulate progress history. If `Complete:` is satisfied, run Backlog Close. If Close cannot pass its normal gates, leave the entry open with the blocking condition explicit.
