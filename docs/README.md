# Chessview documentation

Chessview keeps durable product direction separate from unfinished work.

- [Vision](vision.md) — why Chessview exists, the user needs it serves, and the canonical product language: **Roots → Nodus → Lines**, with the **Rail** alongside the map.
- [Product contract](product.md) — what must remain true across the product, including usability, readiness, and cross-component commitments.
- [Components](components/) — exact behavior, tunables, edge cases, and verification owned by each product component.
- [Architecture](architecture/) — independently maintained technical boundaries.
- [`backlog/`](../backlog/) — outcomes and changes that are still intended but not yet complete.

For product work, start with the vision and product contract, then load the component or architecture documents that own the affected behavior. Plans for future work belong in `backlog/`, not in durable product documentation.
