import '@lichess-org/chessground/assets/chessground.base.css';
import '@lichess-org/chessground/assets/chessground.brown.css';
import '@lichess-org/chessground/assets/chessground.cburnett.css';
import './style.css';
import './lichess-eval-presentation.css';
import './debug.css';

import { canonicalPosition } from './graph.js';
import { nominateConstellationLookahead } from './constellation-lookahead.ts';
import { CurrentViewController } from './current-view-controller.ts';
import type { RefinementOutcome, RefinementTask } from './current-view-controller.ts';
import { debugLog } from './debug.js';
import { clearExplorerCache } from './explorer-cache.ts';
import { refineExplorerReading, warmExplorerReading } from './knowledge-acquisition.ts';
import { currentExplorerReading, refreshExplorerReading } from './explorer.js';
import { discoverSampledPredecessors, sampleGameIds } from './sampled-predecessors.ts';
import { createLens } from './lens.ts';
import { loadMasters } from './masters.js';
import { materializeMove } from './move-materialization.ts';
import { deriveCurrentViewRefinementDemand } from './current-view-refinement.ts';
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
import { decorateWeatherDiagnostics } from './weather-diagnostics.js';

const RESIZE_UPDATE_DEBOUNCE_MS = 120;
const routeLedger = createRouteLedger({ preferences: preferenceStore });
const initialRoute = routeLedger.read();
const app = document.querySelector('#app');
const lens = createLens({ app, preferences: preferenceStore });
let controller: CurrentViewController;

async function clearExplorerAndReload(positions?: readonly string[]): Promise<void> {
  debugLog(positions ? 'Refetching current view' : 'Clearing Explorer cache', {
    positions: positions?.length ?? 'all',
  });
  controller.dispose();
  await clearExplorerCache(positions);
  window.location.reload();
}

const renderer = createNodusRenderer({
  app,
  lens,
  maintenance: {
    refetchView: (positions) => clearExplorerAndReload(positions),
    clearExplorerCache: () => clearExplorerAndReload(),
  },
});
const lichessEvalStatusPresenter = createLichessEvalStatusPresenter({
  render: (status) => renderer.renderLichessEvalStatus(status),
  log: (message, detail) => { debugLog(message, detail, 'error'); },
});
const stopLichessEvalStatus = lichessEval.subscribe(lichessEvalStatusPresenter.update);
const presenter = createNodusPresenter({
  renderer,
  decorateWeather: (view) => { decorateWeatherDiagnostics(app, view, { debug: lens.debugEnabled() }); },
  log: (message, detail) => { debugLog(message, detail, 'error'); },
});

const constraintsByMode = new Map<string, Readonly<{ lineCapacity: number; rootCapacity: number }>>();

function constraintsFor(mode: 'roots' | 'lines') {
  const constraints = lens.constraints(mode);
  constraintsByMode.set(mode, constraints);
  return constraints;
}

async function discoverRootPredecessors(center, { signal, priority }): Promise<RefinementOutcome> {
  let reading = currentExplorerReading(center);
  let ids = sampleGameIds(reading);
  if (!ids.length) {
    debugLog('Root discovery refreshing Explorer samples', { center });
    reading = await refreshExplorerReading(center, { signal, priority });
    ids = sampleGameIds(reading);
  }
  if (!ids.length) return Object.freeze({ refinement: 'unavailable' as const });

  debugLog('Root discovery replaying sampled games', { center, games: ids.length });
  const nominations = await discoverSampledPredecessors(center, ids, { signal, priority });
  let satisfied = nominations.length === 0;
  let unavailable = false;
  for (const nomination of nominations) {
    if (signal.aborted) return Object.freeze({ refinement: 'unavailable' as const });
    const outcome = await refineExplorerReading(nomination.source, { signal, priority });
    if (outcome.refinement === 'retryable') return outcome;
    if (outcome.refinement === 'satisfied') satisfied = true;
    if (outcome.refinement === 'unavailable') unavailable = true;
  }
  if (satisfied) return Object.freeze({ refinement: 'satisfied' as const });
  if (unavailable) return Object.freeze({ refinement: 'unavailable' as const });
  return Object.freeze({ refinement: 'satisfied' as const });
}

function tasksForCurrentView({ center, mode, structure }): readonly RefinementTask[] {
  const demand = deriveCurrentViewRefinementDemand({ center, mode, structure });
  const tasks = new Map<string, RefinementTask>();

  function add(task: RefinementTask) {
    if (!tasks.has(task.key)) tasks.set(task.key, Object.freeze(task));
  }

  const rootTransposition = demand.rootTransposition;
  if (mode === 'roots' && !rootTransposition) {
    add({
      key: `root-discovery:${center}`,
      purpose: 'root-discovery',
      modes: ['roots'],
      nodusWide: false,
      run: ({ signal, priority }) => discoverRootPredecessors(center, { signal, priority }),
    });
  }
  if (rootTransposition) {
    add({
      key: `root-transpositions:${rootTransposition}`,
      nodusWide: true,
      run: ({ signal }) => rootTranspositionEnricher.ensure(rootTransposition, { signal }),
    });
  }

  for (const target of demand.explorer) {
    add({
      key: `explorer:${target.position}`,
      modes: target.modes,
      nodusWide: target.nodusWide,
      structuralReading: target.structuralModes.includes(mode) ? target.position : null,
      run: ({ signal, priority }) => refineExplorerReading(target.position, { signal, priority }),
    });
  }

  for (const target of demand.cloudEval) {
    add({
      key: `cloud-eval:${target.position}`,
      modes: target.modes,
      nodusWide: target.nodusWide,
      run: ({ signal, priority }) => lichessEval.get(target.position, { signal, priority }),
    });
  }

  for (const target of demand.masters) {
    add({
      key: `masters:${target.position}`,
      modes: target.modes,
      nodusWide: target.nodusWide,
      run: ({ signal, priority }) => loadMasters(target.position, { signal, priority }),
    });
  }

  return Object.freeze([...tasks.values()]);
}

async function warmLookahead({ center, structure, signal }) {
  const nominations = nominateConstellationLookahead({ center, structure });
  await Promise.all(nominations.map((position) => warmExplorerReading(position, { signal })));
}

controller = new CurrentViewController({
  initial: initialRoute,
  canonicalize: canonicalPosition,
  routeLedger,
  preferences: {
    setView: (view) => { preferenceStore.setView(view); },
  },
  lens,
  structure: ({ center, mode, signal }) => {
    const constraints = constraintsFor(mode);
    return composeNodusStructure({
      center,
      mode,
      lineMax: constraints.lineCapacity,
      rootMax: constraints.rootCapacity,
      signal,
    });
  },
  evidence: ({ center, mode, structure, signal }) => projectVisibleEvidence({ center, mode, structure, signal }),
  rail: composeNodusRail,
  refine: tasksForCurrentView,
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
    const mode = controller.snapshot.mode;
    const previous = constraintsByMode.get(mode);
    const next = lens.constraints(mode);
    if (previous && previous.lineCapacity === next.lineCapacity && previous.rootCapacity === next.rootCapacity) {
      void controller.redraw();
      return;
    }
    constraintsByMode.set(mode, next);
    void controller.recompose();
  }, RESIZE_UPDATE_DEBOUNCE_MS);
});
window.addEventListener('beforeunload', () => {
  stopLichessEvalStatus();
  controller.dispose();
  presenter.dispose();
}, { once: true });

await controller.start();
