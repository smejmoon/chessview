# Do:

Remove `qualifies` from generic Explorer move decoration after confirming each remaining consumer needs only source evidence such as games/share or owns its own classification rule. Refactor `src/graph.js::decorateExplorerMoves()` so it decorates Explorer moves with evidence rather than embedding an automatic-selection verdict, and update Rail/tests that consume that helper without changing their product behavior.

# Because:

`src/graph.js::decorateExplorerMoves()` still derives `qualifies` from the historical sample-floor/share-threshold rule. Constellation now has no compatibility use for that verdict: `docs/components/constellation-selection.md` and `src/constellation-selection.ts` require usable rated-Lichess Prevalence to construct a Candidate, composition consumes the selected Candidate objects directly in selection order, and explicit navigation remains independent of Candidate admission. `src/rail-source.ts` separately owns Rail's `isNotableLine()` classification after consuming Explorer evidence.

Keeping a generic source-evidence helper named around decoration while also embedding an obsolete cross-component admission verdict invites later consumers to treat that verdict as authoritative outside its owner.

# Edges:

Preserve raw Explorer evidence semantics and Rail inventory/Notable-Line behavior. Do not replace `qualifies` with another generic admission/classification bit, and do not use source decoration to recreate an explicit-navigation exception to Candidate admission.

This outcome does not decide what the Nodus presentation's aggregated "other" share means; that behavior is tracked in `backlog/2026-10-02-other-share-semantics.md` because it currently depends on the old qualification rule and needs a consumer-owned meaning before the predicate can disappear from that path.

Coordinate numeric source values with `backlog/2026-10-02-config-tunables-centralization.md`: if a retained threshold/sample floor remains a real implementation tunable after semantic cleanup, its source value belongs in `src/config.ts`; if the old qualification concept disappears entirely, do not centralize dead policy merely to preserve it.

Fixture-only `qualifies` fields that model this obsolete Explorer-decoration protocol should disappear with the owning tests. Do not sweep unrelated historical audit text.

# Complete:

Generic Explorer move decoration no longer produces or exposes `qualifies`; active Rail/source consumers obtain the evidence they need without depending on that field; tests assert source evidence and consumer-owned classifications rather than the obsolete generic verdict; and no active non-backlog source/test dependency remains on Explorer-decoration `qualifies` except work deliberately fenced to the Line-view "other" outcome while that outcome is still open.

# Sync:

After any implementation or verification step that changes what remains, and before ending an implementation pass, synchronize this entry. Also synchronize when an action completes or becomes unavailable, a blocking condition changes, or a judgment is settled. Rewrite around the factual work and verification still open; do not accumulate progress history. If an outcome's completion condition is satisfied, run Backlog Close for that outcome. If Close cannot pass its normal gates, leave the entry open with the blocking condition explicit.
