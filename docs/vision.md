# Chessview vision

## Promise

Chessview turns opening knowledge into a spatial map centered on one canonical chess position. It helps a player see where that position came from, where play can go, and how meaningful alternatives and transpositions relate — without reducing the experience to a move-list dashboard.

## Product language

- **Nodus** — the position currently organizing the map.
- **Root** — upstream context showing how play can reach the Nodus.
- **Line** — downstream continuation showing where play can go from the Nodus.
- **Rail** — supporting controls and evidence beside the map.

**Roots → Nodus → Lines**

These are product terms. `docs/product.md` and the component documents own their exact behavioral contracts; implementation code may use clearer technical graph or rendering terms.

## User needs

A player should be able to:

- orient quickly around a position without reconstructing a move tree mentally;
- understand meaningful ways the Nodus can be reached, including transpositions;
- explore alternatives without losing context as another position becomes the Nodus;
- see the shape of an opening, with broad positions looking broad and forcing Lines allowed useful depth;
- recognize different move orders that reach the same canonical position as the same place;
- use human and engine evidence to understand the map without making that evidence the navigation model;
- revisit or share a position directly, independent of the route used to reach it.

## Representative workflows

### Orient and explore

A user arrives at a Nodus, sees the important nearby Lines and their shape, chooses one, and recenters there. The map reorganizes around the new Nodus while preserving enough context to understand where they moved from and what alternatives remain nearby.

### Trace Roots and transpositions

A user looks upstream from a familiar Nodus. Roots reveal meaningful move orders, and routes that reach the same canonical position converge instead of producing duplicate places in the map.

### Investigate with evidence

A user notices an alternative Line and compares its human and engine evidence in place, without leaving the spatial map for a textual move tree.

## Experience principles

**Position-centered.** The Nodus is the reference point; the position matters more than the path used to arrive there.

**Spatial.** Relationships between boards carry the structure. Text and evidence clarify the map rather than replace it.

**Shape before detail.** Show meaningful alternatives before spending excessive space on one continuation. Broad positions retain breadth; narrow Lines can deepen.

**One connected map.** Recentring should feel like moving through the same chess space, and transpositions should feel like convergence on the same place.

**Evidence supports understanding.** Statistics and engine evidence enrich the graph but do not determine whether the graph itself is understandable.

**Implementation stays invisible.** What appears should follow chess meaning and explicit product rules, not array order, request timing, or traversal accidents.

## Direction

A change moves Chessview forward when it makes the structure around a Nodus easier to understand while preserving orientation and keeping the spatial map more important than its supporting machinery. Added information should earn the visual and cognitive space it consumes.

## Documentation boundary

This document owns durable product direction and language. `docs/product.md` owns cross-product conditions that must remain true; component and architecture documents own exact behavior and technical boundaries; `backlog/` owns unfinished work.
