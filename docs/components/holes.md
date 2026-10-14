# Find the Holes

Find the Holes is a separate read-only chess-awareness game entered from Chessview's top bar. It does not replace Nodus, Constellation, Rail, position URL, or startup authorization.

Each round takes a standard game from public Lichess TV through LichessGateway, chooses an intermediate ply, and reconstructs its position from the recorded SAN. The original Lichess game remains linked. The user selects White or Black, marks target squares, reveals correct/missed/extra markings, then samples another game. Changing challenge or side restarts grading on the same position.

Only empty squares within files b–g and ranks 3–5 (White) or ranks 4–6 (Black) are markable. The training zone is intentionally finite so players can inspect every candidate.

- **Undefended:** empty squares attacked by the opposing side and not controlled by any friendly piece. This describes board attacks, not engine-verified exploitation.
- **Pawn holes:** empty squares no surviving friendly pawn can attack now or after theoretically advancing on its current file. Ignore obstructions and file-changing captures. This conservative structure-only condition does not imply the opponent can use every answer.

If Lichess is unavailable, the game offers retry rather than inventing a position. Domain calculation and grading live in src/holes-rules.ts, source acquisition in src/holes-source.ts, and the independent interface in src/holes-game.ts. No game history is written to Chessview's position graph.
