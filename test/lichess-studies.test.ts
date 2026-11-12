import assert from 'node:assert/strict';
import test from 'node:test';
import { parseStudyPgn, studyIdFromInput } from '../prototypes/lichess-studies/study-pgn.ts';
import { createLichessSession } from '../src/lichess-session.ts';

const SAMPLE = [
  '[Event "Sample opening: Chapter A"]',
  '[StudyName "Sample opening"]',
  '[ChapterName "QGD main line"]',
  '[ChapterURL "https://lichess.org/study/AbCdEf12/R1s2T3u4"]',
  '[Variant "Standard"]',
  '[Result "*"]',
  '',
  '1. d4! d5 (1... Nf6 2. c4 (2. Nf3)) 2. c4 Nf6 {The main line.} *',
  '',
  '[Event "Sample opening: Chapter B"]',
  '[StudyName "Sample opening"]',
  '[ChapterName "Transposed"]',
  '[ChapterURL "https://lichess.org/study/AbCdEf12/V1w2X3y4"]',
  '[Variant "Standard"]',
  '[Result "*"]',
  '',
  '1. d4 Nf6 2. c4 d5 *',
].join('\n');

test('study URL accepts IDs and chapter URLs but rejects other hosts', () => {
  assert.deepEqual(studyIdFromInput('AbCdEf12'), { studyId: 'AbCdEf12' });
  assert.deepEqual(studyIdFromInput('https://lichess.org/study/AbCdEf12/R1s2T3u4'), {
    studyId: 'AbCdEf12', chapterId: 'R1s2T3u4',
  });
  assert.deepEqual(studyIdFromInput('https://lichess.org/api/study/AbCdEf12.pgn'), {
    studyId: 'AbCdEf12',
  });
  assert.throws(() => studyIdFromInput('https://example.test/study/AbCdEf12'), /lichess.org/);
  assert.throws(() => studyIdFromInput('not-a-study'), /8-character/);
});

test('parser retains recursive PGN variations, annotations and chapter context', () => {
  const document = parseStudyPgn('AbCdEf12', SAMPLE);
  assert.equal(document.name, 'Sample opening');
  assert.equal(document.chapters.length, 2);
  assert.deepEqual(document.skipped, []);
  const a = document.chapters[0];
  assert.equal(a.id, 'R1s2T3u4');
  assert.equal(a.root.children[0].san, 'd4');
  assert.ok(a.root.children[0].nags.includes('!'));
  const d4 = a.root.children[0];
  assert.deepEqual(d4.children.map((node) => node.san), ['d5', 'Nf6']);
  const nf6 = d4.children[1];
  assert.deepEqual(nf6.children.map((node) => node.san), ['c4', 'Nf3']);
  assert.equal(d4.children[0].children[0].children[0].comments[0], 'The main line.');
  assert.equal(document.chapters[1].name, 'Transposed');
});

test('different chapter move orders meet at one canonical position', () => {
  const document = parseStudyPgn('AbCdEf12', SAMPLE);
  const main = document.chapters[0].root.children[0].children[0].children[0].children[0];
  const transpose = document.chapters[1].root.children[0].children[0].children[0].children[0];
  assert.equal(main.key, transpose.key);
  assert.notEqual(main.id, transpose.id);
  assert.ok(document.repeatedPositions > 0);
  assert.ok(document.positions < document.occurrences);
});

test('unsupported chapter is skipped without losing valid chapters', () => {
  const unsupported = '[Event "Unsupported"]\n[Variant "Atomic"]\n\n1. e4 e5 *\n\n';
  const document = parseStudyPgn('AbCdEf12', unsupported + SAMPLE);
  assert.equal(document.chapters.length, 2);
  assert.equal(document.skipped.length, 1);
  assert.match(document.skipped[0], /Unsupported chess variant/);
});

test('optional study permission uses the existing Chessview Lichess PKCE session', async () => {
  const redirects: string[] = [];
  class MemoryStorage {
    values = new Map<string, string>();
    getItem(key: string) { return this.values.get(key) ?? null; }
    setItem(key: string, value: string) { this.values.set(key, value); }
    removeItem(key: string) { this.values.delete(key); }
  }
  const crypto = {
    getRandomValues(bytes: Uint8Array) { bytes.fill(3); return bytes; },
    subtle: { async digest() { return new Uint8Array(32).buffer; } },
  };
  const session = createLichessSession({
    gateway: { async request() { return { ok: true } as Response; } },
    location: { href: 'https://example.test/chessview/prototypes/lichess-studies/?study=AbCdEf12' },
    sessionStorage: new MemoryStorage(),
    localStorage: new MemoryStorage(),
    crypto,
    redirect: (url: string) => { redirects.push(url); },
    log: () => {},
  });
  await session.signIn({ scope: 'study:read' });
  const url = new URL(redirects[0]);
  assert.equal(url.searchParams.get('scope'), 'study:read');
  assert.match(url.searchParams.get('redirect_uri') || '', /study=AbCdEf12/);
  await session.signIn();
  assert.equal(new URL(redirects[1]).searchParams.get('scope'), null);
});
