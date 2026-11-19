import '@lichess-org/chessground/assets/chessground.base.css';
import '@lichess-org/chessground/assets/chessground.brown.css';
import '@lichess-org/chessground/assets/chessground.cburnett.css';
import './style.css';

import { Chessground } from '@lichess-org/chessground';
import { lichessSession } from '../../src/lichess-session.ts';
import { toPlayableFen } from '../../src/graph.ts';
import { buildRepertoire } from './matcher.ts';
import { frequentPositions, comparePositionStats } from './position-matcher.ts';
import { createPositionExport, serializePositionExport } from './position-export.ts';
import type { OpeningSeed, Repertoire, SharedPosition, Side } from './matcher.ts';
import type { PositionComparison } from './position-matcher.ts';
import { accountName, discoverCandidates, exportGames, httpStatus, verifyCandidatePositions } from './lichess-source.ts';
import type { DiscoveryBranch, GameResult, Log, StrongPlayer, PlayerBranchProbe } from './lichess-source.ts';

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
  '<div class="export-controls"><label>Color <select id="export-color"><option value="both">Both</option>',
  '<option value="white">White</option><option value="black">Black</option></select></label>',
  '<label>Depth <select id="export-depth"><option value="all">All</option>',
  '<option value="6">W6/B5</option><option value="8" selected>W8/B7</option>',
  '<option value="10">W10/B9</option><option value="12">W12/B11</option>',
  '<option value="14">W14/B13</option><option value="16">W16/B15</option></select></label>',
  '<label>Min games <select id="export-min"><option value="2">2</option>',
  '<option value="3" selected>3</option><option value="5">5</option>',
  '<option value="10">10</option></select></label>',
  '<button id="export-positions" type="button" disabled>Export positions</button></div>',
  '<span id="status" role="status" aria-live="polite">Sign in with Lichess to begin.</span></div>',
  '<div class="profile-line" id="profile-line">Frequent positions at depths 8 and 10 · White and Black separately</div>',
  '<section class="content"><aside class="rankings"><div class="pane-title">MATCHES <span id="match-count">—</span></div>',
  '<div id="results"><p class="muted">Run a search to find titled players appearing in your opening branches.</p></div></aside>',
  '<main class="details"><div id="summary" class="summary"><h2>Select a match</h2>',
  '<p class="muted">Explorer verifies candidate moves at your frequent positions. No candidate games downloaded.</p></div>',
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
  match: PositionComparison;
  playerExplorer: PlayerBranchProbe[];
  elapsedMs: number;
};
type Failure = { player?: string; phase: string; status: number | null; reason: string };
type SessionReport = {
  startedAt: string;
  finishedAt: string | null;
  state: 'running' | 'complete' | 'cancelled' | 'failed';
  settings: { months: number; candidates: number; ownGameLimit: number; perDepth: number; probeLimitPerCandidate: number };
  ownExport: Omit<GameResult, 'games'> | null;
  failures: Failure[];
};
let username: string | null = null;
let controller: AbortController | null = null;
let selectedId: string | null = null;
let rows: MatchRow[] = [];
let ownProfile: Repertoire | null = null;
let ownProfileMonths: number | null = null;
let seeds: OpeningSeed[] = [];
let discoveryBranches: DiscoveryBranch[] = [];
let report: SessionReport | null = null;
let ground: ReturnType<typeof Chessground> | null = null;
let running = false;

const SIDES: Side[] = ['white', 'black'];
const nowIso = () => new Date().toISOString();
const percentage = (v: number | null) => v === null ? '—' : Math.round(v * 100) + '%';
const score = (row: MatchRow) => Math.max(row.match.bySide.white.score ?? -1, row.match.bySide.black.score ?? -1);
const sourceLabel = (p: StrongPlayer) =>
  'Discovered in ' + p.seedHits + ' position' + (p.seedHits === 1 ? '' : 's');

function status(message: string, error = false) {
  el('status').textContent = message;
  el('status').classList.toggle('bad', error);
  log(error ? 'error' : 'ui', message);
}
function runningState(value: boolean) {
  running = value;
  el<HTMLButtonElement>('start').disabled = value || !username;
  el<HTMLButtonElement>('export-positions').disabled = value || !username;
  el<HTMLButtonElement>('stop').disabled = !value;
  el<HTMLSelectElement>('months').disabled = value;
  el<HTMLSelectElement>('candidates').disabled = value;
  el<HTMLSelectElement>('export-color').disabled = value;
  el<HTMLSelectElement>('export-depth').disabled = value;
  el<HTMLSelectElement>('export-min').disabled = value;
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
  const links = [link(url.toString(), 'Open Nodus in Chessview')];
  if (/^[A-Za-z0-9]{8}$/.test(position.exampleGame)) {
    links.push(link('https://lichess.org/' + position.exampleGame, 'Example ' + player.name + ' game'));
  }
  el('board-links').replaceChildren(...links);
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
      'No fully indexed shared positions yet.', 'muted'));
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
      node('span', percentage(match.coverage) + ' checked · ' + percentage(match.overlap) + ' overlap · ' + percentage(match.agreement) + ' agreement'),
      node('small', match.checkedPositions + '/' + match.selectedPositions +
        ' indexed positions · ' + match.confirmedPositions + ' confirmed · ' +
        match.partialPositions + ' pending'));
    stats.append(block);
  }

  summary.append(stats, node('p', sourceLabel(row.player) +
    ' · Explorer-only evidence · combined score ' +
    (row.match.coverage === null ? 'unverified' : row.match.score + '%') +
    '. Scores are conservative evidence across selected positions, not a lifetime similarity estimate.', 'muted compact'));
  const positions = node('div', '', 'branch-list');
  positions.append(node('h3', 'Selected positions · 8/10 plies'));
  for (const item of row.match.positions) {
    const entry = node('div', '', 'branch-row');
    const observed = item.candidateGames === null ? '—' : String(item.candidateGames);
    const statusLabel = item.status === 'confirmed'
      ? 'Confirmed · ' + percentage(item.agreement) + ' agreement'
      : item.status === 'rare' ? 'Only ' + observed + ' indexed games'
      : item.status === 'absent' ? '0 games (fully indexed)'
      : item.status === 'not-checked' ? 'Not queried'
      : item.status === 'partial' ? 'Indexing incomplete'
      : item.status === 'timeout' ? 'Timed out' : 'Unavailable';
    entry.append(
      node('strong', (item.side === 'white' ? 'W' : 'B') + ' · ' + item.route),
      node('span', statusLabel),
      node('small', item.userGames + ' your games · ' +
        observed + ' theirs · ply ' + item.ply),
    );
    positions.append(entry);
  }
  summary.append(positions);
  renderPositions(row);
}

function createReport() {
  return {
    schemaVersion: 'repertoire-lab-5',
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
      confirmedPlayers: rows.filter(row => row.match.positions.some(p =>
        p.key === branch.key && p.side === branch.side && p.status === 'confirmed')).length,
      confirmedCandidateGames: rows.reduce((sum, row) => sum +
        (row.match.positions.find(p => p.key === branch.key &&
          p.side === branch.side && p.status === 'confirmed')?.candidateGames ?? 0), 0),
    })),
    candidates: rows.map(row => ({
      player: row.player,
      elapsedMs: row.elapsedMs,
      playerExplorer: row.playerExplorer,
      score: row.match.score,
      checkedCoverage: row.match.coverage,
      checkedOverlap: row.match.overlap,
      agreement: row.match.agreement,
      sides: row.match.bySide,
      positions: row.match.positions,
      commonPositions: row.match.shared,
      differentChoices: row.match.differences,
    })),
    events: [...events],
    note: 'One bounded export of viewer games; no candidate game exports or OAuth tokens. Includes account names, opening keys and aggregate Explorer counts. Partial indexing is not negative evidence.',
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
    settings: { months, candidates: candidatesCount, ownGameLimit: 500, perDepth: 5, probeLimitPerCandidate: 4 },
    ownExport: null, failures: [],
  };
  selectedId = null;
  rows = [];
  ownProfile = null;
  ownProfileMonths = null;
  seeds = [];
  discoveryBranches = [];
  renderRanks();
  renderDetail();
  const started = performance.now();
  try {
    status('Loading your recent games…');
    const mine = await exportGames(username, 500, months, log, active.signal);
    report.ownExport = {
      rejected: mine.rejected, received: mine.received, overflow: mine.overflow,
      bytes: mine.bytes, streamStoppedAtLimit: mine.streamStoppedAtLimit,
    };
    ownProfile = buildRepertoire(username, mine.games);
    ownProfileMonths = months;
    log('profile', 'user repertoire constructed', {
      games: ownProfile.accepted, skipped: ownProfile.skipped, skippedReasons: ownProfile.skippedReasons,
      white: ownProfile.games.white, black: ownProfile.games.black,
      whitePositions: ownProfile.positions.white.size, blackPositions: ownProfile.positions.black.size,
    });
    if (!ownProfile.accepted && mine.rejected > 0 && mine.received === 0) {
      throw new Error('Lichess returned game data, but no NDJSON records could be parsed. ' +
        'Download diagnostics and check the export parser.');
    }
    if (!ownProfile.accepted) throw new Error('No eligible rated standard games in this period.');
    seeds = frequentPositions(ownProfile);
    log('profile', 'fixed-depth positions selected', {
      seeds: seeds.map(s => ({ side: s.side, route: s.route, visits: s.visits, ply: s.ply })),
    });
    el('profile-line').textContent = ownProfile.accepted + ' games · ' +
      seeds.filter(s => s.side === 'white').length + ' White positions · ' +
      seeds.filter(s => s.side === 'black').length + ' Black positions · plies 8/10';
    if (!seeds.length) throw new Error('No frequent positions at the selected depths.');

    status('Finding titled players from your frequent positions…');
    const candidates = await discoverCandidates(username, seeds, candidatesCount, log, active.signal,
      undefined, stats => { discoveryBranches = stats; }, months);
    if (!candidates.length) {
      report.state = 'complete';
      status('No titled players in returned Explorer game references; export diagnostics.');
      return;
    }
    for (const [index, candidate] of candidates.entries()) {
      if (active.signal.aborted) break;
      status('Comparing ' + (index + 1) + '/' + candidates.length + ': ' + candidate.name);
      const candidateStarted = performance.now();
      try {
        const playerExplorer = await verifyCandidatePositions(
          candidate, seeds, months, log, active.signal);
        if (active.signal.aborted) break;
        const match = comparePositionStats(ownProfile, seeds, playerExplorer);
        log('match', 'candidate Explorer statistics scored', {
          player: candidate.name, source: candidate.source,
          seedHits: candidate.seedHits, rating: candidate.rating,
          white: match.bySide.white, black: match.bySide.black, score: match.score,
          probes: playerExplorer.map(p => ({ side: p.side, route: p.route,
            status: p.status, games: p.snapshotGames, queue: p.queuePosition })),
        });
        rows.push({
          player: candidate, match, playerExplorer,
          elapsedMs: Math.round(performance.now() - candidateStarted),
        });
        rows.sort((a, b) => score(b) - score(a) || b.player.seedHits - a.player.seedHits ||
          b.player.rating - a.player.rating);
        if (!selectedId) selectedId = rows[0].player.id;
        renderRanks();
        if (selectedId === candidate.id) renderDetail();
      } catch (error) {
        if (active.signal.aborted) break;
        captureFailure('player Explorer verification', error, candidate.name);
        if ([401, 429].includes(httpStatus(error) ?? -1)) throw error;
      }
    }
    if (active.signal.aborted) return;
    log('discovery', 'per-branch confirmed overlap', {
      branches: discoveryBranches.map(branch => ({
        side: branch.side, route: branch.route,
        discovered: branch.discoveredAccounts, titled: branch.titledAccounts,
        selected: branch.selectedAccounts,
        confirmed: rows.filter(row => row.match.positions.some(p =>
          p.key === branch.key && p.side === branch.side && p.status === 'confirmed')).length,
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

async function exportPositions() {
  if (!username || running) return;
  const active = new AbortController();
  controller = active;
  runningState(true);
  const months = Number(el<HTMLSelectElement>('months').value);
  try {
    let profile = ownProfile;
    if (!profile || ownProfileMonths !== months ||
        profile.player.toLowerCase() !== username.toLowerCase()) {
      status('Loading your games for position export…');
      const exported = await exportGames(username, 500, months, log, active.signal);
      if (active.signal.aborted) return;
      profile = buildRepertoire(username, exported.games);
      if (profile.accepted === 0) throw new Error('No eligible games to export positions from.');
      ownProfile = profile;
      ownProfileMonths = months;
    } else {
      log('profile', 'reusing loaded games for position export', {
        player: username, months, accepted: profile.accepted,
      });
    }
    if (active.signal.aborted) return;
    const rawDepth = el<HTMLSelectElement>('export-depth').value;
    const summary = createPositionExport(profile, {
      side: el<HTMLSelectElement>('export-color').value as 'both' | Side,
      depth: rawDepth === 'all' ? null : Number(rawDepth),
      minGames: Number(el<HTMLSelectElement>('export-min').value),
    }, { months, gameLimit: 500, exportedAt: nowIso() });
    const blob = new Blob([serializePositionExport(summary)],
      { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'chessview-positions-' + summary.player.toLowerCase() + '-' +
      nowIso().slice(0, 10) + '.json';
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    status('Exported ' + summary.summary.positions + ' positions from ' +
      profile.accepted + ' games. No candidate lookup was needed.');
    log('profile', 'position-frequency snapshot exported', {
      filter: summary.filter, positions: summary.summary,
      acceptedGames: profile.accepted, bytes: blob.size,
    });
  } catch (error) {
    if (!active.signal.aborted) {
      captureFailure('position export', error);
      status(error instanceof Error ? error.message : String(error), true);
    }
  } finally {
    if (controller === active) {
      controller = null;
      runningState(false);
    }
  }
}
el('export-positions').addEventListener('click', () => { void exportPositions(); });

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
