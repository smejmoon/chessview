import '@lichess-org/chessground/assets/chessground.base.css';
import '@lichess-org/chessground/assets/chessground.brown.css';
import '@lichess-org/chessground/assets/chessground.cburnett.css';
import './holes-game.css';
import { Chessground } from '@lichess-org/chessground';
import { Chess } from 'chess.js';
import type { Square } from 'chess.js';
import { findHoles, gradeHoles, trainingZone } from './holes-rules.ts';
import type { HoleMode, HoleSide } from './holes-rules.ts';
import { getRandomLichessPosition } from './holes-source.ts';
import type { TvPosition } from './holes-source.ts';

const app = document.querySelector('#app');
if (!app) throw new Error('Find the Holes requires an app element');
app.innerHTML = [
  '<main class="holes-shell"><header class="holes-topbar">',
  '<a id="home-link" class="holes-brand"><b>♞</b> Chessview</a>',
  '<span>FIND THE HOLES</span><a id="map-link">← Constellation</a></header>',
  '<div class="holes-workspace"><section class="holes-stage">',
  '<div class="holes-kicker">SQUARE AWARENESS <span id="round-label">ROUND 1</span></div>',
  '<h1>Find the holes<span>.</span></h1>',
  '<p class="holes-lede">Real positions from Lichess. Spot the vulnerable squares before revealing them.</p>',
  '<div class="holes-board" id="board"><div id="ground" class="holes-ground"></div>',
  '<div id="grid" class="holes-grid" role="group" aria-label="Chessboard square markers"></div>',
  '<div id="board-loading" class="holes-loading">Finding a Lichess position…</div></div>',
  '<div class="holes-source"><span id="details">Lichess TV</span>',
  '<a id="game-link" target="_blank" rel="noopener noreferrer" hidden>Original game ↗</a></div>',
  '</section><aside class="holes-panel"><div class="holes-step">01 / THE CHALLENGE</div>',
  '<label>Find holes for<select id="side"><option value="w">White</option><option value="b">Black</option></select></label>',
  '<label>Challenge<select id="mode"><option value="undefended">Undefended squares</option><option value="pawn-holes">Pawn holes</option></select></label>',
  '<p id="definition" class="holes-definition"></p><p id="zone" class="holes-zone"></p>',
  '<div class="holes-hint">◎ Click an empty square to mark it. Click again to unmark.</div>',
  '<div class="holes-step">02 / YOUR ANSWER</div>',
  '<div class="holes-count"><strong id="count">0</strong> squares marked</div>',
  '<div class="holes-actions"><button id="reveal" class="holes-reveal" disabled>Reveal answers</button>',
  '<button id="next" disabled>Next position →</button></div>',
  '<p id="feedback" class="holes-feedback" role="status" aria-live="polite">Choose squares, then reveal the answers.</p>',
  '<div class="holes-legend"><span>● Found</span><span>● Missed</span><span>● Extra mark</span></div>',
  '<small id="completed">0 rounds completed</small>',
  '</aside></div></main>',
].join('');

function element<T extends HTMLElement>(id: string): T {
  const node = app!.querySelector('#' + id);
  if (!node) throw new Error('Missing game element: ' + id);
  return node as T;
}
element<HTMLAnchorElement>('home-link').href = import.meta.env.BASE_URL;
element<HTMLAnchorElement>('map-link').href = import.meta.env.BASE_URL;
const ground = element<HTMLElement>('ground');
const grid = element<HTMLElement>('grid');
const overlay = element<HTMLElement>('board-loading');
const sideInput = element<HTMLSelectElement>('side');
const modeInput = element<HTMLSelectElement>('mode');
const revealButton = element<HTMLButtonElement>('reveal');
const nextButton = element<HTMLButtonElement>('next');
const countEl = element<HTMLElement>('count');
const feedback = element<HTMLElement>('feedback');
const definition = element<HTMLElement>('definition');
const zoneLabel = element<HTMLElement>('zone');
let board: ReturnType<typeof Chessground> | null = null;
let position: TvPosition | null = null;
let side: HoleSide = 'w';
let mode: HoleMode = 'undefended';
let marks = new Set<string>();
let revealed = false;
let loading = false;
let completed = 0;

function instructions() {
  const defender = side === 'w' ? 'White' : 'Black';
  const attacker = side === 'w' ? 'Black' : 'White';
  definition.textContent = mode === 'undefended'
    ? 'Find empty squares attacked by ' + attacker + ' but not defended by any ' + defender + ' piece.'
    : 'Find empty squares that no remaining ' + defender + ' pawn can guard, even after advancing on its file. A pawn weakness, not an engine verdict.';
  zoneLabel.textContent = 'Search only empty squares on files b–g and ranks ' + (side === 'w' ? '3–5' : '4–6') + '.';
}

function refresh() {
  const answers = position && revealed ? findHoles(position.fen, side, mode) : new Set<string>();
  grid.querySelectorAll<HTMLButtonElement>('button[data-square]').forEach((cell) => {
    const square = cell.dataset.square || '';
    cell.classList.toggle('selected', !revealed && marks.has(square));
    cell.classList.toggle('found', revealed && marks.has(square) && answers.has(square as Square));
    cell.classList.toggle('missed', revealed && !marks.has(square) && answers.has(square as Square));
    cell.classList.toggle('wrong', revealed && marks.has(square) && !answers.has(square as Square));
    cell.disabled = revealed || loading || !cell.classList.contains('eligible');
    cell.setAttribute('aria-pressed', String(marks.has(square)));
  });
  countEl.textContent = String(marks.size);
  revealButton.disabled = !position || loading || revealed;
}

function drawGrid() {
  grid.replaceChildren();
  if (!position) return;
  const chess = new Chess(position.fen);
  const zone = new Set(trainingZone(side));
  const files = side === 'w' ? 'abcdefgh' : 'hgfedcba';
  const ranks = side === 'w' ? [8,7,6,5,4,3,2,1] : [1,2,3,4,5,6,7,8];
  for (const rank of ranks) for (const file of files) {
    const square = (file + rank) as Square;
    const cell = document.createElement('button');
    cell.type = 'button';
    cell.dataset.square = square;
    cell.className = 'holes-cell';
    const eligible = zone.has(square) && !chess.get(square);
    if (eligible) cell.classList.add('eligible');
    cell.setAttribute('aria-label', 'Mark ' + square);
    if (eligible) cell.addEventListener('click', () => {
      if (revealed || loading) return;
      if (marks.has(square)) marks.delete(square); else marks.add(square);
      refresh();
    });
    grid.append(cell);
  }
  refresh();
}

function resetChallenge() {
  marks = new Set();
  revealed = false;
  instructions();
  board?.set({ orientation: side === 'w' ? 'white' : 'black' });
  feedback.textContent = 'Mark every square you find, then reveal the answers.';
  revealButton.textContent = 'Reveal answers';
  drawGrid();
}

async function nextPosition() {
  if (loading) return;
  loading = true;
  nextButton.disabled = true;
  nextButton.textContent = 'Loading…';
  overlay.hidden = false;
  overlay.textContent = 'Finding a Lichess position…';
  refresh();
  try {
    const next = await getRandomLichessPosition();
    board?.destroy();
    position = next;
    board = Chessground(ground, {
      fen: next.fen, orientation: side === 'w' ? 'white' : 'black',
      viewOnly: true, animation: { enabled: false }, drawable: { enabled: false },
    });
    element<HTMLElement>('details').textContent = next.white + ' vs ' + next.black + ' · ply ' + next.ply;
    const link = element<HTMLAnchorElement>('game-link');
    link.href = 'https://lichess.org/' + next.gameId;
    link.hidden = false;
    overlay.hidden = true;
    element<HTMLElement>('round-label').textContent = 'ROUND ' + (completed + 1);
    resetChallenge();
  } catch (error) {
    overlay.hidden = Boolean(position);
    overlay.textContent = 'Could not load Lichess.';
    feedback.textContent = 'Lichess could not provide a position: ' +
      (error instanceof Error ? error.message : 'request failed') + '. Try again.';
  } finally {
    loading = false;
    nextButton.disabled = false;
    nextButton.textContent = position ? 'Next position →' : 'Try again →';
    refresh();
  }
}

revealButton.addEventListener('click', () => {
  if (!position || loading || revealed) return;
  revealed = true;
  const result = gradeHoles(marks, findHoles(position.fen, side, mode));
  feedback.textContent = 'Found ' + result.correct.length + ' · Missed ' + result.missed.length +
    ' · Extra marks ' + result.incorrect.length + '. Green: found; amber: missed; red: extra.';
  completed += 1;
  element<HTMLElement>('completed').textContent = completed + (completed === 1 ? ' round completed' : ' rounds completed');
  revealButton.textContent = 'Answers revealed';
  refresh();
});
sideInput.addEventListener('change', () => { side = sideInput.value as HoleSide; resetChallenge(); });
modeInput.addEventListener('change', () => { mode = modeInput.value as HoleMode; resetChallenge(); });
nextButton.addEventListener('click', () => { void nextPosition(); });
instructions();
void nextPosition();
