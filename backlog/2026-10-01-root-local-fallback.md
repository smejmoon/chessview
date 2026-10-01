# Do:

Provide a cheap local provisional Root projection while authoritative Root knowledge is still pending, so Roots can appear promptly without consuming Lichess request capacity ahead of more valuable foreground acquisition.

# Because:

Root projection currently depends on `composeNodusStructure()` paths that can trigger Explorer Reading acquisition and transposition enrichment. That makes Root availability compete with Line acquisition even though a provisional one-ply predecessor view can be derived locally and later refined when authoritative graph/Explorer knowledge arrives.

Current-view architecture already permits a trustworthy current-generation projection to publish before structural work settles and to be replaced by a refined immutable value within the same Nodus generation. A local Root fallback should use that existing refinement model rather than introduce another generation or source-freshness protocol.

# Edges:

`backlog/2026-10-01-current-view-sibling-scheduling.md` owns which work receives acquisition priority between sibling Root/Line projections. This outcome is not a prerequisite for that scheduling correction: sibling scheduling can prioritize foreground acquisition without any local Root fallback.

The fallback is temporary structural assistance, not a new authoritative knowledge source. It must not own persistence, remote acquisition, freshness, background scheduling, or historical-occurrence truth. Explorer/ChartedGraph knowledge remains authoritative for observed or enriched ancestry.

A local candidate may establish only that a predecessor can reach the current canonical position by one legal move under the supported local validation semantics; it must not imply that the predecessor occurred historically or is reachable from the initial position.

# Unsettled:

Choose the smallest useful predecessor coverage for provisional Roots, including whether ordinary moves/captures and promotions are sufficient initially or whether en passant and castling are required before the fallback is trustworthy enough to publish.

Settle how provisional local candidates merge with known Root graph structure so authoritative knowledge refines or replaces them without creating duplicate Root identity or a second reconciliation lifecycle.

# Complete:

A Root projection can publish promptly from local computation when authoritative Root knowledge is unavailable, is clearly treated as provisional rather than historical truth, and later authoritative knowledge can refine the same Nodus generation without extra network acquisition being required merely to produce the fallback. The fallback introduces no independent persistence, freshness, scheduler, or currentness ownership.

# Sync:

After any implementation or verification step that changes what remains, and before ending an implementation pass, synchronize this entry. Also synchronize when an action completes or becomes unavailable, a blocking condition changes, or a judgment is settled. Rewrite around the factual work and verification still open; do not accumulate progress history. If an outcome's completion condition is satisfied, run Backlog Close for that outcome. If Close cannot pass its normal gates, leave the entry open with the blocking condition explicit.
