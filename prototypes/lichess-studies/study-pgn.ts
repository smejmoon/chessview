import { Chess } from 'chess.js';
import { canonicalPosition, START_FEN } from '../../src/graph.ts';

export type StudyNode = {
  id: string;
  fen: string;
  key: string;
  ply: number;
  san: string;
  parent: StudyNode | null;
  children: StudyNode[];
  comments: string[];
  nags: string[];
};

export type StudyChapter = {
  id: string;
  name: string;
  url: string;
  orientation: 'white' | 'black';
  root: StudyNode;
  nodeCount: number;
};

export type ParsedStudy = {
  id: string;
  name: string;
  chapters: StudyChapter[];
  occurrences: number;
  positions: number;
  repeatedPositions: number;
  skipped: string[];
};

type Game = { headers: Record<string, string>; moves: string };
type Token = { type: 'word' | 'comment' | 'open' | 'close'; value: string };

const MAX_PGN_CHARACTERS = 2_000_000;
const MAX_CHAPTERS = 200;
const MAX_NODES = 20_000;
const MAX_VARIATION_DEPTH = 80;

export function studyIdFromInput(value: string): { studyId: string; chapterId?: string } {
  const input = value.trim();
  if (/^[a-zA-Z0-9]{8}$/.test(input)) return { studyId: input };
  let url: URL;
  try { url = new URL(input); } catch { throw new Error('Enter a Lichess study URL or its 8-character ID.'); }
  if (url.hostname !== 'lichess.org' && url.hostname !== 'www.lichess.org') {
    throw new Error('Only lichess.org study links are supported.');
  }
  const path = url.pathname.split('/').filter(Boolean);
  const parts = path[0] === 'api' ? path.slice(1) : path;
  if (parts[0] !== 'study' || !/^[a-zA-Z0-9]{8}(?:\.pgn)?$/.test(parts[1] || '')) {
    throw new Error('Expected a Lichess link like https://lichess.org/study/abcdefgh.');
  }
  const studyId = parts[1].replace(/\.pgn$/, '');
  const chapterId = /^[a-zA-Z0-9]{8}$/.test(parts[2] || '') ? parts[2] : undefined;
  return { studyId, ...(chapterId ? { chapterId } : {}) };
}

function splitGames(text: string): Game[] {
  const games: Game[] = [];
  let headers: Record<string, string> = {};
  let moves: string[] = [];
  let headerBoundary = false;
  function flush() {
    if (Object.keys(headers).length) games.push({ headers, moves: moves.join('\n') });
    headers = {};
    moves = [];
    headerBoundary = false;
  }
  for (const line of text.replace(/\r\n?/g, '\n').split('\n')) {
    const match = line.match(/^\[([A-Za-z][A-Za-z0-9_]*)\s+"((?:\\.|[^"\\])*)"\]\s*$/);
    if (match) {
      if (moves.some((entry) => entry.trim()) || (headerBoundary && Object.keys(headers).length)) flush();
      headers[match[1]] = match[2].replace(/\\"/g, '"').replace(/\\\\/g, '\\');
      headerBoundary = false;
    } else if (!line.trim() && Object.keys(headers).length && !moves.length) {
      headerBoundary = true;
    } else if (line.trim() || moves.length) {
      moves.push(line);
    }
  }
  flush();
  return games;
}

function tokensOf(text: string): Token[] {
  const result: Token[] = [];
  let i = 0;
  while (i < text.length) {
    const char = text[i];
    if (/\s/.test(char)) { i += 1; continue; }
    if (char === '{') {
      const end = text.indexOf('}', i + 1);
      if (end < 0) throw new Error('Unclosed PGN comment');
      result.push({ type: 'comment', value: text.slice(i + 1, end).trim() });
      i = end + 1;
      continue;
    }
    if (char === ';') {
      const end = text.indexOf('\n', i + 1);
      result.push({ type: 'comment', value: text.slice(i + 1, end < 0 ? text.length : end).trim() });
      i = end < 0 ? text.length : end + 1;
      continue;
    }
    if (char === '(' || char === ')') {
      result.push({ type: char === '(' ? 'open' : 'close', value: char });
      i += 1;
      continue;
    }
    let end = i + 1;
    while (end < text.length && !/[\s{}();]/.test(text[end])) end += 1;
    result.push({ type: 'word', value: text.slice(i, end) });
    i = end;
  }
  return result;
}

function startingPly(fen: string): number {
  const words = fen.split(' ');
  const fullmove = Number(words[5] || 1);
  return Math.max(0, (fullmove - 1) * 2 + (words[1] === 'b' ? 1 : 0));
}

function chapterFrom(game: Game, studyId: string, index: number): StudyChapter {
  const variant = (game.headers.Variant || 'Standard').toLowerCase();
  if (variant !== 'standard' && variant !== 'from position') {
    throw new Error('Unsupported chess variant: ' + variant);
  }
  const start = new Chess(game.headers.FEN || START_FEN);
  const startFen = start.fen();
  const root: StudyNode = {
    id: index + ':0', fen: startFen, key: canonicalPosition(startFen),
    ply: startingPly(startFen), san: '', parent: null, children: [], comments: [], nags: [],
  };
  const stack: Array<{ at: StudyNode; last: StudyNode | null }> = [];
  let at = root;
  let last: StudyNode | null = null;
  let count = 1;
  for (const token of tokensOf(game.moves)) {
    if (token.type === 'open') {
      if (stack.length >= MAX_VARIATION_DEPTH) throw new Error('PGN variations are too deeply nested');
      stack.push({ at, last });
      at = last?.parent || at;
      last = null;
      continue;
    }
    if (token.type === 'close') {
      const previous = stack.pop();
      if (!previous) throw new Error('Unmatched closing variation');
      at = previous.at;
      last = previous.last;
      continue;
    }
    if (token.type === 'comment') {
      const comment = token.value.replace(/\[%[a-zA-Z]+\s+[^\]]*\]/g, '').trim();
      if (comment) (last || at).comments.push(comment);
      continue;
    }
    let word = token.value;
    if (/^\$\d+$/.test(word)) { if (last) last.nags.push(word); continue; }
    word = word.replace(/^\d+\.(?:\.\.)?/, '');
    if (!word || /^\.+$/.test(word) || /^(1-0|0-1|1\/2-1\/2|\*|e\.p\.)$/.test(word)) continue;
    const suffix = word.match(/([!?]+)$/);
    if (suffix) word = word.slice(0, -suffix[1].length);
    if (!word) continue;
    const chess = new Chess(at.fen);
    let played;
    try { played = chess.move(word); }
    catch { throw new Error('Illegal or unsupported move at ply ' + (at.ply + 1) + ': ' + word); }
    if (!played) throw new Error('Invalid move at ply ' + (at.ply + 1) + ': ' + word);
    const fen = chess.fen();
    const key = canonicalPosition(fen);
    let node = at.children.find((child) => child.san === played.san && child.key === key);
    if (!node) {
      count += 1;
      if (count > MAX_NODES) throw new Error('Study exceeds the move limit');
      node = {
        id: index + ':' + (count - 1), fen, key, ply: at.ply + 1,
        san: played.san, parent: at, children: [], comments: [], nags: [],
      };
      at.children.push(node);
    }
    if (suffix) node.nags.push(suffix[1]);
    at = node;
    last = node;
  }
  if (stack.length) throw new Error('Unclosed PGN variation');
  const chapterUrl = game.headers.ChapterURL || '';
  const chapterMatch = chapterUrl.match(/\/study\/[a-zA-Z0-9]{8}\/([a-zA-Z0-9]{8})/);
  return {
    id: chapterMatch?.[1] || 'chapter-' + index,
    name: game.headers.ChapterName || game.headers.Event || 'Chapter ' + (index + 1),
    url: chapterUrl.startsWith('https://lichess.org/study/') ? chapterUrl : 'https://lichess.org/study/' + studyId,
    orientation: game.headers.Orientation?.toLowerCase() === 'black' ? 'black' : 'white',
    root,
    nodeCount: count,
  };
}

export function parseStudyPgn(studyId: string, pgn: string): ParsedStudy {
  if (pgn.length > MAX_PGN_CHARACTERS) throw new Error('Study PGN is too large for this prototype (2 MB limit).');
  const games = splitGames(pgn);
  if (games.length > MAX_CHAPTERS) throw new Error('Study has more than 200 chapters.');
  const chapters: StudyChapter[] = [];
  const skipped: string[] = [];
  let occurrences = 0;
  const counts = new Map<string, number>();
  for (const [index, game] of games.entries()) {
    try {
      const chapter = chapterFrom(game, studyId, index);
      if (occurrences + chapter.nodeCount > MAX_NODES) throw new Error('Study exceeds the total move limit');
      chapters.push(chapter);
      const visit = (node: StudyNode) => {
        occurrences += 1;
        counts.set(node.key, (counts.get(node.key) || 0) + 1);
        for (const child of node.children) visit(child);
      };
      visit(chapter.root);
    } catch (error) {
      skipped.push('Chapter ' + (index + 1) + ': ' + (error instanceof Error ? error.message : String(error)));
    }
  }
  if (!chapters.length) throw new Error('No supported study chapters could be parsed.' + (skipped.length ? ' ' + skipped[0] : ''));
  return {
    id: studyId,
    name: games.find((game) => game.headers.StudyName)?.headers.StudyName || 'Lichess study ' + studyId,
    chapters, occurrences, positions: counts.size,
    repeatedPositions: [...counts.values()].filter((count) => count > 1).length, skipped,
  };
}
