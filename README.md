# Chessview

Chessview is a static opening explorer that treats chess positions as a spatial directed graph rather than a move list.

The **Nodus** is the canonical position currently organizing the map and appears as a large playable Chessground board. Chessview calls known upstream positions **Roots** and forward continuations **Lines**. A position can have multiple Roots when different move orders transpose into the same canonical position. Nearby known positions are rendered as smaller navigation boards, while opening statistics come directly from the live Lichess Opening Explorer in the browser.

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

Automatic expansion is local to each source position: a move qualifies when it accounts for at least 5% of games at that position and the source sample meets the tunable sample floor. The graph merges positions by canonical chess state, ignoring FEN clocks while retaining future-relevant board state, castling rights, side to move, and relevant en-passant state.

See [`docs/README.md`](docs/README.md) for the documentation map. Product direction lives in [`docs/vision.md`](docs/vision.md), cross-product conditions in [`docs/product.md`](docs/product.md), detailed requirements under [`docs/components/`](docs/components/), and independently maintained boundaries under [`docs/architecture/`](docs/architecture/). Unfinished work lives in [`backlog/`](backlog/).

## License

Chessview is licensed GPL-3.0-or-later because it integrates Chessground, which is GPL-3.0-or-later.
