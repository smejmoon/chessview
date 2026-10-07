# Delivery

## Purpose

Own Chessview's static application boundary, reproducible build, automated
verification, and GitHub Pages publication.

## Runtime and build

- Chessview is a static browser application with no application server.
- Vite + vanilla ES modules provide the development and production build.
- Node 24+ is the supported build/test environment.
- Dependency resolution is locked by `package-lock.json`.

## Continuous integration

`.github/workflows/ci.yml` is the executable authority for repository
verification. It uses read-only repository contents access and must:

- install the locked dependency graph with `npm ci`;
- run deterministic tests with `npm test`;
- type-check TypeScript with `npm run typecheck`;
- build the Vite production bundle with `npm run build`.

`Verify` is Chessview's name for the workflow's `verify` job. It is not a
GitHub-wide feature or separate branch state. Its job conclusion is the CI signal
used as merge-readiness evidence.

CI runs for every push except `gh-pages`, pull requests targeting `main`, and
explicit manual dispatch. Same-ref concurrency may cancel an older in-flight run
when a newer checkpoint is pushed.

`.github/workflows/pages.yml` owns GitHub Pages publication. It must:

- install the locked dependency graph;
- determine the production or branch-preview target;
- build the Vite bundle with the target base path;
- publish only to the intended `gh-pages` production root or `previews/`
  subtree.

Branch previews may publish independently of CI. Preview success does not verify
a commit.

## Pages reset

`.github/workflows/reset-pages.yml` owns explicit full reconstruction of the
published Pages snapshot. A reset uses the current repository branch heads as
its source of truth: `main` is required and publishes at the production root,
`gh-pages` is excluded, and every other still-existing branch publishes at its
canonical preview target from `scripts/pages-target.ts`.

A reset must:

- fetch and prune the current branch-head set before planning the snapshot;
- install, type-check, and build every planned branch from its own source tree
  in a job with read-only repository contents authority;
- assemble the complete production root and all surviving branch previews in a
  temporary snapshot before changing publication state;
- leave `gh-pages` unchanged if any planned branch cannot be prepared;
- transfer the completed snapshot to a separate publication job before granting
  repository write authority;
- execute no branch-controlled dependency, type-check, or build command in the
  publication job that can write the repository;
- serialize with ordinary Pages publication through the shared `pages-publish`
  concurrency group;
- after successful assembly, replace `gh-pages` with one parentless deployment
  commit containing exactly that snapshot.

Branch existence is the preview-retention rule: an undeleted non-`main` branch
is rebuilt by the next reset, while a deleted branch's preview disappears. The
reset intentionally discards reachable deployment history by force-updating only
`gh-pages`; it does not rewrite or delete `main` or task branches.

## Verification

Changes that affect application code, build inputs, or CI behavior require
successful exact-tip CI evidence before integration.

For a named task branch:

1. Resolve the current task-branch ref to commit SHA `X`.
2. Find a `CI` workflow run whose `head_sha` is exactly `X`.
3. Inspect that run's latest attempt and require its `Verify` job conclusion to
   be `success`.
4. Re-resolve the task branch before relying on the result. If its tip is no
   longer `X`, the run does not verify the new tip.

A successful `Verify` for another SHA, including an ancestor of `X`, is not
exact-tip evidence. If the same SHA needs another check, rerun its existing
workflow run rather than changing branch state solely to manufacture a new run.

After integration to `main`, both CI and the production Pages build/deploy must
succeed on the resulting `main` tip. Changes to Pages publication mechanics also
require a successful Pages run on the resulting commit.
