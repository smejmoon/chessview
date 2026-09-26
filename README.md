# Chessview

Chessview is a static opening explorer that treats chess positions as a spatial directed graph rather than a move list.

The current position is a large playable Chessground board. Chessview calls known positions that can reach it **Roots**, and forward continuations from it **Lines**. A position can have multiple Roots when different move orders transpose into the same canonical position. Nearby known positions are rendered as smaller navigation boards, while opening statistics come directly from the live Lichess Opening Explorer in the browser.

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

Pushes to `main` run deterministic tests and a Vite production build. If both pass, the workflow publishes `dist/` to the `gh-pages` branch. Configure GitHub Pages to serve the root of `gh-pages`.

## Graph behavior

Automatic expansion is local to each source position: a move qualifies when it accounts for at least 5% of games at that position and the source sample meets the tunable sample floor. The graph merges positions by canonical chess state, ignoring FEN clocks while retaining future-relevant board state, castling rights, side to move, and relevant en-passant state.

See [`docs/PLAN.md`](docs/PLAN.md) for the canonical **Roots / Lines** terminology, product commitments, and the component map. Detailed requirements and verification live under [`docs/components/`](docs/components/), with independently maintained architectural boundaries under [`docs/architecture/`](docs/architecture/).

## License

Chessview is licensed GPL-3.0-or-later because it integrates Chessground, which is GPL-3.0-or-later.
