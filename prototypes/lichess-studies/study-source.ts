import { lichessGateway } from '../../src/lichess-gateway.ts';
import { lichessSession } from '../../src/lichess-session.ts';

export type StudyLog = (area: string, event: string, detail?: Record<string, unknown>) => void;
export type StudyMetadata = { id: string; name: string; updatedAt: number };
export type StudyList = { studies: StudyMetadata[]; publicOnly: boolean };

async function requestWithPublicFallback(url: string, log: StudyLog, signal?: AbortSignal):
  Promise<{ response: Response; publicOnly: boolean }> {
  const init: RequestInit = signal ? { signal } : {};
  const work = signal ? { signal, urgency: 'foreground' as const } : { urgency: 'foreground' as const };
  const started = performance.now();
  log('network', 'authorized Lichess request started');
  let response = await lichessSession.authorizedRequest(url, init, work);
  log('network', 'authorized response', { status: response.status, elapsedMs: Math.round(performance.now() - started) });
  if (response.status !== 403) return { response, publicOnly: false };
  log('auth', 'study permission absent; trying public access');
  const publicStart = performance.now();
  response = await lichessGateway.request(url, init, work);
  log('network', 'public response', { status: response.status, elapsedMs: Math.round(performance.now() - publicStart) });
  return { response, publicOnly: true };
}

export async function readLichessAccount(log: StudyLog): Promise<string> {
  const started = performance.now();
  log('auth', 'checking signed-in Lichess account');
  const response = await lichessSession.authorizedRequest('https://lichess.org/api/account', {
    headers: { Accept: 'application/json' },
  });
  log('auth', 'account response', { status: response.status, elapsedMs: Math.round(performance.now() - started) });
  if (!response.ok) throw new Error('Could not read signed-in account (HTTP ' + response.status + ').');
  const value = await response.json();
  if (typeof value?.username !== 'string' && typeof value?.id !== 'string') {
    throw new Error('Lichess did not return an account username.');
  }
  return value.username || value.id;
}

export async function readStudyPgn(studyId: string, log: StudyLog, signal?: AbortSignal):
  Promise<{ pgn: string; publicOnly: boolean }> {
  const url = 'https://lichess.org/api/study/' + encodeURIComponent(studyId) +
    '.pgn?clocks=false&comments=true&variations=true&orientation=true';
  const started = performance.now();
  log('study', 'requesting study PGN', { studyIdLength: studyId.length });
  const { response, publicOnly } = await requestWithPublicFallback(url, log, signal);
  if (!response.ok) {
    log('error', 'study request failed', { status: response.status, publicOnly });
    const detail = response.status === 404 && publicOnly
      ? 'The study was not public, or it does not exist. Grant study access if it is yours.'
      : 'Lichess returned HTTP ' + response.status + ' for this study.';
    throw new Error(detail);
  }
  const pgn = await response.text();
  log('study', 'study PGN received', {
    bytes: new TextEncoder().encode(pgn).length, elapsedMs: Math.round(performance.now() - started),
    publicOnly,
  });
  return { pgn, publicOnly };
}

export async function listLichessStudies(username: string, log: StudyLog, signal?: AbortSignal): Promise<StudyList> {
  log('library', 'requesting study metadata list');
  const url = 'https://lichess.org/api/study/by/' + encodeURIComponent(username);
  const { response, publicOnly } = await requestWithPublicFallback(url, log, signal);
  if (!response.ok) throw new Error('Could not list studies (HTTP ' + response.status + ').');
  const body = await response.text();
  if (body.length > 2_000_000) throw new Error('Study list exceeds the 2 MB prototype limit.');
  const studies: StudyMetadata[] = [];
  let rejected = 0;
  for (const line of body.split(/\r?\n/)) {
    if (!line.trim()) continue;
    try {
      const value = JSON.parse(line);
      if (!/^[a-zA-Z0-9]{8}$/.test(value?.id) || typeof value?.name !== 'string') {
        rejected += 1; continue;
      }
      studies.push({ id: value.id, name: value.name, updatedAt: Number(value.updatedAt) || 0 });
    } catch { rejected += 1; }
  }
  studies.sort((a, b) => b.updatedAt - a.updatedAt);
  log('library', 'study list parsed', { count: studies.length, rejected, publicOnly });
  return { studies, publicOnly };
}
