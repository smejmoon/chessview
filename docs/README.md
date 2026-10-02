# Chessview documentation

Chessview keeps durable product direction separate from unfinished work.

- [Glossary](glossary.md) — canonical definitions for Chessview terms used across product, component, and architecture documents.
- [Vision](vision.md) — why Chessview exists, the user needs it serves, and how the canonical product language fits together: **Roots → Nodus → Lines**, composed into a **Constellation**, with the **Rail** alongside and **Weather** communicating structural readiness.
- [Product contract](product.md) — what must remain true across the product, including usability, Weather, and cross-component commitments.
- [Components](components/) — exact behavior, tunables, edge cases, and verification owned by each product component.
- [Architecture](architecture/) — independently maintained technical boundaries and engineering guidance, including [ownership of quantitative values and constants](architecture/quantitative-values.md).
- [`backlog/`](../backlog/) — outcomes and changes that are still intended but not yet complete.

The glossary defines language; it does not become a second specification. Durable product, component, and architecture documents own intent, behavior, constraints, ownership, and verification, and should link to glossary terms rather than restating competing definitions.

For product work, start with the glossary, vision, and product contract, then load the component or architecture documents that own the affected behavior. Plans for future work belong in `backlog/`, not in durable product documentation.
