# Do:

Determine a small, representative set of **the signed-in player's frequently reached canonical opening positions**, then find strong Lichess players whose repertoires actually overlap those positions and whose subsequent move choices resemble the player's. Use the standalone [Repertoire Lab](../prototypes/repertoire-matches/README.md), not the main Constellation UI.

Resume from **position selection**, before changing discovery or similarity scoring:

1. Export positions with **History: 12 months; Color: Both; Depth: All; Minimum games: 3** using the Repertoire Lab **Export positions** button. This is a download of *derived position statistics*, not candidate game histories. Its `repertoire-positions-1` JSON records canonical FEN keys, representative routes, decision plies, counts and move frequencies.
2. Inspect the exported frequencies **separately for White and Black**. Select informative, distinct positions across opening families and depths, joining transpositions by canonical key, and avoid counting a chain of near-identical ancestor/descendant positions as independent evidence. Compare a few plausible selection rules (pure frequency versus diversity versus distinctive later moves) against the same fixed export. Keep the rationale and inclusion/exclusion counts visible.
3. Only after selecting positions, use aggregate rated Lichess Opening Explorer, date/rating filters and its representative games to discover titled, strong accounts. It is a **candidate source**, not a complete roster of strong players for any position.
4. Verify selected players at the selected positions with **Player Opening Explorer** for the same color and date window, including number of games and distributions of next moves. Prefer players who *regularly* reach several relevant positions, not only high-rated players who appeared in one representative game. Compare White and Black separately.
5. Evaluate whether the selected positions and candidate rankings are useful and inspect request counts, elapsed time, complete/partial indexing and supporting example lines. Iterate using the fixed position export instead of re-downloading own games for each selection experiment.

# Blocked:

A broad position-frequency sample is needed to decide a diverse shortlist empirically. The only position export supplied so far used **12 months, Both colors, depth W8/B7, minimum 10 games**, yielding four positions; that narrow sample does not show how other opening branches and deeper decisions compare. A new export with **All depths, minimum 3** clears the blocker. The existing four positions can still be used for exploratory analysis.

# Because:

The goal is **find strong players with a genuinely similar opening repertoire**, not maximize overlap in universally common early positions or rank players purely by rating.

Current source owners:
- [Repertoire Lab README](../prototypes/repertoire-matches/README.md) describes the current experiment, authentication, network constraints and JSON formats.
- [position-export.ts](../prototypes/repertoire-matches/position-export.ts) constructs reproducible position-frequency snapshots; [matcher.ts](../prototypes/repertoire-matches/matcher.ts) builds the signed-in user's repertoire from a bounded game export, merging transpositions by canonical position.
- [position-matcher.ts](../prototypes/repertoire-matches/position-matcher.ts) currently chooses up to five frequent positions at each of two decision depths per color. [lichess-source.ts](../prototypes/repertoire-matches/lichess-source.ts) performs aggregate discovery and bounded Player Explorer verification; [app.ts](../prototypes/repertoire-matches/app.ts) connects the workflow.
- The [canonical-position graph identity](../src/graph.ts) is the maintained identity of a chess position, independent of move order.

Observed position export from **2026-11-19**: 325 eligible games (172 White, 153 Black), 4 positions at W8/B7 and minimum 10: Black Caro-Kann Exchange 15 games (all `...Nc6`); Black Caro-Kann Classical 14 (`...Nf6` 10, `...Bf5` 4); White Smith-Morra 12 (all `Nf3`); White French Advance 11 (all `Nf3`). These counts come from the user's `repertoire-positions-1` export shared in the project conversation; **the exported JSON is not committed to this repository**. The four positions suggest a promising core, but do not justify a final search set.

The prototype's newer matching method **does not download candidate games**. It uses Player Explorer's game counts and move distributions, treating unqueried, timed-out or partially indexed results as *unknown*, never as zero. The current four-check-per-candidate limit makes scores provisional and was chosen for bounded cost, not as an evidence-completeness guarantee. The streaming timeout fix (commit `d69ad85`) passed CI but its effect on live indexing runtime still needs verification. The strict position-JSON serialization fix (commit `fde2c43`) also passed CI/Pages. Recheck current branch-tip evidence before changing these claims.

# Unsettled:

- At which positions/depths do choices become distinctive enough to distinguish repertoires? Is a fixed depth useful, or should selection vary by branch?
- How to balance frequent positions, opening-family diversity, unique candidate-discriminating choices and deeper positions without overrepresenting the same game or opening?
- What makes a candidate's participation sufficiently *regular*? Consider both games at the position and the share of their games with that color, not only absolute hits.
- How many Player Explorer checks are worth the indexing cost, and how should partial observations influence ranking confidence versus score?
- What result would make the repertoire matches demonstrably better than the current baseline? Compare candidate discovery breadth, verified overlap and move agreement separately.

# Edges:

- No candidate PGN/game-history downloads are needed for scoring; only the signed-in player's own bounded game export builds the baseline repertoire.
- A saved exported position snapshot can be inspected or optionally committed **as an explicit later choice**. It retains the account name and example-game IDs; no anonymization is required for a user-requested local export. No automatic publication of player data to the public GitHub repository.
- Keep this as a reversible experiment under `prototypes/repertoire-matches/`. Do not change the production Constellation or invent a parallel Lichess transport. All Lichess API traffic must remain through the shared `LichessGateway` and authenticated `LichessSession`, respecting its rate-limit, cancellation and 429 policy.
- Continue using the [Repertoire Lab README](../prototypes/repertoire-matches/README.md) as the maintained description of implementation. This entry tracks **unfinished outcome and selection decisions**, not a second implementation specification.

# Complete:

A reproducible position-frequency snapshot has been inspected; a compact, reasoned position selection covers meaningful White and Black opening branches without treating transpositions or closely related positions as unrelated evidence; and the Explorer-only matching experiment identifies and explains credible titled candidates through **verified position participation and next-move statistics**, with complete-versus-partial evidence and request cost visible. A negative result is also complete if evidence demonstrates that representative-game discovery or Player Explorer coverage cannot support useful matching under practical limits, with that finding recorded.
