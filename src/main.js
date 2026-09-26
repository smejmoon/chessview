import '@lichess-org/chessground/assets/chessground.base.css';
import '@lichess-org/chessground/assets/chessground.brown.css';
import '@lichess-org/chessground/assets/chessground.cburnett.css';
import './style.css';
import './debug.css';

import { canonicalPosition } from './graph.js';
import { getNode } from './db.js';
import { discoverForViewport } from './explorer.js';
import { debugLog } from './debug.js';
import { NodusController } from './nodus-controller.js';
import { composeNodusStructure } from './nodus-structure.js';
import { loadNodusEvidence } from './evidence-source.js';
import { createNodusRenderer } from './nodus-renderer.js';
import { createRouteLedger } from './route-ledger.js';
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
const renderer = createNodusRenderer({ app: document.querySelector('#app') });

async function discover({ center, signal, onProgress }) {
  try {
    await discoverForViewport(center, boardBudget(), onProgress, { signal });
    return null;
  } catch (error) {
    if (signal.aborted) return null;
    debugLog('discovery failed', { center, error: error?.message ?? String(error) }, 'error');
    let hasPersistedExplorer = false;
    try { hasPersistedExplorer = Boolean((await getNode(center))?.explorer); } catch {}
    return { error, criticalFailure: !hasPersistedExplorer };
  }
}

const controller = new NodusController({
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
  evidence: loadNodusEvidence,
  discover,
  publish: (view, actions) => renderer.render(view, actions),
  log: (message, detail) => debugLog(message, detail),
});

const stopRouteRestore = routeLedger.onRestore((route) => { void controller.restore(route); });
debugLog('app start', controller.snapshot);

let resizeTimer;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => { void controller.redraw(); }, 120);
});
window.addEventListener('beforeunload', () => {
  stopRouteRestore();
  controller.dispose();
  renderer.dispose();
}, { once: true });

await controller.start();
