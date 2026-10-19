# Star-map layout probe (non-production)

Self-contained DOT fixtures for evaluating layout of a chess-shaped *projection* with mixed-size rendered nodes. Every node ID denotes one position; even tiny circles are not collapsed continuations. Edges stand for individual moves. These fixtures are synthetic graph topologies rather than an export of canonical FENs or real selection evidence. The `transposition.dot` path labels sketch the two move orders `1.d4 Nf6 2.Nf3 d5` and `1.Nf3 d5 2.d4 Nf6`, leading to the single node `merge`.

Run from this directory with a Graphviz installation:

```sh
for file in *.dot; do dot -Tsvg "$file" -o "${file%.dot}.svg"; done
```

A local Graphviz `dot` layout probe ran on these six cases (not in GitHub Actions or a ChessView checkout):

| Input | Nodes | Edges | Resulting bounds, inches |
| --- | ---: | ---: | --- |
| `forcing.dot` | 11 | 10 | 9.32 × 1.81 |
| `broad.dot` | 22 | 21 | 3.99 × 6.60 |
| `transposition.dot` | 11 | 11 | 7.85 × 2.47 |
| `roots-siblings.dot` | 7 | 6 | 4.72 × 3.43 |
| `recenter-before.dot` | 7 | 7 | 7.11 × 1.60 |
| `recenter-after.dot` | 11 | 11 | 8.58 × 2.01 |

The cases show that a layered layout *can* fit mixed board/star node sizes, preserve a single merge target, and place simple Roots upstream. They do **not** validate visual quality at production scale, realistic family placement, Chessground performance, or any JavaScript layout package.

### Continuity failure probe

`recenter-before.dot` and `recenter-after.dot` intentionally change which node has Nodus size, plus add downstream structure. If the layouts are overlaid by translating the new layout so that shared canonical node `E` stays fixed, the remaining shared nodes still shift: `N` ~99 pt, `F` ~61 pt, `A` ~15 pt, `B/C/D` ~18 pt. A fresh automatic layout is not a sufficient spatial-continuity contract; reuse coordinates or interpolate surviving nodes where needed.

### Technology candidates (documentation, not package execution)

- [ELK.js](https://github.com/kieler/elkjs): layered/directed layout with node dimensions, ports, ordering/interactive constraints. Computes geometry, not DOM. [Interactive layout guidance](https://eclipse.dev/elk/blog/posts/2023/23-01-09-constraining-the-model.html).
- [Dagre](https://github.com/dagrejs/dagre): client-side directed graph layout; the current [changelog](https://github.com/dagrejs/dagre/blob/master/changelog.md) describes `useDynamic` / `corePath` in its 2026 3.1.0 release. Must test current behavior rather than assume Dagre lacks layout stability features.
- [Graphviz WASM](https://hpcc-systems.github.io/hpcc-js-wasm/packages/graphviz/README.html): brings the Graphviz baseline to JavaScript/browser, but WASM load, output model and incremental continuity remain tradeoffs.
- [D3 Zoom](https://d3js.org/d3-zoom): pan/zoom and programmatic camera transforms, layout-independent and HTML/SVG-compatible.
- [Sigma.js](https://www.sigmajs.org/how-to/layers/sync-html-svg/): WebGL-oriented graph rendering and synchronized HTML overlays; promising for high counts but risks needing two rendering/interaction systems when chessboards remain DOM.
- [Cytoscape.js](https://js.cytoscape.org/): graph-oriented renderer and interactions, more invasive than retaining the existing SVG/DOM rendering boundary.

The initial scratch environment could not install ELK.js or Dagre, but the comparison has now run successfully on a GitHub-hosted Actions runner. The library runtime results are recorded below. The browser smoke test used a generic, CSS-drawn read-only mock, not Chessground; a pointer-transparent preview could hover a star without moving its graph-space geometry, and clicking still dispatched to that star.

### Next discriminating experiment

Run the same fixtures *in current ELK.js and current Dagre*; test mixed node sizes, Root/Line side constraints, family adjacency, convergence, layout stability across recentering, and runtime cost as node count increases. If neither justifies its footprint, test Graphviz WASM or retain/adapt Lens geometry. Only then test real Chessground overlays with D3 Zoom and decide whether a dedicated WebGL renderer adds value. Do not choose a production API based on these fixtures alone.

### Repeatable JavaScript comparison harness

[compare-layouts.mjs](compare-layouts.mjs) converts these checked-in DOT fixtures to 72 px/inch box/star geometry, runs local ELK.js layered and Dagre layouts, checks for duplicate/missing node IDs and broken endpoints, and reports bounding boxes, node overlaps, backward directed edges, per-fixture elapsed time, and shared-position displacement after recentering with node E anchored.

Run in a scratch directory with both dependencies available, not by adding them to the production app:

```sh
npm install --no-save elkjs @dagrejs/dagre
node compare-layouts.mjs
```

The initial isolated Node environment failed with `EAI_AGAIN` resolving registry.npmjs.org. That network failure was specific to the scratch runtime: installing the pinned packages and running the comparison succeeded on GitHub Actions. The workflow produced both JSON and a browser-viewable layout gallery.

### GitHub Actions comparison

The branch-only [Star map layout experiment](../../.github/workflows/star-map-layout.yml) workflow runs on pushes that change its experimental files. It installs **ELK.js 0.12.0** and **@dagrejs/dagre 3.1.1** into `experiments/star-map/node_modules` using `--no-save --package-lock=false`, without changing production dependencies or the application package lock. It runs the numeric comparison, then [renders an HTML inspection gallery](render-layouts.mjs). Both `comparison-results.json` and `gallery.html` are uploaded as the `star-map-layout-comparison` Actions artifact.

[GitHub Actions run 38313341891](https://github.com/smejmoon/chessview/actions/runs/38313341891) completed successfully and published the `star-map-layout-comparison` artifact. The browser gallery was also opened in a separate Chromium inspection environment. CI and Pages workflows also succeeded on that branch tip.

### Measured comparison: GitHub Actions run 38313341891

Node 24; ELK.js 0.12.0; @dagrejs/dagre 3.1.1; six synthetic fixtures; no application code or dependencies modified. All layouts retained the expected node/edge endpoints and showed **zero node-rectangle overlaps** and **zero backward-directed edges**.

| Fixture | ELK.js bounds (px) | Dagre bounds (px) | ELK time (ms) | Dagre time (ms) |
| --- | --- | --- | ---: | ---: |
| forcing | 511 × 116 | 591 × 130 | 146.82 | 13.35 |
| broad | 267 × 475 | 267 × 475 | 34.37 | 8.41 |
| transposition | 445 × 178 | 505 × 178 | 16.72 | 5.75 |
| roots-siblings | 280 × 247 | 310 × 247 | 11.91 | 3.18 |
| recenter-before | 412 × 115 | 462 × 115 | 13.78 | 2.51 |
| recenter-after | 478 × 145 | 548 × 145 | 15.14 | 3.44 |

ELK.js often saves horizontal extent, while Dagre returned sooner in this **single un-warmed run**. These are small fixtures and timings include one-time initialization; they do not justify a production performance claim or a library selection.

After anchoring shared position `E` in the recenter fixture, remaining shared nodes moved:

| Shared node | ELK.js shift | Dagre shift |
| --- | ---: | ---: |
| N | 100 | 99 |
| A | 19 | 15 |
| B | 34 | 18 |
| C | 34 | 18 |
| D | 18 | 18 |
| E (anchor) | 0 | 0 |
| F | 69 | 61 |

The layout [gallery](https://github.com/smejmoon/chessview/actions/runs/38313341891) visually confirms two branches converging on one target and Roots/siblings upstream of the Nodus. Gallery edges were rendered as straight lines for inspection and **do not** measure either engine's routed edges. The fixture nodes are synthetic position placeholders, not validated legal FEN positions. The unmodified static-layout test does not exercise Dagre's dynamic options or ELK's incremental constraints.

**Conclusion:** both engines satisfy basic mixed-size layout and canonical merge topology. Neither yields stable geography across a fresh recenter on its own. The next discriminating work is to test continuity-preserving options and graphs of more realistic size/shape, then real Chessground/DOM rendering with a separate camera. No production engine selected.

### Interactive 2.5D / 3D star-field lab (experimental)

[Spatial visual lab](visual/index.html) is a standalone browser comparison, built only into the `10-12-star-map` **branch Pages preview** at `star-map-lab/`. Both modes render **the same canonical chess graph**; the main difference is the camera:

- **2.5D:** fixed viewing direction, gentle parallax, pan/zoom and perspective depth. It stays easy to orient but cannot be rotated around.
- **3D:** true X/Y/Z coordinates with Three.js WebGL, OrbitControls rotation, pan and zoom. Camera-facing, read-only board planes preserve some legibility while rotating.

The graph is generated from legal opening move sequences with `chess.js` and merged by the four-field canonical FEN key. A queen-pawn / Réti transposition reaches one canonical position through two different legal move orders. Every navigable star is a position; edges correspond to legal moves. The selected Nodus has a larger chessboard; immediate and transpositional landmarks get smaller boards. Hovering a star opens a **read-only** board telescope; clicking recenters. It is not wired to Lichess, Constellation selection, Evidence, or Chessground, and the coordinates are illustrative, hand-derived family/depth placements—not a validated 3D layout algorithm or gameplay surface.

Source: [visual/app.js](visual/app.js), [visual/style.css](visual/style.css), [visual/index.html](visual/index.html).

The [Pages workflow](../../.github/workflows/pages.yml) temporarily installs pinned `three@0.180.0` and `esbuild@0.25.12` within the experiment folder **only on branch `10-12-star-map`**, bundles the JS into `dist/star-map-lab/`, and publishes it under that branch's isolated preview. Production dependencies and app source remain untouched. A successful bundle/deploy does not by itself prove WebGL/browser behavior; inspect the deployed page in a WebGL-capable browser. This demo provides the missing visual decision evidence, not a production renderer selection.


### Chromium visual verification

The branch-only [Star map visual browser check](../../.github/workflows/star-map-browser.yml) builds the visual experiment in isolation and opens it in headless Chromium with WebGL software rendering. Its checks require a nonempty legal position graph, at least one true canonical convergence, a working WebGL2 canvas, successful switches between 2.5D and 3D modes, and no browser exceptions; it captures a screenshot of each mode. These are runtime smoke tests, **not** user-experience validation, gameplay/Chessground integration, or assurance that browser GPU drivers will perform the same.

### Observed browser result

[GitHub Actions run 38314948683](https://github.com/smejmoon/chessview/actions/runs/38314948683) completed successfully with a headless Chromium/WebGL2 smoke test. The browser reported **65 positions, 65 edges, one canonical convergence**, canvas/WebGL2 present, successful 2.5D-to-3D-to-2.5D toggling, and no JavaScript console or page errors. It exported `2-point-5d.png` and `3d.png` in its `star-map-browser-smoke` artifact. The artifact screenshots were inspected: boards and glowing connected positions render, but the two default camera views are visually rather similar. An actual orbit interaction is needed to judge whether the extra 3D dimension contributes to understanding. Board images are simplistic painted textures and some projections get dense; these limitations are not production acceptance criteria. The test did not exercise hit-testing by clicking a node, camera transitions, a real Chessground board, or a live Constellation.

### Accepted-Constellation branch preview

The application URL `?star-map=1` enables a **branch-only** live viewer after Current View has accepted a Constellation. [The bridge](../../src/star-map-preview.ts) sends a read-only projection of current canonical nodes, selected Graph Edge relationships and family/Root/Line roles to a same-origin iframe. [The live renderer](visual/live.js) computes only presentation coordinates, shares its Three.js scene across 2.5D and 3D camera modes, and sends star clicks back to the existing Current View Recenter action. It does not fetch sources, own graph selection, or replace production Lens. The isolated manual-move fixture viewer in `visual/app.js` remains separate.

The first real-view design comparison uses small curved family trails with depth variation, radial-alpha star halos, a prominent Nodus board, a bounded number of nearby/merge boards, and content-aware initial framing. These are disposable geometry choices, not a selected spatial layout algorithm or claim of continuity across recentering. The Nodus board in this visual viewer is still read-only.

The [Chromium live-renderer check](https://github.com/smejmoon/chessview/actions/runs/39223477769) publishes screenshots from accepted-shaped **legal opening** projections and verifies node/edge identity, transposition merge, both camera modes, Root-left/Line-right presentation, initial viewport fit and a canvas click producing a Recenter request. It exercises the renderer's message contract without Lichess authorization or the actual application publishing a newly settled Constellation. Those end-to-end checks and repeated user visual assessment remain open in [the real-graph preview milestone](../../backlog/2026-10-16-constellation-real-graph-preview.md).
