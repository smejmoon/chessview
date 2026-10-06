# Preview prompt

Load this file whenever a Chessview preview is explicitly requested or when deployed visual inspection is needed to judge the current work.

Follow `chatgpt/branch-preview.md` for publication mechanics and lifecycle. This file owns how preview results are inspected and reported.

## Inspection rules

- Report the exact branch preview root URL.
- When the work changes Constellation geometry, selection, Root/Line presentation, evidence decoration, or other map behavior, also report the canonical scenario deep links below.
- Do not judge geometry while the view is still visibly `Updating…`, loading engine data, or otherwise settling. Wait for the accepted view to settle before calling a visual defect. Slow settlement is a separate performance/settlement observation.
- Treat the scenarios as topology fixtures, not as certification of opening theory.
- Prefer comparing several graph shapes over accepting a layout from one friendly position.
- When acquisition/settlement behavior matters, inspect both a cold and warm pass of the same link. In Debug, use `Refetch view` for a cold pass of the current Nodus plus currently visible Constellation positions; after it settles, reload the same link without clearing anything for the warm pass.
- `Clear Explorer cache` is the broader diagnostic reset. It removes persisted and admitted Explorer readings while preserving structural graph knowledge, then reloads the current position. Use it when a scenario must be made globally cold rather than only cold for the current view.

## Canonical topology scenarios

| Scenario | Stress | FEN | Default view |
| --- | --- | --- | --- |
| Sparse endgame smoke | fast cold-acquisition sanity check with little or no branching | `8/8/8/8/8/4k3/4P3/4K3 w - - 0 1` | `lines` |
| Panov Attack | dense transpositions / move-order context | `rnbqkbnr/pp2pppp/8/3p4/2PP4/8/PP3PPP/RNBQKBNR b KQkq - 0 4` | `roots` |
| QGD / English transposition | alternate move orders converging into one structure | `rnbqkb1r/ppp2ppp/4pn2/3p4/2PP4/2N5/PP2PPPP/R1BQKBNR w KQkq - 2 4` | `roots` |
| Réti → Catalan structure | flank-opening transposition into a queen-pawn family | `rnbq1rk1/ppp1bppp/4pn2/3p4/2PP4/5NP1/PP2PPBP/RNBQ1RK1 b - - 0 6` | `roots` |
| Marshall Attack | long forcing continuation | `r1bq1rk1/2p1bppp/p1n2n2/1p1pp3/4P3/1BP2N2/PP1P1PPP/RNBQR1K1 w - - 0 9` | `lines` |
| Semi-Slav Botvinnik | long forcing tactical chain with branching theory | `rnbqkb1r/p4p2/2p1pn2/1p2P1B1/2pP4/2N5/PP3PPP/R2QKB1R b KQkq - 0 10` | `lines` |
| Najdorf Poisoned Pawn | highly critical, sharp path with severe move-order consequences | `rnb1kb1r/1p3ppp/p2ppn2/6B1/3NPP2/2N5/PqPQ2PP/R3KB1R w KQkq - 0 9` | `lines` |

Build each scenario link as `?fen=<encoded FEN>&view=<default view>` against the exact branch preview base URL. Keep the report compact: branch root first, then the scenario name and deep link for each fixture relevant to the work.
