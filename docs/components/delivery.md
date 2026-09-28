# Delivery

## Purpose

Own Chessview's static application boundary, reproducible build, automated verification, and GitHub Pages publication.

## Runtime and build

- Chessview is a static browser application with no application server.
- Vite + vanilla ES modules provide the development and production build.
- `chess.js` and Chessground are browser dependencies used by the graph/interface components.
- Node 24+ is the supported build/test environment.
- Dependency resolution is locked by `package-lock.json`.

## Continuous integration

`.github/workflows/ci.yml` is the executable authority for repository verification. It uses read-only repository contents access and must:

- install the locked dependency graph with `npm ci`;
- run deterministic tests with `npm test`;
- type-check TypeScript with `npm run typecheck`;
- build the Vite production bundle with `npm run build`.

`Verify` is Chessview's name for the single `verify` job in `.github/workflows/ci.yml`. It is not a GitHub-wide feature or a separate branch state. GitHub Actions executes that named job for a workflow run and exposes its status/conclusion as a check on the run's commit. In Chessview, a successful `Verify` job is the stable CI verification signal used as merge-readiness evidence.

CI runs for every push except `gh-pages`, pull requests targeting `main`, and explicit manual dispatch. A push to a named task branch therefore produces a CI workflow run tied to that pushed commit. Same-ref concurrency may cancel an older in-flight run when a newer checkpoint is pushed.

`.github/workflows/pages.yml` owns GitHub Pages publication. It must:

- install the locked dependency graph;
- determine the production or branch-preview Pages target;
- build the Vite bundle with the target base path;
- publish only to the intended `gh-pages` production root or `previews/` subtree.

Branch previews are development artifacts and may publish independently of CI. A successful preview does not by itself establish merge readiness.

## Verification

- `npm test` is the deterministic repository test gate.
- `npm run typecheck` is the TypeScript verification gate.
- `npm run build` is the production build gate.
- Changes that affect application code, build inputs, or CI behavior require successful CI evidence for the relevant resulting commit before they are treated as verified for integration.
- Exact-tip CI evidence for a named task branch is established by this procedure:
  1. Resolve the current task-branch ref to commit SHA `X`.
  2. Find the `CI` workflow run whose `head_sha` is exactly `X`.
  3. Inspect that run's `Verify` job and require its conclusion to be `success`. If the run has multiple attempts, inspect the latest attempt.
  4. Re-resolve the task branch before relying on the evidence; if its tip is no longer `X`, the old run does not verify the new tip.
- A successful `Verify` for another SHA, including an ancestor of `X`, is not exact-tip evidence.
- If the same SHA needs to be checked again, rerun its existing workflow run rather than changing branch state solely to manufacture another CI run.
- After integration to `main`, both CI and the production Pages build/deploy must succeed on the resulting `main` tip.
- Changes to Pages publication mechanics require a successful Pages run on the resulting commit.
- Branch preview publication follows the repository's branch-preview workflow rather than redefining integration policy here.
