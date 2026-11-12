import '@lichess-org/chessground/assets/chessground.base.css';
import '@lichess-org/chessground/assets/chessground.brown.css';
import '@lichess-org/chessground/assets/chessground.cburnett.css';
import './style.css';

import { Chessground } from '@lichess-org/chessground';
import { lichessSession } from '../../src/lichess-session.ts';
import { parseStudyPgn, studyIdFromInput } from './study-pgn.ts';
import type { ParsedStudy, StudyNode } from './study-pgn.ts';
import { listLichessStudies, readLichessAccount, readStudyPgn } from './study-source.ts';
import type { StudyLog, StudyMetadata } from './study-source.ts';

const app = document.querySelector<HTMLElement>('#app');
if (!app) throw new Error('Study prototype requires #app');
app.innerHTML = [
  '<div class="prototype">',
  '<header class="topbar"><div class="brand"><span class="brand-mark">♞</span> Chessview <span class="prototype-tag">STUDY LAB</span></div>',
  '<span id="auth-status" class="auth-status">Connecting to Lichess…</span>',
  '<a id="back-link" class="back-link">← Chessview</a></header>',
  '<section class="importbar"><div class="import-heading"><span class="eyebrow">LICHESS STUDIES / PROTOTYPE</span>',
  '<h1>Explore a study as a map of positions.</h1><p>Chapters keep their annotations. Transposed positions share one place.</p></div>',
  '<form id="study-form" class="study-form"><label for="study-input">Study URL or ID</label>',
  '<div class="input-row"><input id="study-input" placeholder="https://lichess.org/study/…" autocomplete="off" spellcheck="false" required/>',
  '<button type="submit" id="open-study" class="primary">Open study</button></div>',
  '<div class="auth-actions"><button type="button" id="my-studies">My studies</button>',
  '<button type="button" id="study-permission" title="Request optional study:read access using the same Lichess login">Grant study access</button>',
  '<span id="status" role="status" aria-live="polite">Sign in with Lichess to begin.</span></div></form></section>',
  '<section class="workspace"><aside class="left-rail"><div class="rail-heading"><span>LIBRARY</span><span id="study-count">—</span></div>',
  '<div id="library" class="library"><p class="muted">Use <b>My studies</b> to browse your Lichess account.</p></div>',
  '<div class="rail-heading"><span>CHAPTERS</span><span id="chapter-count">—</span></div>',
  '<div id="chapters" class="chapter-list"><p class="muted">Open a study to see its chapters.</p></div></aside>',
  '<main class="stage"><div class="stage-toolbar"><div><span class="eyebrow">CONSTELLATION</span>',
  '<h2 id="study-title">No study loaded</h2><p id="study-summary" class="muted">The map will appear here.</p></div>',
  '<div class="map-actions"><button id="previous" disabled title="Previous study move">← Root</button>',
  '<button id="next" disabled title="First continuation">Next line →</button>',
  '<button id="flip" title="Flip all boards">⇅ Flip</button></div></div>',
  '<div id="map" class="map"><div class="empty-map"><span>✧</span><h3>Positions, not a move list.</h3>',
  '<p>Open a Lichess study to see its incoming moves, current Nodus, and study Lines.</p></div></div></main>',
  '<aside class="right-rail"><div class="rail-heading">CHAPTER CONTEXT</div>',
  '<div id="inspector" class="inspector"><p class="muted">Choose a position to see its chapter, variation and comments.</p></div></aside></section>',
  '<details class="logs" id="logs" open><summary><span><b>Activity log</b> <span id="log-count">0 events</span></span>',
  '<span>NETWORK · PARSING · NAVIGATION</span></summary>',
  '<div class="log-toolbar"><span>Visible diagnostic events also appear in the browser console. No tokens or PGN text are logged.</span>',
  '<button id="copy-log">Copy log</button><button id="clear-log">Clear</button></div>',
  '<div id="log-events" role="log" aria-live="off" class="log-events"></div></details></div>',
].join('');

function el<T extends HTMLElement = HTMLElement>(id: string): T {
  const node = app!.querySelector<T>('#' + id);
  if (!node) throw new Error('Missing study element: ' + id);
  return node;
}
el<HTMLAnchorElement>('back-link').href = import.meta.env.BASE_URL;
const studyInput = el<HTMLInputElement>('study-input');
const openButton = el<HTMLButtonElement>('open-study');
const statusNode = el('status');
const authStatus = el('auth-status');
const mapNode = el('map');
const chaptersNode = el('chapters');
const inspectorNode = el('inspector');
const libraryNode = el('library');
const previousButton = el<HTMLButtonElement>('previous');
const nextButton = el<HTMLButtonElement>('next');
const studyPermission = el<HTMLButtonElement>('study-permission');
const logEventsNode = el('log-events');

type Occurrence = { chapterIndex: number; node: StudyNode };
type LogRecord = { when: string; area: string; event: string; detail: Record<string, unknown> };
const events: LogRecord[] = [];
const MAX_LOGS = 300;
let groundViews: ReturnType<typeof Chessground>[] = [];
let study: ParsedStudy | null = null;
let active: Occurrence | null = null;
let occurrencesByPosition = new Map<string, Occurrence[]>();
let username: string | null = null;
let requestAbort: AbortController | null = null;
let loading = false;
let orientation: 'white' | 'black' = 'white';
let libraryStudies: StudyMetadata[] = [];

const log: StudyLog = (area, event, detail = {}) => {
  const record: LogRecord = { when: new Date().toISOString(), area, event, detail };
  events.push(record);
  if (events.length > MAX_LOGS) events.shift();
  const line = document.createElement('div');
  line.className = 'log-event' + (area === 'error' ? ' log-error' : '');
  const stamp = document.createElement('time');
  stamp.textContent = record.when.slice(11, 23);
  const kind = document.createElement('span');
  kind.className = 'log-kind';
  kind.textContent = area;
  const message = document.createElement('span');
  message.textContent = event + (Object.keys(detail).length ? ' · ' + JSON.stringify(detail) : '');
  line.append(stamp, kind, message);
  logEventsNode.append(line);
  while (logEventsNode.children.length > MAX_LOGS) logEventsNode.firstChild?.remove();
  logEventsNode.scrollTop = logEventsNode.scrollHeight;
  el('log-count').textContent = events.length + ' events';
  const consoleMethod = area === 'error' ? console.error : console.info;
  consoleMethod('[Chessview Study Lab]', area, event, detail);
};

function setStatus(message: string, error = false) {
  statusNode.textContent = message;
  statusNode.classList.toggle('status-error', error);
  log(error ? 'error' : 'ui', message);
}
function setLoading(next: boolean) {
  loading = next;
  openButton.disabled = next;
  el<HTMLButtonElement>('my-studies').disabled = next;
  studyInput.disabled = next;
  openButton.textContent = next ? 'Loading…' : 'Open study';
}
function clearGrounds() {
  for (const ground of groundViews) ground.destroy();
  groundViews = [];
}

function indexStudy(document: ParsedStudy) {
  occurrencesByPosition = new Map();
  for (const [chapterIndex, chapter] of document.chapters.entries()) {
    const walk = (node: StudyNode) => {
      const list = occurrencesByPosition.get(node.key) || [];
      list.push({ chapterIndex, node });
      occurrencesByPosition.set(node.key, list);
      node.children.forEach(walk);
    };
    walk(chapter.root);
  }
  log('graph', 'canonical positions indexed', {
    positions: occurrencesByPosition.size, occurrences: document.occurrences,
    mergedPositions: document.repeatedPositions, chapterCount: document.chapters.length,
  });
}

function chapterName(occurrence: Occurrence) {
  return study!.chapters[occurrence.chapterIndex].name;
}
function allOccurrences(key: string): Occurrence[] {
  const others = occurrencesByPosition.get(key) || [];
  if (!active) return others;
  return others.slice().sort((a, b) => {
    if (a === active) return -1;
    if (b === active) return 1;
    return Number(b.chapterIndex === active!.chapterIndex) - Number(a.chapterIndex === active!.chapterIndex);
  });
}
function uniqueNeighbors(kind: 'roots' | 'lines'): Occurrence[] {
  if (!active) return [];
  const selected = new Map<string, Occurrence>();
  for (const occurrence of allOccurrences(active.node.key)) {
    const nodes = kind === 'roots'
      ? occurrence.node.parent ? [occurrence.node.parent] : []
      : occurrence.node.children;
    for (const node of nodes) {
      const key = node.key;
      if (!selected.has(key)) selected.set(key, { chapterIndex: occurrence.chapterIndex, node });
    }
  }
  return [...selected.values()];
}

function boardCard(occurrence: Occurrence, label: string, kind: 'root' | 'nodus' | 'line' | 'continuation'): HTMLElement {
  const center = kind === 'nodus';
  const card = document.createElement(center ? 'section' : 'button');
  card.className = 'position-card ' + kind;
  if (!center) {
    (card as HTMLButtonElement).type = 'button';
    card.addEventListener('click', () => choose(occurrence));
  }
  const top = document.createElement('div');
  top.className = 'card-top';
  const badge = document.createElement('span');
  badge.textContent = label;
  const move = document.createElement('strong');
  move.textContent = occurrence.node.san || 'Start';
  top.append(badge, move);
  const board = document.createElement('div');
  board.className = 'study-board';
  const bottom = document.createElement('div');
  bottom.className = 'card-bottom';
  const copies = occurrencesByPosition.get(occurrence.node.key)?.length || 1;
  bottom.textContent = copies > 1 ? copies + ' study occurrences' : chapterName(occurrence);
  card.append(top, board, bottom);
  groundViews.push(Chessground(board, {
    fen: occurrence.node.fen, orientation, viewOnly: true,
    animation: { enabled: false }, drawable: { enabled: false },
  }));
  return card;
}

function panel(title: string): HTMLElement {
  const column = document.createElement('div');
  column.className = 'map-column';
  const heading = document.createElement('div');
  heading.className = 'column-heading';
  heading.textContent = title;
  column.append(heading);
  return column;
}

function renderMap() {
  clearGrounds();
  mapNode.replaceChildren();
  if (!active || !study) return;
  const roots = uniqueNeighbors('roots');
  const lines = uniqueNeighbors('lines');
  const rootColumn = panel('ROOTS  /  ' + roots.length);
  if (!roots.length) rootColumn.append(messageNode('No authored Roots at this position.'));
  for (const root of roots.slice(0, 4)) rootColumn.append(boardCard(root, '← from ' + (root.node.ply + 1), 'root'));
  if (roots.length > 4) rootColumn.append(messageNode('+' + (roots.length - 4) + ' more Roots'));
  const currentColumn = panel('NODUS');
  currentColumn.append(boardCard(active, 'CURRENT POSITION', 'nodus'));
  const lineColumn = panel('LINES  /  ' + lines.length);
  if (!lines.length) lineColumn.append(messageNode('This study has no continuation from here.'));
  for (const line of lines.slice(0, 6)) lineColumn.append(boardCard(line, '→ move ' + line.node.ply, 'line'));
  if (lines.length > 6) lineColumn.append(messageNode('+' + (lines.length - 6) + ' more in the Rail'));
  const continuations = panel('NEXT  /  PREVIEW');
  let shown = 0;
  for (const line of lines.slice(0, 6)) {
    const next = line.node.children[0];
    if (!next) continue;
    continuations.append(boardCard({ chapterIndex: line.chapterIndex, node: next }, 'after ' + line.node.san, 'continuation'));
    shown += 1;
    if (shown === 4) break;
  }
  if (!shown) continuations.append(messageNode('Choose a Line to explore deeper.'));
  mapNode.append(rootColumn, currentColumn, lineColumn, continuations);
  log('render', 'map redrawn', {
    rootCount: roots.length, lineCount: lines.length, nextCount: shown,
    boardsRendered: groundViews.length, transpositionOccurrences: allOccurrences(active.node.key).length,
  });
}

function messageNode(value: string): HTMLElement {
  const p = document.createElement('p');
  p.className = 'muted column-note';
  p.textContent = value;
  return p;
}

function renderChapters() {
  chaptersNode.replaceChildren();
  if (!study) return;
  el('chapter-count').textContent = String(study.chapters.length);
  for (const [index, chapter] of study.chapters.entries()) {
    const button = document.createElement('button');
    button.className = 'chapter-item' + (active?.chapterIndex === index ? ' selected' : '');
    const number = document.createElement('small');
    number.textContent = String(index + 1).padStart(2, '0');
    const title = document.createElement('span');
    title.textContent = chapter.name;
    const count = document.createElement('small');
    count.textContent = chapter.nodeCount + ' positions';
    button.append(number, title, count);
    button.addEventListener('click', () => {
      log('nav', 'chapter selected', { chapter: index + 1, nodes: chapter.nodeCount });
      choose({ chapterIndex: index, node: chapter.root });
    });
    chaptersNode.append(button);
  }
}

function actionButton(label: string, onClick: () => void): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = label;
  button.addEventListener('click', onClick);
  return button;
}

function renderInspector() {
  inspectorNode.replaceChildren();
  if (!active || !study) return;
  const chapter = study.chapters[active.chapterIndex];
  const heading = document.createElement('h3');
  heading.textContent = chapter.name;
  const open = document.createElement('a');
  open.href = chapter.url;
  open.target = '_blank';
  open.rel = 'noopener noreferrer';
  open.textContent = 'View original Lichess chapter ↗';
  const position = document.createElement('p');
  position.className = 'muted';
  position.textContent = 'Move ' + active.node.ply + (active.node.san ? ' · ' + active.node.san : ' · chapter start');
  const commentsLabel = document.createElement('h4');
  commentsLabel.textContent = 'Study notes';
  inspectorNode.append(heading, open, position, commentsLabel);
  if (!active.node.comments.length) inspectorNode.append(messageNode('No written comment for this move.'));
  for (const comment of active.node.comments) {
    const note = document.createElement('p');
    note.className = 'comment';
    note.textContent = comment;
    inspectorNode.append(note);
  }
  if (active.node.nags.length) {
    const nags = document.createElement('p');
    nags.className = 'nags';
    nags.textContent = 'Annotations: ' + [...new Set(active.node.nags)].join(' ');
    inspectorNode.append(nags);
  }
  const pathTitle = document.createElement('h4');
  pathTitle.textContent = 'Chapter route';
  inspectorNode.append(pathTitle);
  const crumbs = document.createElement('div');
  crumbs.className = 'breadcrumbs';
  const path: StudyNode[] = [];
  for (let n: StudyNode | null = active.node; n; n = n.parent) path.unshift(n);
  for (const node of path) {
    crumbs.append(actionButton(node.san || 'Start', () => choose({ chapterIndex: active!.chapterIndex, node })));
  }
  inspectorNode.append(crumbs);
  const alternativesTitle = document.createElement('h4');
  alternativesTitle.textContent = 'Authored continuations';
  inspectorNode.append(alternativesTitle);
  const alternatives = uniqueNeighbors('lines');
  if (!alternatives.length) inspectorNode.append(messageNode('End of available study Lines.'));
  for (const occurrence of alternatives) {
    inspectorNode.append(actionButton(occurrence.node.san + ' · ' + chapterName(occurrence), () => choose(occurrence)));
  }
  const seen = allOccurrences(active.node.key);
  if (seen.length > 1) {
    const alsoTitle = document.createElement('h4');
    alsoTitle.textContent = 'Same canonical position · ' + seen.length + ' occurrences';
    inspectorNode.append(alsoTitle);
    for (const occurrence of seen.slice(0, 12)) {
      inspectorNode.append(actionButton(
        chapterName(occurrence) + ' · ' + (occurrence.node.san || 'Start'),
        () => choose(occurrence),
      ));
    }
  }
}

function choose(occurrence: Occurrence, historyMode: 'push' | 'replace' | 'none' = 'push') {
  if (!study) return;
  const previousKey = active?.node.key;
  active = occurrence;
  const chapter = study.chapters[occurrence.chapterIndex];
  orientation = chapter.orientation;
  el('study-title').textContent = study.name;
  el('study-summary').textContent = study.chapters.length + ' chapters · ' +
    study.positions + ' distinct positions · ' + study.repeatedPositions + ' positions shared by multiple study occurrences';
  previousButton.disabled = !active.node.parent;
  nextButton.disabled = uniqueNeighbors('lines').length === 0;
  log('nav', 'recenter', {
    chapter: occurrence.chapterIndex + 1, ply: occurrence.node.ply,
    move: occurrence.node.san || 'start', sameCanonicalPosition: previousKey === active.node.key,
    route: historyMode,
  });
  renderChapters();
  renderMap();
  renderInspector();
  if (historyMode !== 'none') {
    const url = new URL(window.location.href);
    url.searchParams.set('study', study.id);
    url.searchParams.set('chapter', chapter.id);
    url.searchParams.set('fen', active.node.key);
    history[historyMode === 'push' ? 'pushState' : 'replaceState']({}, '', url.pathname + url.search);
  }
}

function findRoute(chapterId: string | null, fen: string | null): Occurrence {
  const fallback = { chapterIndex: 0, node: study!.chapters[0].root };
  const chapterIndex = study!.chapters.findIndex((chapter) => chapter.id === chapterId);
  if (!fen) return chapterIndex >= 0 ? { chapterIndex, node: study!.chapters[chapterIndex].root } : fallback;
  const possibilities = occurrencesByPosition.get(fen) || [];
  return possibilities.find((occurrence) => occurrence.chapterIndex === chapterIndex) ||
    possibilities[0] ||
    (chapterIndex >= 0 ? { chapterIndex, node: study!.chapters[chapterIndex].root } : fallback);
}

async function openStudy(value: string, routeChapter?: string | null, routeFen?: string | null, restoring = false) {
  let studyId: string;
  let requestedChapter: string | undefined;
  try {
    ({ studyId, chapterId: requestedChapter } = studyIdFromInput(value));
  } catch (error) {
    setStatus(error instanceof Error ? error.message : 'Invalid study link', true);
    return;
  }
  requestAbort?.abort();
  requestAbort = new AbortController();
  setLoading(true);
  studyInput.value = 'https://lichess.org/study/' + studyId;
  const started = performance.now();
  log('study', 'load started', { hasChapterTarget: Boolean(routeChapter || requestedChapter), restoring });
  setStatus('Loading Lichess study…');
  try {
    const { pgn, publicOnly } = await readStudyPgn(studyId, log, requestAbort.signal);
    const parseStarted = performance.now();
    const parsed = parseStudyPgn(studyId, pgn);
    log('parser', 'PGN parsed', {
      elapsedMs: Math.round(performance.now() - parseStarted),
      chapters: parsed.chapters.length, occurrences: parsed.occurrences,
      positions: parsed.positions, transpositions: parsed.repeatedPositions,
      skippedChapters: parsed.skipped.length,
    });
    for (const reason of parsed.skipped) log('parser', 'chapter skipped', { reason });
    study = parsed;
    indexStudy(parsed);
    const focus = findRoute(routeChapter || requestedChapter || null, routeFen || null);
    choose(focus, restoring ? 'none' : 'replace');
    setStatus('Loaded ' + parsed.chapters.length + ' chapters in ' +
      Math.round(performance.now() - started) + ' ms.' +
      (publicOnly ? ' Public access used.' : '') +
      (parsed.skipped.length ? ' ' + parsed.skipped.length + ' unsupported chapters skipped.' : ''));
  } catch (error) {
    if (requestAbort.signal.aborted) { log('network', 'obsolete study load discarded'); return; }
    const message = error instanceof Error ? error.message : String(error);
    log('error', 'study load failed', { message, elapsedMs: Math.round(performance.now() - started) });
    setStatus(message, true);
  } finally {
    if (!requestAbort.signal.aborted) setLoading(false);
  }
}

function renderLibrary(publicOnly: boolean) {
  libraryNode.replaceChildren();
  el('study-count').textContent = String(libraryStudies.length);
  if (publicOnly) {
    const hint = messageNode('Showing public studies only. Grant study access to include your private and unlisted studies.');
    hint.classList.add('permission-note');
    libraryNode.append(hint);
  }
  if (!libraryStudies.length) libraryNode.append(messageNode('No studies were returned.'));
  for (const item of libraryStudies.slice(0, 80)) {
    const button = actionButton(item.name, () => { void openStudy(item.id); });
    button.className = 'library-item';
    button.title = 'Open ' + item.name;
    libraryNode.append(button);
  }
  if (libraryStudies.length > 80) libraryNode.append(messageNode('Showing 80 of ' + libraryStudies.length + ' studies.'));
  log('render', 'library rendered', { displayed: Math.min(80, libraryStudies.length), publicOnly });
}

async function myStudies() {
  if (loading) return;
  setLoading(true);
  setStatus('Loading your Lichess study list…');
  try {
    if (!username) username = await readLichessAccount(log);
    const result = await listLichessStudies(username, log);
    libraryStudies = result.studies;
    renderLibrary(result.publicOnly);
    setStatus(result.studies.length + ' studies found' + (result.publicOnly ? ' (public only).' : '.'));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log('error', 'library failed', { message });
    setStatus(message, true);
  } finally { setLoading(false); }
}

el<HTMLFormElement>('study-form').addEventListener('submit', (event) => {
  event.preventDefault();
  void openStudy(studyInput.value);
});
el<HTMLButtonElement>('my-studies').addEventListener('click', () => { void myStudies(); });
studyPermission.addEventListener('click', async () => {
  log('auth', 'visitor requested optional study:read permission');
  setStatus('Opening Lichess to grant study permission…');
  try { await lichessSession.signIn({ scope: 'study:read' }); }
  catch (error) { setStatus(error instanceof Error ? error.message : 'Could not start Lichess authorization.', true); }
});
previousButton.addEventListener('click', () => {
  if (active?.node.parent) choose({ chapterIndex: active.chapterIndex, node: active.node.parent });
});
nextButton.addEventListener('click', () => {
  const next = uniqueNeighbors('lines')[0];
  if (next) choose(next);
});
el<HTMLButtonElement>('flip').addEventListener('click', () => {
  orientation = orientation === 'white' ? 'black' : 'white';
  for (const ground of groundViews) ground.set({ orientation });
  log('ui', 'board orientation flipped', { orientation });
});
el<HTMLButtonElement>('copy-log').addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(events.map((entry) => JSON.stringify(entry)).join('\n'));
    setStatus('Copied ' + events.length + ' diagnostic events to the clipboard.');
  } catch (error) {
    setStatus('Could not copy log. You can select and copy the text manually.', true);
    log('error', 'clipboard write failed', { message: String(error) });
  }
});
el<HTMLButtonElement>('clear-log').addEventListener('click', () => {
  events.length = 0;
  logEventsNode.replaceChildren();
  el('log-count').textContent = '0 events';
});
document.addEventListener('keydown', (event) => {
  if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;
  if (event.key === 'ArrowLeft' && active?.node.parent) {
    event.preventDefault();
    choose({ chapterIndex: active.chapterIndex, node: active.node.parent });
  } else if (event.key === 'ArrowRight') {
    const next = uniqueNeighbors('lines')[0];
    if (next) { event.preventDefault(); choose(next); }
  }
});
window.addEventListener('popstate', () => {
  const route = new URL(window.location.href).searchParams;
  const id = route.get('study');
  if (!id) return;
  log('nav', 'browser history restored');
  if (study?.id === id) choose(findRoute(route.get('chapter'), route.get('fen')), 'none');
  else void openStudy(id, route.get('chapter'), route.get('fen'), true);
});
lichessSession.onAuthorizationLost(() => {
  authStatus.textContent = 'Lichess session expired';
  setStatus('Lichess authorization expired. Grant study access or reconnect to continue.', true);
  log('auth', 'stored Lichess token rejected');
});

async function start() {
  log('app', 'study prototype booted', {
    basePath: import.meta.env.BASE_URL, page: window.location.pathname,
    sharedLichessSession: true, transport: 'LichessGateway',
  });
  try {
    const token = await lichessSession.establishAuthorization();
    if (!token) {
      log('auth', 'redirecting visitor to Lichess login');
      return;
    }
    authStatus.textContent = 'Lichess connected';
    log('auth', 'existing Lichess session accepted', { tokenPresent: true });
    try {
      username = await readLichessAccount(log);
      authStatus.textContent = 'Signed in · ' + username;
      log('auth', 'account identity available');
    } catch (error) {
      log('error', 'account identity unavailable', { message: String(error) });
    }
    const route = new URL(window.location.href).searchParams;
    const target = route.get('study');
    if (target) await openStudy(target, route.get('chapter'), route.get('fen'), true);
    else setStatus('Connected to Lichess. Open a study or browse your studies.');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    authStatus.textContent = 'Lichess connection failed';
    log('error', 'startup authorization failed', { message });
    setStatus(message + ' Use Grant study access to try signing in again.', true);
  }
}
void start();
