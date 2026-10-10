import '@lichess-org/chessground/assets/chessground.base.css';
import '@lichess-org/chessground/assets/chessground.brown.css';
import '@lichess-org/chessground/assets/chessground.cburnett.css';
import './style.css';
import './lichess-eval-presentation.css';
import './debug.css';

import { canonicalPosition } from './graph.ts';
import { nominateConstellationLookahead } from './constellation-lookahead.ts';
import { CurrentViewController } from './current-view-controller.ts';
import { switchboard } from './switchboard.ts';
import { debugLog } from './debug.ts';
import { clearExplorerCache } from './explorer-cache.ts';
import { warmExplorerReading } from './knowledge-acquisition.ts';
import { createLens } from './lens.ts';
import { lichessSession } from './lichess-session.ts';
import { materializeMove } from './move-materialization.ts';
import { composeNodusStructure } from './nodus-structure.ts';
import { lichessEval } from './lichess-eval.ts';
import { createLichessEvalStatusPresenter } from './lichess-eval-presentation.ts';
import { createNodusRenderer } from './nodus-renderer.ts';
import { createNodusPresenter } from './nodus-presenter.ts';
import { composeNodusRail } from './rail-source.ts';
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
    void authorizeAndStart();
  });
  panel.append(heading, message, retry);
  app.replaceChildren(panel);
}

// No view or source work is started until authentication is established.
async function authorizeAndStart(): Promise<void> {
  try {
    const token = await lichessSession.establishAuthorization();
    if (!token) {
      app.textContent = 'Redirecting to Lichess…';
      return;
    }
  } catch (error) {
    showAuthorizationFailure(error);
    return;
  }

  await startApplication();
}

async function startApplication(): Promise<void> {
  const routeLedger = createRouteLedger({ preferences: preferenceStore });
  const initialRoute = routeLedger.read();
  const lens = createLens({ app, preferences: preferenceStore });
  let controller: CurrentViewController;

  async function clearExplorerAndReload(positions?: readonly string[]): Promise<void> {
    debugLog(positions ? 'Refetching current view' : 'Clearing Explorer cache', {
      positions: positions?.length ?? 'all',
    });
    disposeApplication();
    try {
      await clearExplorerCache(positions);
    } catch (error) {
      debugLog('Explorer cache maintenance failed', error, 'error');
      const panel = document.createElement('section');
      panel.className = 'auth-gate';
      const heading = document.createElement('h1');
      heading.textContent = 'Could not clear Explorer cache';
      const retry = document.createElement('button');
      retry.type = 'button';
      retry.textContent = 'Reload Chessview';
      retry.addEventListener('click', () => window.location.reload());
      panel.append(heading, retry);
      app.replaceChildren(panel);
      throw error;
    }
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
    refine: switchboard,
    lookahead: warmLookahead,
    materializeMove,
    presenter,
    log: (message, detail) => { debugLog(message, detail); },
  });

  debugLog('app start', controller.snapshot);

  let resizeTimer: ReturnType<typeof setTimeout> | undefined;
  let disposed = false;

  function onResize(): void {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      resizeTimer = undefined;
      if (disposed) return;
      const mode = controller.snapshot.mode;
      const previous = constraintsByMode.get(mode);
      const next = lens.constraints(mode);
      if (previous && previous.lineCapacity === next.lineCapacity && previous.rootCapacity === next.rootCapacity) {
        void controller.redraw().catch((error) => {
          debugLog('resize redraw failed', error, 'error');
        });
        return;
      }
      constraintsByMode.set(mode, next);
      void controller.recompose().catch((error) => {
        debugLog('resize recomposition failed', error, 'error');
      });
    }, RESIZE_UPDATE_DEBOUNCE_MS);
  }

  function disposeApplication(): void {
    if (disposed) return;
    disposed = true;
    clearTimeout(resizeTimer);
    window.removeEventListener('resize', onResize);
    window.removeEventListener('beforeunload', disposeApplication);
    stopLichessEvalStatus();
    controller.dispose();
    presenter.dispose();
  }

  window.addEventListener('resize', onResize);
  window.addEventListener('beforeunload', disposeApplication, { once: true });

  try {
    await controller.start();
  } catch (error) {
    debugLog('app startup failed', error, 'error');
    disposeApplication();
    const panel = document.createElement('section');
    panel.className = 'auth-gate';
    const heading = document.createElement('h1');
    heading.textContent = 'Chessview could not start';
    const retry = document.createElement('button');
    retry.type = 'button';
    retry.textContent = 'Reload to try again';
    retry.addEventListener('click', () => window.location.reload());
    panel.append(heading, retry);
    app.replaceChildren(panel);
  }
}

await authorizeAndStart();
