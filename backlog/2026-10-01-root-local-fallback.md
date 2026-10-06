# Do:

Bootstrap authoritative Root/sibling context for an arbitrary canonical Nodus that has no known incoming Graph Edge.

Use representative rated-Lichess games attached to the Nodus Explorer Reading as bounded discovery seeds. Batch-export those games, replay them locally, and nominate the distinct canonical predecessor sources observed immediately before the exact Nodus. Refine each nominated source through ordinary Explorer acquisition/reconciliation; only that normal path may establish durable Root and sibling Graph Edges.

Do not require prior navigation history or a previously known incoming edge merely to discover Roots for a directly loaded FEN.

# Because:

The Root path has a bootstrap hole when composition starts only from already-known incoming Graph Edges. Representative games can reveal real predecessor source positions without inventing reverse-chess truth, and one predecessor Explorer Reading naturally supplies both the move into the Nodus and sibling moves from that same source.

Sampling is discovery only. Explorer remains authoritative for graph admission and for quantitative game counts.

# Edges:

A sampled predecessor is a transient nomination. It must not be persisted into ChartedGraph, displayed as an authoritative Root, or promoted to a Selection Candidate solely because one exported game traversed it.

Explorer/Knowledge Acquisition remains authoritative for whether the predecessor relationship is supported and for admitting Graph Edges. Existing PositionRepository, LichessGateway, Evidence, Current View, and Candidate-selection ownership stays in place; this outcome must not create a second cache, scheduler, freshness protocol, or reconciliation lifecycle.

Root transposition enrichment remains downstream of authoritative topology. Current View nominates it only after the accepted Roots composition contains an authoritative incoming relationship to the Nodus.

Root coverage is measured only from authoritative Explorer data: sum the selected Root moves' game counts from their predecessor Readings and divide by the Nodus Explorer total. Sample frequency never contributes to coverage.

Root discovery is a semantic current-view activity, not a Constellation Reading-frontier obligation. Presentation may expose whether it is finding roots, retry-waiting, satisfied, unavailable, or failed without exposing internal task keys.

# Unsettled:

The practical bootstrap now requests the full bounded representative-game sample available from the center Explorer query rather than an arbitrary four-game subset. Cached center Readings from older builds that contain a smaller representative payload are explicitly refreshed once before discovery, so a fresh aggregate cache hit cannot silently cap Root coverage.

Sampled game export is replayed using Lichess's exported PGN/SAN move sequence, honoring an exported initial FEN when present. Distinct observed predecessor sources are reconciled sequentially through ordinary Explorer refinement.

The Panov branch preview demonstrated authoritative Root/sibling bootstrap and measurable coverage. Continue using coverage from real fixtures to decide whether the bounded representative sample is sufficient in practice. Only if meaningful uncovered mass remains after the full sample should a local predecessor-hypothesis fallback be reconsidered; do not add that machinery merely to chase theoretical completeness.

# Complete:

A directly loaded canonical Nodus with no previously known incoming Graph Edge can bootstrap Root discovery from bounded representative Lichess games. Ordinary Explorer reconciliation establishes any supported predecessor → Nodus relationship and sibling relationships from the same source, and the same current Nodus refines to authoritative Root/sibling context without prior navigation history.

The Roots control exposes discovery progress while work is active and authoritative game coverage after incorporation. Old cached Readings lacking the full representative payload are repaired by one explicit refresh rather than silently satisfying bootstrap.

No sampled game establishes durable topology or contributes quantitative coverage by itself. The solution introduces no independent persistence, freshness, scheduler, currentness, or Candidate-eligibility ownership.

# Sync:

After any implementation or verification step that changes what remains, and before ending an implementation pass, synchronize this entry. Also synchronize when an action completes or becomes unavailable, a blocking condition changes, or a judgment is settled. Rewrite around the factual work and verification still open; do not accumulate progress history. If an outcome's completion condition is satisfied, run Backlog Close for that outcome. If Close cannot pass its normal gates, leave the entry open with the blocking condition explicit.
