# Do:

Make Constellation admission of structural obligations survive intact through Nodus demand and current-view execution.

Replace generic run-owned task counting as the source of `settling`. Only work explicitly admitted by the active Constellation as still capable of changing its constrained shape may participate in structural settlement. Supplementary Explorer warming, cloud evaluation, Masters retrieval, Root enrichment, Rail enrichment, Evidence enrichment, and inactive-sibling work must not make Weather Updating merely because they are pending.

Keep provider/source execution generic. The current-view boundary may deduplicate and schedule work, but it must not infer structural criticality from provider type, task key, run ownership, or source name.

# Because:

`docs/components/constellation.md` and `docs/architecture/current-view.md` now make Constellation the owner of structural admission. The current controller still collapses every `RefinementTask` into one `refinementPending` count and sets `settling = refinementPending > 0`. `RefinementTask` carries only `{ key, run }`, so structural provenance is lost before execution.

That makes supplementary work indistinguishable from work that can still change the active Constellation and leaves Weather coupled to generic asynchronous activity instead of domain settlement.

# Edges:

`src/nodus-refinement.ts` may continue combining current-Nodus demand, but Constellation Reading-frontier demand must retain explicit structural provenance. Other demand remains supplementary unless a Constellation contract admits it structurally.

The active sibling Constellation alone determines current structural settlement. Inactive Root/Line work may continue and may receive background priority without keeping the active view unsettled.

Evidence remains an independently addressable passive semantic read boundary. This outcome must not recreate a dependency from Evidence onto Constellation or treat missing cloud evaluation as structural by default.

Execution and criticality are separate concerns. A single underlying producer may serve both structural and supplementary participants without acquiring one global criticality flag.

The separate `2026-10-04-settlement-incorporation-barrier.md` outcome owns the rule that completed structural work remains unsettled until incorporated. This entry only establishes which work is structural in the first place.

# Unsettled:

Choose the smallest execution contract that preserves Constellation structural provenance without turning provider-specific tasks into domain objects. A generic structural-obligation wrapper with domain payloads is acceptable; source-specific controller branching is not.

Decide whether structural and supplementary participation should share one keyed execution record or separate participant records over one reusable producer. Preserve deduplication without collapsing their meanings.

# Complete:

Deterministic tests prove that:

- a Constellation Reading-frontier obligation makes the active Constellation Settling;
- supplementary cloud-eval, Masters, Root-enrichment, Evidence, Rail, lookahead, and inactive-sibling work do not by themselves make it Settling;
- provider/task identity cannot manufacture structural criticality;
- switching the active Root/Line sibling changes which admitted obligations control settlement without starting a replacement Nodus run;
- execution deduplication can share work without losing structural provenance.

No current-view settlement decision is derived from a generic count of all run-owned work.

# Sync:

After any implementation or verification step that changes what remains, and before ending an implementation pass, synchronize this entry. Also synchronize when an action completes or becomes unavailable, a blocking condition changes, or a judgment is settled. Rewrite around the factual work and verification still open; do not accumulate progress history. If the completion condition is satisfied, run Backlog Close. If Close cannot pass its normal gates, leave the entry open with the blocking condition explicit.
