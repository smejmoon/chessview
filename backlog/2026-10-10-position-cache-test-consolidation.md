# Do:

Simplify cache and provider tests now that the repository owns the generic cache lifecycle. Keep shared cache behavior verified at the repository boundary, source-specific parsing and quality verified in source tests, and delete tests or helpers that no longer guard independent requirements.

Consolidate behavior that will have one owner rather than retaining the same assertions in every provider suite. Concrete reduction candidates:
- Move generic cache-hit, freshness, stale-data-first delivery, due background refresh, shared refresh, and failed-persistence behavior to focused `PositionRepository` contract tests instead of testing equivalent branches through all three providers.
- After repository coverage exists, remove overlapping provider cases such as `Explorer admits once and reuses the live observation when persistence fails`, `valid fresh Masters Reading remains usable and is reused when persistence fails`, and `usable cloud eval survives local cache-write failure and reuses repository-current value`, keeping only any source-specific status/quality assertion that cannot be tested generically.
- Retire duplicate hand-built cache implementations in test fixtures (notably `repositoryStub` in the Masters and cloud-eval suites) when the provider tests can exercise the actual repository or a smaller source-specific stub. Prefer fewer fixtures over extracting a new shared test-helper framework.
- Remove assertions that require network refresh to finish before returning compatible stale observations, or that equate reaching a TTL with making positive data unusable; replace them with the cache-first contract.

Inspect `test/position-repository.test.ts`, `test/explorer-provider.test.ts`, `test/masters-provider.test.ts`, `test/eval-loading.test.ts`, and other cache tests for any additional overlapping behavior, but do not delete a case purely because it resembles another: the same scenario may still guard a distinct source contract.

# Because:

The agreed [Position cache](../docs/architecture/position-cache.md) contract centralizes generic caching. Provider suites still contain overlapping generic cache cases even though replacement repository coverage now exists; duplicate test lifecycles should not survive only because they once tested separate implementations.

# Edges:

Keep independent coverage for request-profile matching, Root representative-game completeness, source validation, Masters population, cloud-eval depth and 404, auth recovery, shared request cancellation/priority, cache clearing without deleting graph structure (including its existing debug path), source activity versus Weather, and representative debug diagnostics. Preserve a provider-specific failure test only when the behavior differs materially from generic cache failure; the operational issue channel is one such distinction. Avoid a new fixture framework or exhaustive tests of hypothetical browser-cache anomalies.

# Complete:

One clear suite guards each generic repository behavior; source suites guard only distinctive semantics. No tests require fetch-before-cached-delivery or impose a maximum cache age. Any deleted test/helper is genuinely redundant, generic behavior is not retested as three source-specific copies, and the resulting suite is smaller without losing independent obligations. Tests, typecheck and build pass.

# Sync:

Use backlog-tend for routine synchronization.
