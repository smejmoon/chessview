# PositionRepository

`PositionRepository` is Chessview's application-level owner of canonical position records.

## Identity

One repository record is keyed by `canonicalPosition`: piece placement, side to move, castling rights, and only en-passant state that can affect legal play. Halfmove and fullmove counters are not part of repository identity. A stored `fen` remains a playable six-field representation attached to that identity.

## Record lifetime

The repository keeps one in-memory record per canonical key when it has been read or written during the current page lifetime. On a cache miss it reads the persisted node from IndexedDB. Writes update IndexedDB and the in-memory record together.

Application code that reads or writes position nodes goes through `PositionRepository`; `db.js` remains the low-level IndexedDB adapter. Graph edges remain independently persisted through the graph database because edge identity and reconciliation are not position-record hydration.

## Facet hydration

Explorer, cloud evaluation, Masters, and future position-backed data are independently hydrated facets of a position record. There is no whole-node freshness flag: each endpoint client keeps its own TTL, request parameters, parsing, failure semantics, and persisted fields.

Equivalent concurrent loads for one facet and canonical key share one producer. Each caller participates with its own `AbortSignal`. One caller becoming obsolete detaches only that caller. When the last caller detaches before the producer settles, the repository aborts the producer so queued work can be rejected before it reaches Lichess.

The shared producer receives an internal abort signal owned by the repository rather than any caller's signal. This keeps producer lifetime independent of first-caller lifetime while preserving cancellation when nobody still needs the work.

## Boundaries

`NodusController` owns current-view obsolescence and publication. It supplies scoped cancellation but does not own shared request lifetime or expose revision identity to the repository.

Lichess-backed endpoint clients own endpoint meaning and call `PositionRepository` to coordinate shared per-position work and persistence. They continue to call `LichessGateway` for application-issued HTTP requests.

`LichessGateway` owns application-wide serialization, cooldown, and pre-send cancellation. It does not own canonical-position identity, endpoint caches, facet freshness, or shared parsed-result semantics.

## Verification

Deterministic tests should cover in-memory reuse before IndexedDB fallback, persisted updates remaining visible through the repository, independently cancellable callers sharing one facet load, last-caller cancellation aborting the shared producer, and replacement callers being able to start fresh work after a cancelled producer is detached.
