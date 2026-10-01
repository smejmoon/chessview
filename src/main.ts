import '@lichess-org/chessground/assets/chessground.base.css';
import '@lichess-org/chessground/assets/chessground.brown.css';
import '@lichess-org/chessground/assets/chessground.cburnett.css';
import './style.css';
import './lichess-eval-presentation.css';
import './debug.css';

import { canonicalPosition } from './graph.js';
import { nominateConstellationLookahead } from './constellation-lookahead.js';
import { discoverSelectedLines } from './constellation-discovery.js';
import { debugLog } from './debug.js';
import { warmExplorerReading } from './knowledge-acquisition.js';
import { materializeMove } from './move-materialization.ts';
import { NodusController } from './nodus-controller.ts';
import { composeNodusStructure } from './nodus-structure.js';
import { loadNodusEvidence } from './evidence-source.js';
import { lichessEval } from './lichess-eval.js';
import { createLichessEvalStatusPresenter } from './lichess-eval-presentation.js';
import { createNodusRenderer } from './nodus-renderer.js';
import { createNodusPresenter } from './nodus-presenter.js';
import { loadNodusRail } from './rail-source.js';
import { createRouteLedger } from './route-ledger.ts';
import { preferenceStore } from './preference-store.js';

function boardBudget() {
  const area = window.innerWidth * window.innerHeight;
  if (window.innerWidth < 620) return 5;
  if (window.innerWidth < 900 || area < 650_000) return 8;
  if (window.innerWidth < 1250 || area < 1_000_000) return 12;
  return 16;
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

function projectionPriority(mode: 'roots' | 'lines') {
  return () => controller.snapshot.mode === mode ? 'foreground' : 'background';
}

async function discover({ center, mode, structure, signal, onProgress }) {
  try {
    await discoverSelectedLines(center, structure, onProgress, {
      signal,
      priority: projectionPriority(mode),
    });
    return null;
  } catch (error) {
    if (signal.aborted) return null;
    debugLog('selected Line acquisition failed', { center, error: error?.message ?? String(error) }, 'error');
    return { error, criticalFailure: true };
  }
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
    priority: projectionPriority(mode),
  }),
  evidence: ({ center, mode, structure, signal }) => loadNodusEvidence({
    center,
    mode,
    structure,
    signal,
    priority: projectionPriority(mode),
  }),
  rail: loadNodusRail,
  discover,
  lookahead: warmLookahead,
  materializeMove,
  presenter,
  log: (message, detail) => { debugLog(message, detail); },
});

debugLog('app start', controller.snapshot);

let resizeTimer;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => { void controller.redraw(); }, 120);
});
window.addEventListener('beforeunload', () => {
  stopLichessEvalStatus();
  controller.dispose();
  presenter.dispose();
}, { once: true });

await controller.start();
