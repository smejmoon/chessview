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
  acquireExplorerReading,
  warmExplorerReading,
} from './knowledge-acquisition.ts';
import { loadMasters } from './masters.js';
import { materializeMove } from './move-materialization.ts';
import { NodusController } from './nodus-controller.ts';
import type { RefinementTask } from './nodus-controller.ts';
import {
  deriveNodusRefinementDemand,
  nodusRefinementPriority,
} from './nodus-refinement.ts';
import type { NodusRefinementTarget } from './nodus-refinement.ts';
import { composeNodusStructure } from './nodus-structure.js';
import { projectVisibleEvidence } from './evidence-presentation.js';
import { lichessEval } from './lichess-eval.js';
import { createLichessEvalStatusPresenter } from './lichess-eval-presentation.js';
import { createNodusRenderer } from './nodus-renderer.js';
import { createNodusPresenter } from './nodus-presenter.js';
import { composeNodusRail } from './rail-source.js';
import { rootTranspositionEnricher } from './root-enrichment.js';
import { createRouteLedger } from './route-ledger.ts';
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
const RESIZE_UPDATE_DEBOUNCE_MS = 120;

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
let compositionBoardBudget = boardBudget();

function refinementPriority(demand: NodusRefinementTarget) {
  if (demand.nodusWide) return 'foreground' as const;
  return () => nodusRefinementPriority(demand, controller.snapshot.mode);
}

async function tasksForCurrentNodus({ center, structures, signal }): Promise<readonly RefinementTask[]> {
  const demand = deriveNodusRefinementDemand({ center, structures });
  const tasks = new Map<string, RefinementTask>();

  function add(key: string, run: () => unknown | Promise<unknown>) {
    if (!tasks.has(key)) tasks.set(key, Object.freeze({ key, run }));
  }

  add(
    `root-transpositions:${demand.rootTransposition}`,
    () => rootTranspositionEnricher.ensure(demand.rootTransposition, { signal }),
  );

  for (const target of demand.explorer) {
    add(`explorer:${target.position}`, () => acquireExplorerReading(target.position, {
      signal,
      priority: refinementPriority(target),
    }));
  }

  for (const target of demand.cloudEval) {
    add(`cloud-eval:${target.position}`, () => lichessEval.get(target.position, {
      signal,
      priority: refinementPriority(target),
    }));
  }

  for (const target of demand.masters) {
    add(`masters:${target.position}`, () => loadMasters(target.position, {
      signal,
      priority: refinementPriority(target),
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
    max: compositionBoardBudget,
    signal,
  }),
  evidence: ({ center, mode, structure, signal }) => projectVisibleEvidence({
    center,
    mode,
    structure,
    signal,
  }),
  rail: composeNodusRail,
  refine: tasksForCurrentNodus,
  lookahead: warmLookahead,
  materializeMove,
  presenter,
  log: (message, detail) => { debugLog(message, detail); },
});

debugLog('app start', controller.snapshot);

let resizeTimer;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    const nextBoardBudget = boardBudget();
    if (nextBoardBudget === compositionBoardBudget) {
      void controller.redraw();
      return;
    }
    compositionBoardBudget = nextBoardBudget;
    void controller.recompose();
  }, RESIZE_UPDATE_DEBOUNCE_MS);
});
window.addEventListener('beforeunload', () => {
  stopLichessEvalStatus();
  controller.dispose();
  presenter.dispose();
}, { once: true });

await controller.start();