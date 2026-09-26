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

The GitHub Actions Pages workflow is the executable authority for CI/deployment mechanics. It must:

- install the locked dependency graph with `npm ci`;
- run deterministic tests before publication;
- build the Vite production bundle;
- publish `dist/` to the configured `gh-pages` target only after tests and build succeed.

Documentation should describe this behavior, but `.github/workflows/pages.yml` owns the exact commands and publication mechanics.

## Verification

- `npm test` is the deterministic repository test gate.
- `npm run build` is the production build gate.
- Changes that affect application code, build inputs, or the Pages workflow require a successful GitHub Actions run on the resulting commit before the change is treated as verified for deployment.
- Branch preview publication follows the repository's branch-preview workflow rather than redefining deployment policy here.
