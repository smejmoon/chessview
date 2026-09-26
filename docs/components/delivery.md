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
- build the Vite production bundle with `npm run build`.

CI runs for pull requests targeting `main`, pushes to `main`, and explicit manual dispatch. Its `Verify` job is the stable verification signal used for merge-readiness evidence.

`.github/workflows/pages.yml` owns GitHub Pages publication. It must:

- install the locked dependency graph;
- determine the production or branch-preview Pages target;
- build the Vite bundle with the target base path;
- publish only to the intended `gh-pages` production root or `previews/` subtree.

Branch previews are development artifacts and may publish independently of CI. A successful preview does not by itself establish merge readiness.

## Verification

- `npm test` is the deterministic repository test gate.
- `npm run build` is the production build gate.
- Changes that affect application code, build inputs, or CI behavior require successful CI evidence for the relevant resulting commit before they are treated as verified for integration.
- After integration to `main`, both CI and the production Pages build/deploy must succeed on the resulting `main` tip.
- Changes to Pages publication mechanics require a successful Pages run on the resulting commit.
- Branch preview publication follows the repository's branch-preview workflow rather than redefining integration policy here.
