# Chessview

Chessview is a static opening explorer that treats chess positions as a spatial directed graph rather than a move list.

The current position is a large playable Chessground board. Nearby known positions are smaller navigation boards arranged around it, with incoming context above, continuations below, and learned siblings/transpositions laterally. Opening statistics come directly from the live Lichess Opening Explorer in the browser.

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

See [`docs/PLAN.md`](docs/PLAN.md) for the v1 goals, requirements, implementation decisions, and verification plan.

## License

Chessview is licensed GPL-3.0-or-later because it integrates Chessground, which is GPL-3.0-or-later.
