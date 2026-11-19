import '@lichess-org/chessground/assets/chessground.base.css';
import '@lichess-org/chessground/assets/chessground.brown.css';
import '@lichess-org/chessground/assets/chessground.cburnett.css';
import './style.css';

import { Chessground } from '@lichess-org/chessground';
import { lichessSession } from '../../src/lichess-session.ts';
import { toPlayableFen } from '../../src/graph.ts';
import { buildRepertoire, compareBranchRepertoires, openingSeeds } from './matcher.ts';
import type { OpeningSeed, Repertoire, BranchComparison, SharedPosition, Side } from './matcher.ts';
import { accountName, discoverCandidates, exportGames, httpStatus } from './lichess-source.ts';
import type { DiscoveryBranch, GameResult, Log, StrongPlayer } from './lichess-source.ts';

const app = document.querySelector<HTMLElement>('#app');
if (!app) throw new Error('Repertoire Lab requires #app');
app.innerHTML = [
  '<div class="lab"><header class="top"><a id="home" class="brand">♞ Chessview</a>',
  '<span class="app-title">Repertoire Lab <small>EXPERIMENT</small></span><span id="identity">Connecting…</span></header>',
  '<div class="toolbar"><form id="controls"><label>History <select id="months">',
  '<option value="6">6 months</option><option value="12" selected>12 months</option><option value="24">24 months</option>',
  '</select></label><label>Compare <select id="candidates"><option value="8">8 players</option>',
  '<option value="12" selected>12 players</option><option value="20">20 players</option></select></label>',
  '<button id="start" type="submit" class="primary">Find matches</button><button id="stop" type="button" disabled>Cancel</button></form>',
  '<span id="status" role="status" aria-live="polite">Sign in with Lichess to begin.</span></div>',
  '<div class="profile-line" id="profile-line">Opening-first discovery · White and Black analyzed separately</div>',
  '<section class="content"><aside class="rankings"><div class="pane-title">MATCHES <span id="match-count">—</span></div>',
  '<div id="results"><p class="muted">Run a search to find titled players appearing in your opening branches.</p></div></aside>',
  '<main class="details"><div id="summary" class="summary"><h2>Select a match</h2>',
  '<p class="muted">The experiment compares sampled game positions and actual move choices.</p></div>',
  '<div class="detail-tools"><label for="view">Inspect</label><select id="view"><option value="differences">Different choices</option>',
  '<option value="shared">Common positions</option></select><span id="position-count" class="muted"></span></div>',
  '<div class="workspace"><div id="positions" class="positions"></div>',
  '<aside id="board-panel" class="board-panel" hidden><div id="board-title" class="board-title"></div>',
  '<div id="board" class="board"></div><div id="board-links" class="board-links"></div></aside></div>',
  '</main></section>',
  '<details id="diagnostics" class="diagnostics"><summary><b>Diagnostics</b><span id="log-count">0 events</span>',
  '<span class="hint">Export report to share after testing</span></summary>',
  '<div class="log-tools"><span>Contains opening positions and account names, but no tokens or complete game text.</span>',
  '<button id="copy-report" type="button">Copy report</button><button id="download-report" type="button">Download JSON</button>',
  '<button id="copy-log" type="button">Copy log</button><button id="clear" type="button">Clear visible log</button></div>',
  '<div id="events" role="log" class="events"></div></details></div>',
].join('');

function el<T extends HTMLElement = HTMLElement>(id: string): T {
  const found = app!.querySelector<T>('#' + id);
  if (!found) throw new Error('Missing prototype element: ' + id);
  return found;
}
el<HTMLAnchorElement>('home').href = import.meta.env.BASE_URL;
const eventsNode = el('events');
type Event = { timestamp: string; area: string; event: string; detail: Record<string, unknown> };
const events: Event[] = [];
const log: Log = (area, event, detail = {}) => {
  const record: Event = { timestamp: new Date().toISOString(), area, event, detail };
  events.push(record);
  if (events.length > 700) events.shift();
  const line = document.createElement('div');
  line.className = 'event' + (area === 'error' ? ' error' : '');
  const time = document.createElement('time');
  time.textContent = record.timestamp.slice(11, 23);
  const kind = document.createElement('span');
  kind.textContent = area.toUpperCase();
  const message = document.createElement('span');
  message.textContent = event + (Object.keys(detail).length ? ' · ' + JSON.stringify(detail) : '');
  line.append(time, kind, message);
  eventsNode.append(line);
  while (eventsNode.children.length > 160) eventsNode.firstElementChild?.remove();
  eventsNode.scrollTop = eventsNode.scrollHeight;
  el('log-count').textContent = events.length + ' events';
  (area === 'error' ? console.error : console.info)('[Chessview Repertoire Lab]', area, event, detail);
};

type MatchRow = {
  player: StrongPlayer;
  match: BranchComparison;
  repertoire: Repertoire;
  exportMeta: Omit<GameResult, 'games'>;
  elapsedMs: number;
};
type Failure = { player?: string; phase: string; status: number | null; reason: string };
type SessionReport = {
  startedAt: string;
  finishedAt: string | null;
  state: 'running' | 'complete' | 'cancelled' | 'failed';
  settings: { months: number; candidates: number; ownGameLimit: number; candidateGameLimit: number };
  ownExport: Omit<GameResult, 'games'> | null;
  failures: Failure[];
};
let username: string | null = null;
let controller: AbortController | null = null;
let selectedId: string | null = null;
let rows: MatchRow[] = [];
let ownProfile: Repertoire | null = null;
let seeds: OpeningSeed[] = [];
let discoveryBranches: DiscoveryBranch[] = [];
let report: SessionReport | null = null;
let ground: ReturnType<typeof Chessground> | null = null;
let running = false;

const SIDES: Side[] = ['white', 'black'];
const nowIso = () => new Date().toISOString();
const percentage = (v: number | null) => v === null ? '—' : Math.round(v * 100) + '%';
const score = (row: MatchRow) => Math.max(row.match.bySide.white.score ?? -1, row.match.bySide.black.score ?? -1);
const sourceLabel = (p: StrongPlayer) => p.source === 'opening-explorer' ?
  'Opening ' + p.seedHits + ' branch' + (p.seedHits === 1 ? '' : 'es') : 'Leaderboard fallback';

function status(message: string, error = false) {
  el('status').textContent = message;
  el('status').classList.toggle('bad', error);
  log(error ? 'error' : 'ui', message);
}
function runningState(value: boolean) {
  running = value;
  el<HTMLButtonElement>('start').disabled = value || !username;
  el<HTMLButtonElement>('stop').disabled = !value;
  el<HTMLSelectElement>('months').disabled = value;
  el<HTMLSelectElement>('candidates').disabled = value;
}
function node(tag: string, content: string, cls = ''): HTMLElement {
  const item = document.createElement(tag);
  item.textContent = content;
  item.className = cls;
  return item;
}
function link(url: string, label: string) {
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.textContent = label;
  anchor.target = '_blank';
  anchor.rel = 'noopener noreferrer';
  return anchor;
}
function clearBoard() {
  ground?.destroy();
  ground = null;
  el('board').replaceChildren();
  el('board-panel').hidden = true;
}
function renderRanks() {
  const results = el('results');
  results.replaceChildren();
  el('match-count').textContent = String(rows.length);
  if (!rows.length) results.append(node('p', 'No scored candidates yet.', 'muted'));
  rows.forEach(row => {
    const button = node('button', '', 'result' + (selectedId === row.player.id ? ' active' : '')) as HTMLButtonElement;
    button.type = 'button';
    const top = node('div', '', 'result-main');
    top.append(node('strong', row.player.title + ' ' + row.player.name),
      node('span', score(row) < 0 ? 'Unconfirmed' : score(row) + '% best side', 'result-score'));
    const more = node('div', '', 'result-meta');
    more.append(node('span', 'W ' + (row.match.bySide.white.score === null ? '—' : row.match.bySide.white.score + '%') + '  ·  B ' +
      (row.match.bySide.black.score === null ? '—' : row.match.bySide.black.score + '%')),
      node('small', sourceLabel(row.player)));
    button.append(top, more);
    button.addEventListener('click', () => {
      selectedId = row.player.id;
      renderRanks();
      renderDetail();
      log('ui', 'candidate selected', { player: row.player.name });
    });
    results.append(button);
  });
}
function inspectPosition(position: SharedPosition, player: StrongPlayer) {
  clearBoard();
  el('board-panel').hidden = false;
  el('board-title').textContent = (position.side === 'white' ? 'White' : 'Black') +
    ' · ' + (position.route || 'starting position');
  const boardHost = el('board');
  ground = Chessground(boardHost, {
    fen: toPlayableFen(position.key), orientation: position.side,
    viewOnly: true, animation: { enabled: false }, drawable: { enabled: false },
  });
  const url = new URL(import.meta.env.BASE_URL, window.location.href);
  url.searchParams.set('fen', position.key);
  el('board-links').replaceChildren(
    link(url.toString(), 'Open Nodus in Chessview'),
    link('https://lichess.org/' + position.exampleGame, 'Example ' + player.name + ' game'),
  );
  log('ui', 'opening position inspected', {
    player: player.name, side: position.side, route: position.route, userMove: position.userMove,
    candidateMove: position.candidateMove,
  });
}
function renderPositions(row: MatchRow) {
  const container = el('positions');
  container.replaceChildren();
  clearBoard();
  const isDifference = el<HTMLSelectElement>('view').value === 'differences';
  const set = isDifference ? row.match.differences : row.match.shared;
  el('position-count').textContent = set.length + ' positions';
  if (!set.length) {
    container.append(node('p', isDifference ? 'No different choices in the overlapping sample.' :
      'No common positions in the sampled openings.', 'muted'));
    return;
  }
  for (const p of set) {
    const button = node('button', '', 'position') as HTMLButtonElement;
    const main = node('div', '', 'position-main');
    main.append(node('strong', p.side === 'white' ? 'W' : 'B', 'side'),
      node('span', p.route || 'Starting position', 'route'));
    const choices = node('div', '', 'choices');
    choices.append(node('span', 'You: ' + p.userMove + ' (' + percentage(p.userShare) + ')'),
      node('span', row.player.name + ': ' + p.candidateMove + ' (' + percentage(p.candidateShare) + ')'));
    const meta = node('div', p.visits + ' your games · ' + p.candidateVisits +
      ' theirs · ' + percentage(p.agreement) + ' move agreement', 'position-meta');
    button.append(main, choices, meta);
    button.addEventListener('click', () => inspectPosition(p, row.player));
    container.append(button);
  }
}
function renderDetail() {
  const summary = el('summary');
  summary.replaceChildren();
  const row = rows.find(r => r.player.id === selectedId);
  if (!row) {
    summary.append(node('h2', 'Repertoire comparison'),
      node('p', ownProfile ?
        ownProfile.accepted + ' your games analyzed; comparing titled players…' :
        'Run a search to see shared openings and different choices.', 'muted'));
    el('positions').replaceChildren();
    el('position-count').textContent = '';
    clearBoard();
    return;
  }
  const heading = node('div', '', 'summary-heading');
  heading.append(node('h2', row.player.title + ' ' + row.player.name),
    link('https://lichess.org/@/' + encodeURIComponent(row.player.name), 'Player profile'));
  summary.append(heading);
  const stats = node('div', '', 'stats');
  for (const side of SIDES) {
    const match = row.match.bySide[side];
    const block = node('div', '', 'stat');
    block.append(node('span', side === 'white' ? 'AS WHITE' : 'AS BLACK', 'stat-label'),
      node('strong', match.score === null ? '—' : match.score + '%', 'stat-value'),
      node('span', percentage(match.coverage) + ' coverage · ' + percentage(match.agreement) + ' agreement'),
      node('small', match.userGames + ' your games / ' + match.candidateGames + ' theirs'));
    stats.append(block);
  }
  summary.append(stats, node('p', sourceLabel(row.player) + ' · ' + row.repertoire.accepted +
    ' analyzed games (' + row.repertoire.skipped + ' excluded) · combined score ' +
    (row.match.coverage === null ? 'unconfirmed' : row.match.score + '%') +
    '. Scores require at least three games per opening branch.', 'muted compact'));
  const branches = node('div', '', 'branch-list');
  branches.append(node('h3', 'Opening branches'));
  for (const branch of row.match.branches) {
    const item = node('div', '', 'branch-row');
    const name = node('strong', (branch.side === 'white' ? 'W' : 'B') + ' · ' + branch.route);
    const evidence = branch.evidence === 'confirmed'
      ? percentage(branch.coverage) + ' coverage · ' + percentage(branch.agreement) + ' agreement'
      : branch.evidence === 'sparse' ? 'Sparse sample' : 'Not observed';
    item.append(name, node('span', evidence),
      node('small', branch.userGames + ' your games · ' + branch.candidateGames +
        ' theirs · ' + branch.supportedPositions + '/' + branch.userPositions + ' supported positions'));
    branches.append(item);
  }
  summary.append(branches);
  renderPositions(row);
}

function createReport() {
  return {
    schemaVersion: 'repertoire-lab-3',
    exportedAt: nowIso(),
    app: 'Chessview / Repertoire Lab',
    viewer: username,
    session: report,
    own: ownProfile ? {
      accepted: ownProfile.accepted, skipped: ownProfile.skipped,
      skippedReasons: ownProfile.skippedReasons,
      games: ownProfile.games,
      positions: {
        white: ownProfile.positions.white.size,
        black: ownProfile.positions.black.size,
      },
    } : null,
    openingSeeds: seeds,
    discoveryBranches: discoveryBranches.map(branch => ({
      ...branch,
      confirmedPlayers: rows.filter(row => row.match.branches.some(b =>
        b.key === branch.key && b.evidence === 'confirmed')).length,
      confirmedCandidateGames: rows.reduce((sum, row) => sum +
        (row.match.branches.find(b => b.key === branch.key)?.candidateGames ?? 0), 0),
    })),
    candidates: rows.map(row => ({
      player: row.player,
      sample: {
        accepted: row.repertoire.accepted,
        skipped: row.repertoire.skipped,
        skippedReasons: row.repertoire.skippedReasons,
        games: row.repertoire.games,
        export: row.exportMeta,
        elapsedMs: row.elapsedMs,
      },
      score: row.match.score, coverage: row.match.coverage, agreement: row.match.agreement,
      sides: row.match.bySide,
      branches: row.match.branches,
      commonPositions: row.match.shared,
      differentChoices: row.match.differences,
    })),
    events: [...events],
    note: 'No OAuth tokens or full game move lists; includes account names and opening positions. Review before sharing.',
  };
}
function reportJson() {
  return JSON.stringify(createReport(), null, 2);
}
function captureFailure(phase: string, error: unknown, player?: string) {
  const failure = {
    phase, player, status: httpStatus(error),
    reason: error instanceof Error ? error.message : String(error),
  };
  report?.failures.push(failure);
  log('error', 'operation failed', failure);
}
async function run() {
  if (!username || running) return;
  controller?.abort();
  const active = new AbortController();
  controller = active;
  runningState(true);
  const months = Number(el<HTMLSelectElement>('months').value);
  const candidatesCount = Number(el<HTMLSelectElement>('candidates').value);
  report = {
    startedAt: nowIso(), finishedAt: null, state: 'running',
    settings: { months, candidates: candidatesCount, ownGameLimit: 500, candidateGameLimit: 140 },
    ownExport: null, failures: [],
  };
  selectedId = null;
  rows = [];
  ownProfile = null;
  seeds = [];
  discoveryBranches = [];
  renderRanks();
  renderDetail();
  const started = performance.now();
  try {
    status('Loading your recent games…');
    const mine = await exportGames(username, 500, months, log, active.signal);
    report.ownExport = {
      rejected: mine.rejected, received: mine.received, overflow: mine.overflow, bytes: mine.bytes,
    };
    ownProfile = buildRepertoire(username, mine.games);
    log('profile', 'user repertoire constructed', {
      games: ownProfile.accepted, skipped: ownProfile.skipped, skippedReasons: ownProfile.skippedReasons,
      white: ownProfile.games.white, black: ownProfile.games.black,
      whitePositions: ownProfile.positions.white.size, blackPositions: ownProfile.positions.black.size,
    });
    if (!ownProfile.accepted) throw new Error('No eligible rated standard games in this period.');
    seeds = openingSeeds(ownProfile);
    log('profile', 'opening branches selected', {
      seeds: seeds.map(s => ({ side: s.side, route: s.route, visits: s.visits, ply: s.ply })),
    });
    el('profile-line').textContent = ownProfile.accepted + ' games · ' +
      seeds.filter(s => s.side === 'white').length + ' White branches · ' +
      seeds.filter(s => s.side === 'black').length + ' Black branches';
    status('Finding titled players in your opening branches…');
    const candidates = await discoverCandidates(username, seeds, candidatesCount, log, active.signal,
      undefined, stats => { discoveryBranches = stats; });
    if (!candidates.length) throw new Error('No suitable titled-player candidates found.');
    for (const [index, candidate] of candidates.entries()) {
      if (active.signal.aborted) break;
      status('Comparing ' + (index + 1) + '/' + candidates.length + ': ' + candidate.name);
      const candidateStarted = performance.now();
      try {
        const exported = await exportGames(candidate.name, 140, months, log, active.signal);
        const repertoire = buildRepertoire(candidate.name, exported.games);
        const match = compareBranchRepertoires(ownProfile, repertoire, seeds);
        log('match', 'candidate scored', {
          player: candidate.name, source: candidate.source, seeds: candidate.seedHits,
          bestWhite: match.bySide.white.score, bestBlack: match.bySide.black.score,
          score: match.score, coverage: percentage(match.coverage), agreement: percentage(match.agreement),
          games: repertoire.accepted, skippedReasons: repertoire.skippedReasons,
          sharedWhite: match.bySide.white.sharedPositions,
          sharedBlack: match.bySide.black.sharedPositions,
          branchEvidence: match.branches.map(b => ({ side: b.side, route: b.route,
            userGames: b.userGames, candidateGames: b.candidateGames,
            supportedPositions: b.supportedPositions, evidence: b.evidence })),
        });
        if (repertoire.accepted) {
          rows.push({
            player: candidate, match, repertoire,
            exportMeta: {
              rejected: exported.rejected, received: exported.received,
              overflow: exported.overflow, bytes: exported.bytes,
            },
            elapsedMs: Math.round(performance.now() - candidateStarted),
          });
          rows.sort((a, b) => score(b) - score(a) || b.match.score - a.match.score);
          if (!selectedId) selectedId = rows[0].player.id;
          renderRanks();
          if (selectedId === candidate.id) renderDetail();
        }
      } catch (error) {
        if (active.signal.aborted) break;
        captureFailure('candidate export', error, candidate.name);
        if ([401, 429].includes(httpStatus(error) ?? -1)) throw error;
      }
    }
    if (active.signal.aborted) return;
    log('discovery', 'per-branch confirmed overlap', {
      branches: discoveryBranches.map(branch => ({
        side: branch.side, route: branch.route,
        discovered: branch.discoveredAccounts, titled: branch.titledAccounts,
        selected: branch.selectedAccounts,
        confirmed: rows.filter(row => row.match.branches.some(b =>
          b.key === branch.key && b.evidence === 'confirmed')).length,
      })),
    });
    report.state = 'complete';
    status('Finished: ' + rows.length + ' players · ' +
      Math.round((performance.now() - started) / 1000) + 's. Export diagnostics after reviewing.');
    log('summary', 'run completed', {
      ranked: rows.length, elapsedMs: Math.round(performance.now() - started),
      top: rows.slice(0, 8).map(row => ({
        player: row.player.name, source: row.player.source,
        white: row.match.bySide.white.score, black: row.match.bySide.black.score,
        combined: row.match.score,
      })),
    });
  } catch (error) {
    if (!active.signal.aborted) {
      report.state = 'failed';
      captureFailure('run', error);
      status(error instanceof Error ? error.message : String(error), true);
    }
  } finally {
    if (active.signal.aborted) report.state = 'cancelled';
    report.finishedAt = nowIso();
    if (controller === active) {
      controller = null;
      runningState(false);
    }
  }
}

el<HTMLFormElement>('controls').addEventListener('submit', event => {
  event.preventDefault();
  void run();
});
el('stop').addEventListener('click', () => {
  controller?.abort();
  status('Cancelled; available matches and the report are retained.');
});
el<HTMLSelectElement>('view').addEventListener('change', () => {
  const row = rows.find(r => r.player.id === selectedId);
  if (row) renderPositions(row);
});
el('copy-report').addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(reportJson());
    status('Diagnostic report copied. Paste it into the next ChessView chat.');
  } catch { status('Clipboard unavailable; use Download JSON instead.', true); }
});
el('download-report').addEventListener('click', () => {
  const payload = new Blob([reportJson()], { type: 'application/json' });
  const url = URL.createObjectURL(payload);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = 'chessview-repertoire-report-' + nowIso().slice(0, 10) + '.json';
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  log('ui', 'diagnostic report downloaded', { bytes: payload.size });
});
el('copy-log').addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(events.map(e =>
      e.timestamp + ' [' + e.area + '] ' + e.event + ' ' + JSON.stringify(e.detail)).join('\n'));
    status('Activity log copied.');
  } catch { status('Clipboard unavailable; download the report instead.', true); }
});
el('clear').addEventListener('click', () => {
  eventsNode.replaceChildren();
  log('ui', 'visible activity log cleared (report history retained)');
});

async function initialize() {
  runningState(true);
  try {
    log('auth', 'establishing shared Lichess session');
    const token = await lichessSession.establishAuthorization();
    if (!token) return;
    username = await accountName(log, new AbortController().signal);
    el('identity').textContent = 'Signed in: ' + username;
    status('Ready. Choose a sample and find matches.');
  } catch (error) {
    captureFailure('authorization', error);
    el('identity').textContent = 'Not connected';
    status('Lichess connection failed. Reload to retry.', true);
  } finally {
    runningState(false);
  }
}
void initialize();
