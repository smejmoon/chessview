import '@lichess-org/chessground/assets/chessground.base.css';
import '@lichess-org/chessground/assets/chessground.brown.css';
import '@lichess-org/chessground/assets/chessground.cburnett.css';
import './style.css';
import './lichess-eval-presentation.css';
import './debug.css';

import { canonicalPosition } from './graph.ts';
import { nominateConstellationLookahead } from './constellation-lookahead.ts';
import { CurrentViewController } from './current-view-controller.ts';
import type { RefinementTask } from './current-view-controller.ts';
import { debugLog } from './debug.ts';
import { clearExplorerCache } from './explorer-cache.ts';
import { refineExplorerReading, warmExplorerReading } from './knowledge-acquisition.ts';
import { discoverRootPredecessors } from './root-bootstrap.ts';
import { createLens } from './lens.ts';
import { loadMasters } from './masters.ts';
import { lichessSession } from './lichess-session.ts';
import { materializeMove } from './move-materialization.ts';
import { deriveCurrentViewRefinementDemand } from './current-view-refinement.ts';
import { composeNodusStructure } from './nodus-structure.ts';
import { lichessEval } from './lichess-eval.ts';
import { createLichessEvalStatusPresenter } from './lichess-eval-presentation.ts';
import { createNodusRenderer } from './nodus-renderer.ts';
import { createNodusPresenter } from './nodus-presenter.ts';
import { composeNodusRail } from './rail-source.ts';
import { rootTranspositionEnricher } from './root-enrichment.ts';
import { createRouteLedger } from './route-ledger.ts';
import { preferenceStore } from './preference-store.ts';
import { decorateWeatherDiagnostics } from './weather-diagnostics.ts';

const RESIZE_UPDATE_DEBOUNCE_MS = 120;
const app = document.querySelector('#app');
if (!app) throw new Error('ChessView requires an app element');

function showAuthorizationFailure(error: unknown): void {
  const panel = document.createElement('section');
  panel.className = 'auth-gate';
  const heading = document.createElement('h1');
  heading.textContent = 'Lichess sign-in required';
  const message = document.createElement('p');
  message.textContent = error instanceof Error ? error.message : 'Could not authorize with Lichess.';
  const retry = document.createElement('button');
  retry.type = 'button';
  retry.textContent = 'Try again';
  retry.addEventListener('click', () => {
    app.textContent = 'Redirecting to Lichess…';
    void lichessSession.establishAuthorization()
      .then((token) => { if (token) window.location.reload(); })
      .catch(showAuthorizationFailure);
  });
  panel.append(heading, message, retry);
  app.replaceChildren(panel);
}

let authorized = false;
try {
  authorized = Boolean(await lichessSession.establishAuthorization());
  if (!authorized) app.textContent = 'Redirecting to Lichess…';
} catch (error) {
  showAuthorizationFailure(error);
}

// No view or source work is started until authentication is established.
if (authorized) {
const routeLedger = createRouteLedger({ preferences: preferenceStore });
const initialRoute = routeLedger.read();
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

function tasksForCurrentView({ center, mode, structure }): readonly RefinementTask[] {
  const demand = deriveCurrentViewRefinementDemand({ center, mode, structure });
  const tasks: RefinementTask[] = [];

  const rootTransposition = demand.rootTransposition;
  if (mode === 'roots') {
    tasks.push({
      key: `root-discovery:${center}`,
      purpose: 'root-discovery',
      modes: ['roots'],
      run: ({ signal, priority }) => discoverRootPredecessors(center, { signal, priority }),
    });
  }
  if (rootTransposition) {
    tasks.push({
      key: `root-transpositions:${rootTransposition}`,
      nodusWide: true,
      run: ({ signal }) => rootTranspositionEnricher.ensure(rootTransposition, { signal }),
    });
  }

  for (const target of demand.explorer) {
    tasks.push({
      key: `explorer:${target.position}`,
      modes: target.modes,
      nodusWide: target.nodusWide,
      structuralReading: target.structuralModes.includes(mode) ? target.position : null,
      run: ({ signal, priority }) => refineExplorerReading(target.position, { signal, priority }),
    });
  }

  for (const target of demand.cloudEval) {
    tasks.push({
      key: `cloud-eval:${target.position}`,
      modes: target.modes,
      nodusWide: target.nodusWide,
      run: ({ signal, priority }) => lichessEval.get(target.position, { signal, priority }),
    });
  }

  for (const target of demand.masters) {
    tasks.push({
      key: `masters:${target.position}`,
      modes: target.modes,
      nodusWide: target.nodusWide,
      run: ({ signal, priority }) => loadMasters(target.position, { signal, priority }),
    });
  }

  return tasks;
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
}
