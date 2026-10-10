import '@lichess-org/chessground/assets/chessground.base.css';
import '@lichess-org/chessground/assets/chessground.brown.css';
import '@lichess-org/chessground/assets/chessground.cburnett.css';
import './style.css';
import './lichess-eval-presentation.css';
import './debug.css';

import { canonicalPosition } from './graph.ts';
import { nominateConstellationLookahead } from './constellation-lookahead.ts';
import { CurrentViewController } from './current-view-controller.ts';
import type { RefinementOutcome, RefinementTask } from './current-view-controller.ts';
import { debugLog } from './debug.ts';
import { lichessSession } from './lichess-session.ts';
import { clearExplorerCache } from './explorer-cache.ts';
import { refineExplorerReading, warmExplorerReading } from './knowledge-acquisition.ts';
import { loadExplorerReading } from './explorer.ts';
import {
  discoverSampledPredecessors,
  sampleGameIds,
} from './sampled-predecessors.ts';
import { createLens } from './lens.ts';
import { loadMasters } from './masters.ts';
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
const routeLedger = createRouteLedger({ preferences: preferenceStore });
const initialRoute = routeLedger.read();
const app = document.querySelector('#app');
if (!app) throw new Error('Chessview requires an app element');
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

async function discoverRootPredecessors(center, { signal, urgency }): Promise<RefinementOutcome> {
  const reading = await loadExplorerReading(center, { signal, urgency });
  const ids = sampleGameIds(reading);
  if (!ids.length) return Object.freeze({ refinement: 'satisfied' as const });

  debugLog('Root discovery replaying sampled games', { center, games: ids.length });
  const nominations = await discoverSampledPredecessors(center, ids, { signal, urgency });
  let unavailable = false;
  for (const nomination of nominations) {
    if (signal.aborted) return Object.freeze({ refinement: 'unavailable' as const });
    const outcome = await refineExplorerReading(nomination.source, { signal, urgency });
    if (outcome.refinement === 'unavailable') unavailable = true;
  }
  return unavailable
    ? Object.freeze({ refinement: 'unavailable' as const })
    : Object.freeze({ refinement: 'satisfied' as const });
}

function tasksForCurrentView({ center, mode, structure }): readonly RefinementTask[] {
  const demand = deriveCurrentViewRefinementDemand({ center, mode, structure });
  const tasks = new Map<string, RefinementTask>();

  function add(task: RefinementTask) {
    if (!tasks.has(task.key)) tasks.set(task.key, Object.freeze(task));
  }

  const rootTransposition = demand.rootTransposition;
  if (mode === 'roots') {
    add({
      key: `root-discovery:${center}`,
      purpose: 'root-discovery',
      modes: ['roots'],
      nodusWide: false,
      run: ({ signal, urgency }) => discoverRootPredecessors(center, { signal, urgency }),
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
      run: ({ signal, urgency }) => refineExplorerReading(target.position, { signal, urgency }),
    });
  }

  for (const target of demand.cloudEval) {
    add({
      key: `cloud-eval:${target.position}`,
      modes: target.modes,
      nodusWide: target.nodusWide,
      run: ({ signal, urgency }) => lichessEval.get(target.position, { signal, urgency }),
    });
  }

  for (const target of demand.masters) {
    add({
      key: `masters:${target.position}`,
      modes: target.modes,
      nodusWide: target.nodusWide,
      run: ({ signal, urgency }) => loadMasters(target.position, { signal, urgency }),
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
// This notice sits outside #app, so rerenders cannot erase it or the accepted view.
let reconnectNotice: HTMLElement | null = null;
function showReconnectLichess(): void {
  if (reconnectNotice) return;
  const notice = document.createElement('aside');
  notice.className = 'lichess-reconnect';
  notice.setAttribute('role', 'status');
  notice.setAttribute('aria-live', 'polite');
  const title = document.createElement('strong');
  title.textContent = 'Lichess authorization needs attention';
  const message = document.createElement('p');
  message.textContent = 'Fresh Lichess data is unavailable. Your current view remains usable.';
  const reconnect = document.createElement('button');
  reconnect.type = 'button';
  reconnect.textContent = 'Reconnect Lichess';
  reconnect.addEventListener('click', async () => {
    reconnect.disabled = true;
    message.textContent = 'Opening Lichess authorization…';
    try {
      await lichessSession.signIn();
    } catch (error) {
      reconnect.disabled = false;
      message.textContent = error instanceof Error ? error.message : 'Could not begin Lichess sign-in.';
    }
  });
  notice.append(title, message, reconnect);
  document.body.append(notice);
  reconnectNotice = notice;
}
const stopAuthorizationLost = lichessSession.onAuthorizationLost(showReconnectLichess);

function showStartupAuthorizationFailure(error: unknown): void {
  const panel = document.createElement('section');
  panel.className = 'lichess-auth-gate';
  const title = document.createElement('h1');
  title.textContent = 'Lichess sign-in required';
  const message = document.createElement('p');
  message.textContent = error instanceof Error ? error.message : 'Could not authorize with Lichess.';
  const retry = document.createElement('button');
  retry.type = 'button';
  retry.textContent = 'Try again';
  retry.addEventListener('click', () => {
    retry.disabled = true;
    void authorizeAndStart();
  });
  panel.append(title, message, retry);
  app.replaceChildren(panel);
}

// Only application startup initiates the first sign-in; sources never navigate.
async function authorizeAndStart(): Promise<void> {
  let token: string | null;
  try {
    token = await lichessSession.establishAuthorization();
  } catch (error) {
    showStartupAuthorizationFailure(error);
    return;
  }
  if (!token) {
    app.textContent = 'Redirecting to Lichess…';
    return;
  }
  await controller.start();
}

window.addEventListener('beforeunload', () => {
  stopAuthorizationLost();
  reconnectNotice?.remove();
  stopLichessEvalStatus();
  controller.dispose();
  presenter.dispose();
}, { once: true });

await authorizeAndStart();
