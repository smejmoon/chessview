import '@lichess-org/chessground/assets/chessground.base.css';
import '@lichess-org/chessground/assets/chessground.brown.css';
import '@lichess-org/chessground/assets/chessground.cburnett.css';
import './style.css';
import './lichess-eval-presentation.css';
import './debug.css';

import { canonicalPosition } from './graph.js';
import { nominateConstellationLookahead } from './constellation-lookahead.ts';
import { debugLog } from './debug.js';
import {
  currentExplorerReading,
  loadExplorerReading,
} from './explorer.js';
import {
  reconcileExplorerReading,
  warmExplorerReading,
} from './knowledge-acquisition.ts';
import { loadMasters } from './masters.js';
import { materializeMove } from './move-materialization.ts';
import { NodusController } from './nodus-controller.ts';
import type { RefinementTask } from './nodus-controller.ts';
import { composeNodusStructure } from './nodus-structure.js';
import { loadNodusEvidence } from './evidence-source.js';
import { lichessEval } from './lichess-eval.js';
import { createLichessEvalStatusPresenter } from './lichess-eval-presentation.js';
import { createNodusRenderer } from './nodus-renderer.js';
import { createNodusPresenter } from './nodus-presenter.js';
import { composeNodusRail } from './rail-source.js';
import { rootTranspositionEnricher } from './root-enrichment.js';
import { createRouteLedger } from './route-ledger.ts';
import type { ViewMode } from './route-ledger.ts';
import { preferenceStore } from './preference-store.js';

const COMPACT_VIEW_MAX_WIDTH_PX = 620;
const CONSTRAINED_VIEW_MAX_WIDTH_PX = 900;
const CONSTRAINED_VIEW_MAX_AREA_PX2 = 650_000;
const ROOMY_VIEW_MAX_WIDTH_PX = 1250;
const ROOMY_VIEW_MAX_AREA_PX2 = 1_000_000;

const COMPACT_BOARD_BUDGET = 5;
const CONSTRAINED_BOARD_BUDGET = 8;
const ROOMY_BOARD_BUDGET = 12;
const MAX_BOARD_BUDGET = 16;
const RESIZE_REDRAW_DEBOUNCE_MS = 120;

function boardBudget() {
  const area = window.innerWidth * window.innerHeight;
  if (window.innerWidth < COMPACT_VIEW_MAX_WIDTH_PX) return COMPACT_BOARD_BUDGET;
  if (window.innerWidth < CONSTRAINED_VIEW_MAX_WIDTH_PX || area < CONSTRAINED_VIEW_MAX_AREA_PX2) {
    return CONSTRAINED_BOARD_BUDGET;
  }
  if (window.innerWidth < ROOMY_VIEW_MAX_WIDTH_PX || area < ROOMY_VIEW_MAX_AREA_PX2) {
    return ROOMY_BOARD_BUDGET;
  }
  return MAX_BOARD_BUDGET;
}

const routeLedger = createRouteLedger({ preferences: preferenceStore });
const initialRoute = routeLedger.read();
const renderer = createNodusRenderer({
  app: document.querySelector('#app'),
  preferences: preferenceStore,
});
const lichessEvalStatusPresenter = createLichessEvalStatusPresenter({
  render: (status) => renderer.renderLichessEvalStatus(status),
  log: (message, detail) => { debugLog(message, detail, 'error'); },
});
const stopLichessEvalStatus = lichessEval.subscribe(lichessEvalStatusPresenter.update);
const presenter = createNodusPresenter({
  renderer,
  log: (message, detail) => { debugLog(message, detail, 'error'); },
});

let controller: NodusController;

function projectionPriority(mode: ViewMode) {
  return () => controller.snapshot.mode === mode ? 'foreground' : 'background';
}

function explorerSignature(reading: any): string {
  const moves = Array.isArray(reading?.moves)
    ? reading.moves.map((move: any) => `${move?.uci}:${move?.white}:${move?.draws}:${move?.black}`).join(',')
    : '';
  return `${reading?.white}:${reading?.draws}:${reading?.black}:${moves}`;
}

function refinementPriority(modes: ReadonlySet<ViewMode>, alwaysForeground = false) {
  if (alwaysForeground) return 'foreground' as const;
  return () => modes.has(controller.snapshot.mode) ? 'foreground' : 'background';
}

async function refineCurrentNodus({ center, structures, signal }): Promise<readonly RefinementTask[]> {
  const tasks = new Map<string, RefinementTask>();
  const explorerDemand = new Map<string, Set<ViewMode>>();
  const evalDemand = new Map<string, Set<ViewMode>>();
  const mastersDemand = new Map<string, Set<ViewMode>>();
  const foregroundExplorer = new Set<string>([center]);
  const foregroundEval = new Set<string>([center]);
  const foregroundMasters = new Set<string>([center]);

  function demand(map: Map<string, Set<ViewMode>>, position: string, mode: ViewMode) {
    if (!position) return;
    if (!map.has(position)) map.set(position, new Set());
    map.get(position)?.add(mode);
  }

  function add(key: string, run: () => unknown | Promise<unknown>) {
    if (!tasks.has(key)) tasks.set(key, Object.freeze({ key, run }));
  }

  add(`root-transpositions:${center}`, () => rootTranspositionEnricher.ensure(center, { signal }));

  for (const mode of ['roots', 'lines'] as const) {
    const structure: any = structures[mode];
    for (const position of structure?.readingFrontier ?? []) demand(explorerDemand, position, mode);
    for (const relationship of structure?.composition?.relationships ?? []) {
      const edge = relationship?.edge;
      if (!edge?.source || !edge?.target) continue;
      demand(evalDemand, edge.source, mode);
      demand(evalDemand, edge.target, mode);
      demand(mastersDemand, edge.source, mode);
    }
  }

  if (!explorerDemand.has(center)) explorerDemand.set(center, new Set());
  if (!evalDemand.has(center)) evalDemand.set(center, new Set());
  if (!mastersDemand.has(center)) mastersDemand.set(center, new Set());

  for (const [position, modes] of explorerDemand) {
    add(`explorer:${position}`, () => loadExplorerReading(position, {
      signal,
      priority: refinementPriority(modes, foregroundExplorer.has(position)),
    }));
    const current = currentExplorerReading(position);
    if (current) {
      add(
        `explorer-reconcile:${position}:${explorerSignature(current)}`,
        () => reconcileExplorerReading(position, current),
      );
    }
  }

  for (const [position, modes] of evalDemand) {
    add(`cloud-eval:${position}`, () => lichessEval.get(position, {
      signal,
      priority: refinementPriority(modes, foregroundEval.has(position)),
    }));
  }

  for (const [position, modes] of mastersDemand) {
    add(`masters:${position}`, () => loadMasters(position, {
      signal,
      priority: refinementPriority(modes, foregroundMasters.has(position)),
    }));
  }

  return Object.freeze([...tasks.values()]);
}

async function warmLookahead({ center, structure, signal }) {
  const nominations = nominateConstellationLookahead({ center, structure });
  await Promise.all(nominations.map((position) => warmExplorerReading(position, { signal })));
}

controller = new NodusController({
  initial: { ...initialRoute, orientation: preferenceStore.getOrientation() },
  canonicalize: canonicalPosition,
  routeLedger,
  preferences: preferenceStore,
  structure: ({ center, mode, signal }) => composeNodusStructure({
    center,
    mode,
    max: boardBudget(),
    signal,
  }),
  evidence: ({ center, mode, structure, signal }) => loadNodusEvidence({
    center,
    mode,
    structure,
    signal,
  }),
  rail: composeNodusRail,
  refine: refineCurrentNodus,
  lookahead: warmLookahead,
  materializeMove,
  presenter,
  log: (message, detail) => { debugLog(message, detail); },
});

debugLog('app start', controller.snapshot);

let resizeTimer;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => { void controller.redraw(); }, RESIZE_REDRAW_DEBOUNCE_MS);
});
window.addEventListener('beforeunload', () => {
  stopLichessEvalStatus();
  controller.dispose();
  presenter.dispose();
}, { once: true });

await controller.start();
