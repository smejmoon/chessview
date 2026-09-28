# Do:

Make structural readiness/lifecycle behavior satisfy `docs/components/weather.md` §Requirements and the current-view acceptance rules in `docs/architecture/current-view.md` §Publication boundary: preserve generation-scoped settlement, degraded failure, and the delayed `Updating…` → brief `Ready` → settled-check acknowledgement while keeping supplementary evidence from controlling global Weather unless it is an unresolved Constellation-selection dependency. The outcome does not require a separate Weather module if the existing implementation can provide one testable owner of these semantics without duplicated truth.

# Because:

`docs/components/weather.md` §Purpose / §Requirements now owns current-view structural lifecycle/readiness semantics. `docs/architecture/current-view.md` §Publication boundary owns which asynchronous results may become current. `docs/components/evidence.md` §Product criticality distinguishes evidence that is structural for selection from evidence that is only supplementary.

# Edges:

`docs/components/constellation.md` §Requirements determines the visible structural result; Weather reports whether current-view critical structural work can still change that result. `docs/components/evidence.md` §Product criticality keeps annotation-only evidence supplementary, while evidence explicitly required to decide current Constellation membership/order is structural for that decision. `docs/product.md` §Weather owns the cross-product meaning of the global states.

# Unsettled:

Choose the smallest Weather state/value interface that can be published with the current view without exposing controller revision tokens or duplicating lifecycle truth. A new code module is optional unless it is the simplest way to satisfy the durable ownership boundary.

Decide how a pending Constellation-selection evidence request becomes part of Weather's critical dependency set, and how that dependency reaches a terminal result when evidence is unavailable, without treating transport failure, missing data, or insufficient evidence as negative chess evidence.

Keep or adjust the existing presentation delay/acknowledgement constants only after verifying the current UX; `docs/components/weather.md` §Requirements owns the subtle delayed/loading/acknowledgement behavior, not undocumented magic numbers.

# Complete:

Deterministic/browser tests exercise `docs/components/weather.md` §Verification through one testable Weather semantics owner: loading, successful settlement, legitimate empty structure, critical failure, obsolete-generation completion, supplementary late evidence, and any structural selection-evidence dependency all obey the current-view acceptance rules in `docs/architecture/current-view.md` §Publication boundary without duplicated lifecycle truth.

# Sync:

After any implementation or verification step that changes what remains, and before ending an implementation pass, rewrite this entry around the factual work and verification still open; do not accumulate progress history. If an outcome's completion condition is satisfied, run Backlog Close for that outcome. If Close cannot pass its normal gates, leave the entry open with the blocking condition explicit.
