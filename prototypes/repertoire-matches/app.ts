import '@lichess-org/chessground/assets/chessground.base.css';
import '@lichess-org/chessground/assets/chessground.brown.css';
import '@lichess-org/chessground/assets/chessground.cburnett.css';
import './style.css';

import { Chessground } from '@lichess-org/chessground';
import { lichessSession } from '../../src/lichess-session.ts';
import { toPlayableFen } from '../../src/graph.ts';
import { buildRepertoire, compareRepertoires } from './matcher.ts';
import type { Repertoire, RepertoireMatch, SharedPosition } from './matcher.ts';
import { accountName, discoverCandidates, exportGames, httpStatus } from './lichess-source.ts';
import type { Log, StrongPlayer } from './lichess-source.ts';

const app = document.querySelector<HTMLElement>('#app');
if (!app) throw new Error('Repertoire lab needs #app');
app.innerHTML = [
  '<div class="lab"><header class="top"><a id="home" class="brand">♞ Chessview</a><span class="lab-tag">REPERTOIRE LAB / PROTOTYPE</span><span id="identity">Connecting…</span></header>',
  '<section class="intro"><div><span class="eyebrow">FIND YOUR CHESS TWINS</span><h1>Who plays your openings?</h1>',
  '<p>Compare your recent rated games with strong titled Lichess players. Shared positions, similar decisions, and useful differences — with real games behind the matches.</p></div>',
  '<form id="controls"><label for="months">Game history</label><select id="months"><option value="6">Last 6 months</option><option value="12" selected>Last 12 months</option><option value="24">Last 24 months</option></select>',
  '<label for="candidates">Candidate sample</label><select id="candidates"><option value="8">8 players · quick</option><option value="16" selected>16 players</option><option value="30">30 players · broader</option></select>',
  '<button id="start" type="submit">Find similar players</button><button id="stop" type="button" disabled>Cancel</button>',
  '<span id="status" role="status" aria-live="polite">Connect to Lichess to begin.</span></form></section>',
  '<section class="content"><aside class="rankings"><div class="pane-title">MATCHES <span id="match-count">—</span></div>',
  '<div id="results"><p class="muted">Run a search to discover titled players who reach positions you play.</p></div></aside>',
  '<main class="details"><div id="summary" class="summary"><h2>Repertoire comparison</h2><p class="muted">Scores use your position frequencies, with deeper opening decisions weighted more heavily. All comparisons are separated by color.</p></div>',
  '<div id="shared" class="shared"></div></main></section>',
  '<details class="diagnostics" open><summary><b>Activity log</b><span id="log-count">0 events</span></summary>',
  '<div class="log-tools"><span>Requests, parsed game counts, coverage, and failures. No tokens or full game content are logged.</span>',
  '<button id="copy" type="button">Copy log</button><button id="clear" type="button">Clear</button></div>',
  '<div id="events" role="log" class="events"></div></details></div>',
].join('');

function el<T extends HTMLElement = HTMLElement>(id: string): T {
  const found = app!.querySelector<T>('#' + id);
  if (!found) throw new Error('Missing prototype element ' + id);
  return found;
}
el<HTMLAnchorElement>('home').href = import.meta.env.BASE_URL;
const logContainer = el('events');
const records: { timestamp: string; area: string; event: string; detail: Record<string, unknown> }[] = [];
const log: Log = (area, event, detail = {}) => {
  const record = { timestamp: new Date().toISOString(), area, event, detail };
  records.push(record);
  if (records.length > 400) records.shift();
  const row = document.createElement('div');
  row.className = 'event' + (area === 'error' ? ' error' : '');
  const time = document.createElement('time');
  time.textContent = record.timestamp.slice(11, 23);
  const kind = document.createElement('span');
  kind.textContent = area.toUpperCase();
  const message = document.createElement('span');
  message.textContent = event + (Object.keys(detail).length ? ' · ' + JSON.stringify(detail) : '');
  row.append(time, kind, message);
  logContainer.append(row);
  while (logContainer.children.length > 400) logContainer.firstElementChild?.remove();
  logContainer.scrollTop = logContainer.scrollHeight;
  el('log-count').textContent = records.length + ' events';
  (area === 'error' ? console.error : console.info)('[Chessview Repertoire Lab]', area, event, detail);
};

type MatchRow = { player: StrongPlayer; match: RepertoireMatch; repertoire: Repertoire };
let username: string | null = null;
let controller: AbortController | null = null;
let selected = -1;
let foundMatches: MatchRow[] = [];
let ownProfile: Repertoire | null = null;
let ground: ReturnType<typeof Chessground> | null = null;
let running = false;

function status(message: string, error = false) {
  el('status').textContent = message;
  el('status').classList.toggle('bad', error);
  log(error ? 'error' : 'ui', message);
}
function toggleRunning(value: boolean) {
  running = value;
  el<HTMLButtonElement>('start').disabled = value || !username;
  el<HTMLButtonElement>('stop').disabled = !value;
  el<HTMLSelectElement>('months').disabled = value;
  el<HTMLSelectElement>('candidates').disabled = value;
}
function node(tag: string, text: string, cls = ''): HTMLElement {
  const element = document.createElement(tag);
  element.textContent = text;
  if (cls) element.className = cls;
  return element;
}
function ratio(value: number | null): string {
  return value === null ? '—' : Math.round(value * 100) + '%';
}
function clearBoard() {
  ground?.destroy();
  ground = null;
}
function resultRank(row: MatchRow, index: number) {
  const button = document.createElement('button');
  button.className = 'result' + (selected === index ? ' active' : '');
  const name = node('strong', row.player.title + ' ' + row.player.name);
  const rating = node('small', row.player.board + ' ' + row.player.rating);
  const score = node('span', row.match.score + '%', 'score');
  const nameColumn = document.createElement('div');
  nameColumn.append(name, rating);
  const subtitle = node('span',
    'White ' + ratio(row.match.bySide.white.coverage) + ' · Black ' + ratio(row.match.bySide.black.coverage),
    'muted');
  button.append(nameColumn, score, subtitle);
  button.addEventListener('click', () => { selected = index; render(); log('ui', 'candidate selected', { player: row.player.name }); });
  return button;
}
function actionLink(url: string, text: string): HTMLAnchorElement {
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.target = '_blank';
  anchor.rel = 'noopener noreferrer';
  anchor.textContent = text;
  return anchor;
}
function findPosition(position: SharedPosition, player: StrongPlayer) {
  const card = document.createElement('article');
  card.className = 'position';
  const heading = document.createElement('div');
  heading.className = 'position-head';
  heading.append(node('strong', position.side.toUpperCase() + ' · ply ' + Math.round(position.ply + 1)),
    node('span', position.visits + ' yours / ' + position.candidateVisits + ' theirs', 'muted'));
  const decision = node('p',
    'Your main move: ' + position.userMove + ' (' + ratio(position.userShare) + ')' +
    '  ·  ' + player.name + ': ' + position.candidateMove + ' (' + ratio(position.candidateShare) + ')');
  const links = document.createElement('div');
  links.className = 'position-links';
  const route = new URL(import.meta.env.BASE_URL, window.location.href);
  route.searchParams.set('fen', position.key);
  links.append(actionLink(route.toString(), 'Open position in Chessview'),
    actionLink('https://lichess.org/' + position.exampleGame, 'Example game'));
  const previewButton = node('button', 'Inspect board') as HTMLButtonElement;
  previewButton.type = 'button';
  previewButton.addEventListener('click', () => {
    const host = el('preview');
    host.replaceChildren();
    clearBoard();
    ground = Chessground(host, {
      fen: toPlayableFen(position.key), orientation: position.side,
      viewOnly: true, animation: { enabled: false }, drawable: { enabled: false },
    });
    log('ui', 'preview position', { side: position.side, ply: position.ply, player: player.name });
  });
  links.prepend(previewButton);
  card.append(heading, decision, links);
  return card;
}
function render() {
  const resultNode = el('results');
  resultNode.replaceChildren();
  el('match-count').textContent = foundMatches.length ? String(foundMatches.length) : '—';
  for (const [index, item] of foundMatches.entries()) resultNode.append(resultRank(item, index));
  if (!foundMatches.length) resultNode.append(node('p', 'No scored candidates yet.', 'muted'));
  const summary = el('summary');
  const shared = el('shared');
  summary.replaceChildren();
  shared.replaceChildren();
  clearBoard();
  if (selected < 0 || !foundMatches[selected]) {
    summary.append(node('h2', 'Repertoire comparison'),
      node('p', ownProfile ? ownProfile.accepted + ' of your games analyzed; candidate matches will appear as they arrive.' :
        'Sign in and run a comparison.', 'muted'));
    return;
  }
  const { player, match, repertoire } = foundMatches[selected];
  summary.append(node('h2', player.title + ' ' + player.name),
    node('p', match.score + '% weighted similarity · ' + ratio(match.coverage) +
      ' position coverage · ' + ratio(match.agreement) + ' move-choice agreement'),
    actionLink('https://lichess.org/@/' + encodeURIComponent(player.name), 'Lichess profile'));
  const stats = document.createElement('div');
  stats.className = 'stats';
  for (const side of ['white', 'black'] as const) {
    const data = match.bySide[side];
    const box = document.createElement('div');
    box.className = 'stat';
    box.append(node('h3', side === 'white' ? 'As White' : 'As Black'),
      node('strong', ratio(data.coverage) + ' shared positions'),
      node('span', ratio(data.agreement) + ' move-choice agreement'),
      node('small', data.sharedPositions + ' / ' + data.profilePositions + ' distinct positions; ' +
        data.userGames + ' your games, ' + data.candidateGames + ' candidate games'));
    stats.append(box);
  }
  const note = node('p',
    'Sample: ' + repertoire.accepted + ' games analyzed for ' + player.name + ', ' +
    repertoire.skipped + ' excluded. Similarity is descriptive, not a chess strength rating; sparse samples may understate overlap.',
    'muted');
  summary.append(stats, note);
  const heading = node('h3', 'Shared opening decisions · ' + match.shared.length + ' shown');
  const preview = node('div', '', 'board-preview');
  preview.id = 'preview';
  shared.append(heading, preview);
  if (!match.shared.length) shared.append(node('p', 'No matching opening positions in the sampled games.', 'muted'));
  for (const position of match.shared) shared.append(findPosition(position, player));
}

async function run() {
  if (!username || running) return;
  controller?.abort();
  const active = new AbortController();
  controller = active;
  toggleRunning(true);
  selected = -1;
  foundMatches = [];
  ownProfile = null;
  render();
  const months = Number(el<HTMLSelectElement>('months').value);
  const count = Number(el<HTMLSelectElement>('candidates').value);
  const started = performance.now();
  try {
    status('Analyzing your recent games…');
    const own = await exportGames(username, 500, months, log, active.signal);
    ownProfile = buildRepertoire(username, own.games);
    log('profile', 'own repertoire constructed', {
      games: ownProfile.accepted, skipped: ownProfile.skipped, white: ownProfile.games.white,
      black: ownProfile.games.black, whitePositions: ownProfile.positions.white.size,
      blackPositions: ownProfile.positions.black.size,
    });
    if (ownProfile.accepted === 0) throw new Error('No eligible rated standard games found in the selected period.');
    status('Finding strong-player candidates…');
    const candidates = await discoverCandidates(username, count, log, active.signal);
    if (!candidates.length) throw new Error('No titled players found on available leaderboards.');
    for (const [index, candidate] of candidates.entries()) {
      if (active.signal.aborted) break;
      status('Comparing ' + (index + 1) + '/' + candidates.length + ': ' + candidate.name);
      try {
        const exported = await exportGames(candidate.name, 250, months, log, active.signal);
        const repertoire = buildRepertoire(candidate.name, exported.games);
        const match = compareRepertoires(ownProfile, repertoire);
        log('match', 'candidate scored', {
          player: candidate.name, score: match.score, coverage: ratio(match.coverage),
          agreement: ratio(match.agreement), games: repertoire.accepted,
          skipped: repertoire.skipped, sharedWhite: match.bySide.white.sharedPositions,
          sharedBlack: match.bySide.black.sharedPositions,
        });
        if (repertoire.accepted) {
          foundMatches.push({ player: candidate, match, repertoire });
          foundMatches.sort((a, b) => b.match.score - a.match.score ||
            (b.match.shared.length - a.match.shared.length));
          if (selected < 0) selected = 0;
          render();
        }
      } catch (error) {
        if (active.signal.aborted) break;
        log('error', 'candidate acquisition failed', {
          player: candidate.name, status: httpStatus(error),
          reason: error instanceof Error ? error.message : String(error),
        });
        if (httpStatus(error) === 429 || httpStatus(error) === 401) throw error;
      }
    }
    if (active.signal.aborted) return;
    status('Compared ' + foundMatches.length + ' candidates in ' +
      Math.round((performance.now() - started) / 1000) + 's. Select any match to inspect.');
  } catch (error) {
    if (!active.signal.aborted) {
      status(error instanceof Error ? error.message : String(error), true);
      log('error', 'comparison stopped', { status: httpStatus(error) });
    }
  } finally {
    if (controller === active) {
      controller = null;
      toggleRunning(false);
    }
  }
}

el<HTMLFormElement>('controls').addEventListener('submit', (event) => {
  event.preventDefault();
  void run();
});
el('stop').addEventListener('click', () => {
  controller?.abort();
  status('Comparison cancelled. Completed matches remain visible.');
});
el('copy').addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(records.map(x =>
      x.timestamp + ' [' + x.area + '] ' + x.event + ' ' + JSON.stringify(x.detail)).join('\n'));
    status('Activity log copied.');
  } catch { status('Could not copy the log. Use the browser console.', true); }
});
el('clear').addEventListener('click', () => {
  records.length = 0;
  logContainer.replaceChildren();
  el('log-count').textContent = '0 events';
});

async function initialize() {
  toggleRunning(true);
  try {
    log('auth', 'establishing shared Lichess session');
    const token = await lichessSession.establishAuthorization();
    if (!token) return; // OAuth redirect is underway.
    const signal = new AbortController().signal;
    username = await accountName(log, signal);
    el('identity').textContent = 'Signed in: ' + username;
    status('Signed in as ' + username + '. Ready to compare.');
  } catch (error) {
    log('error', 'authorization failed', { reason: error instanceof Error ? error.message : String(error) });
    status('Lichess connection failed. Reload the page to retry.', true);
    el('identity').textContent = 'Not connected';
  } finally { toggleRunning(false); }
}
void initialize();
