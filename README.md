# Chessview

Chessview is a static opening explorer that treats chess positions as a spatial directed graph rather than a move list.

The **Nodus** is the canonical position currently organizing the map and appears as a large playable Chessground board. Chessview calls visible upstream context **Roots** and forward continuations **Lines**. The coherent current-view subgraph around the Nodus is the **Constellation**. A position can have multiple Roots when different move orders transpose into the same canonical position. Surrounding Constellation positions are rendered as smaller navigation boards, while the **Rail** provides supporting controls and evidence.

## Run locally

Requires Node 24+.

```bash
npm install
npm run dev
```

Tests and production build:

```bash
npm test
npm run build
```

## Deployment

Verification and publication are separate GitHub Actions concerns. The CI workflow runs the deterministic tests and production build for pull requests targeting `main`, pushes to `main`, and manual dispatch. The Pages workflow builds and publishes `main` at the production root and other pushed branches under their branch-preview target. A successful preview is a development artifact, not a substitute for CI evidence.

Configure GitHub Pages to serve the root of `gh-pages`.

## Graph behavior

Knowledge acquisition and visible composition are separate. Chessview may fetch, derive, reconcile, and persist more graph/evidence information than the current Constellation shows. The Constellation selects a coherent subgraph sized to available presentation space; automatic candidates are currently bounded by rated Lichess Explorer frequency data. Frequency orders candidates locally when they share the same source position, while engine/human evidence can keep significant rare candidates eligible and unknown evidence stays unknown rather than becoming negative evidence. Cross-branch allocation belongs to Constellation coherence rather than one global percentage rank. Canonical transpositions merge by chess state rather than consuming duplicate visible positions.

See [`docs/README.md`](docs/README.md) for the documentation map. Product direction lives in [`docs/vision.md`](docs/vision.md), cross-product conditions in [`docs/product.md`](docs/product.md), detailed requirements under [`docs/components/`](docs/components/), and independently maintained boundaries under [`docs/architecture/`](docs/architecture/). Unfinished work lives in [`backlog/`](backlog/).

## License

Chessview is licensed GPL-3.0-or-later because it integrates Chessground, which is GPL-3.0-or-later.
