import './eval-ui.css';
import { bindRecenterTarget } from './recenter-input.js';
import type { NodusActions } from './nodus-controller.ts';
import type { ViewMode } from './route-ledger.ts';

type MoveEvaluation = Readonly<{
  lossCp: number;
  quality: string;
}>;

type PositionEvaluation = Readonly<{
  cp?: number | null;
  mate?: number | null;
  depth?: number | null;
}>;

type Frequency = Readonly<{
  games?: number;
  share?: number;
}>;

type HumanMismatch = Readonly<{
  direction: 'up' | 'down';
}>;

type PresentationRelationship = Readonly<{
  id: string;
  source: string;
  target: string;
}>;

type PresentationStructure = Readonly<{
  composition?: Readonly<{
    relationships?: readonly PresentationRelationship[];
  }>;
}>;

type EvidenceRelationship = Readonly<{
  id: string;
  moveEval?: MoveEvaluation | null;
  rarity?: string | null;
}>;

type EvidenceValue = Readonly<{
  center?: Readonly<{
    evaluation?: PositionEvaluation | null;
  }> | null;
  relationships?: readonly EvidenceRelationship[];
}>;

type RailLine = Readonly<{
  edge: Readonly<{
    target?: string;
    san?: string;
    uci?: string;
  }>;
  frequency?: Frequency | null;
  moveEval?: MoveEvaluation | null;
  mastersMismatch?: HumanMismatch | null;
  lichessMismatch?: HumanMismatch | null;
}>;

type RailValue = Readonly<{
  lines?: readonly RailLine[];
}>;

type Lifecycle<T> = Readonly<{
  status?: string;
  value?: T | null;
  error?: string | null;
}>;

type EvidencePresentationView = Readonly<{
  mode: ViewMode;
  structure: Readonly<{ value?: unknown }>;
  evidence?: unknown;
  rail?: Readonly<{ value?: unknown }>;
}>;

type RelationshipOptions = Readonly<{
  incoming?: boolean;
  outgoing?: boolean;
}>;

type PresentationOptions = Readonly<{
  showGuide?: boolean;
}>;

function structureValue(view: EvidencePresentationView): PresentationStructure | null | undefined {
  return view.structure.value as PresentationStructure | null | undefined;
}

function evidenceLifecycle(view: EvidencePresentationView): Lifecycle<EvidenceValue> {
  return view.evidence as Lifecycle<EvidenceValue>;
}

function railValue(view: EvidencePresentationView): RailValue | null | undefined {
  return view.rail?.value as RailValue | null | undefined;
}

function escapeHtml(value: unknown = ''): string {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function lossLabel(moveEval?: MoveEvaluation | null, empty = '—'): string {
  if (!Number.isFinite(moveEval?.lossCp)) return empty;
  return ((moveEval?.lossCp ?? 0) / 100).toFixed(1);
}

function evaluationLabel(evaluation?: PositionEvaluation | null): string | null {
  const cp = evaluation?.cp;
  if (typeof cp === 'number' && Number.isFinite(cp)) {
    const pawns = cp / 100;
    return `${pawns >= 0 ? '+' : ''}${pawns.toFixed(1)}`;
  }
  const mate = evaluation?.mate;
  if (typeof mate === 'number' && Number.isFinite(mate)) return `#${mate}`;
  return null;
}

function evidencedShareLabel(frequency?: Frequency | null): string {
  const games = Number(frequency?.games ?? 0);
  const share = frequency?.share;
  if (!(games > 0) || typeof share !== 'number' || !Number.isFinite(share) || share <= 0) return '';
  const value = share * 100;
  return value < 0.5 ? '<1%' : `${Math.round(value)}%`;
}

function humanMarkerHtml(
  mismatch: HumanMismatch | null | undefined,
  population: 'masters' | 'lichess',
): string {
  if (!mismatch) return '';
  const arrow = mismatch.direction === 'up' ? '▲' : '▼';
  return `<span class="human-marker human-${population} human-${mismatch.direction}">${arrow}</span>`;
}

function setClass(element: Element, prefix: string, value?: string | null): void {
  for (const className of [...element.classList]) {
    if (className.startsWith(prefix)) element.classList.remove(className);
  }
  if (value) element.classList.add(`${prefix}${value}`);
}

function relationshipsFor(
  composition: PresentationStructure['composition'],
  key: string,
  options: RelationshipOptions = {},
): PresentationRelationship[] {
  const { incoming = true, outgoing = true } = options;
  return (composition?.relationships ?? []).filter((relationship) => (
    (incoming && relationship.target === key) || (outgoing && relationship.source === key)
  ));
}

function renderGuide(root: Element, visible: boolean): void {
  const rail = root.querySelector('.analysis-rail');
  const existing = rail?.querySelector('.eval-guide');
  if (!visible) {
    existing?.remove();
    return;
  }
  if (!rail || existing) return;
  const position = rail.querySelector('.rail-current-details');
  if (!position) return;
  position.insertAdjacentHTML('beforebegin', `
    <section class="eval-guide" aria-label="Chessview guide">
      <div><strong>Engine</strong><span class="guide-dot guide-strong"></span>&lt;0.5 pawn <span class="guide-dot guide-dubious"></span>0.5–1.0 <span class="guide-dot guide-bad"></span>1.0+</div>
      <div><strong>Human mismatch</strong><span class="human-marker human-masters">▲</span> Masters <span class="human-marker human-lichess">▲</span> Lichess</div>
    </section>`);
}

function decorateCenter(root: Element, evidence: EvidenceValue): void {
  const stats = root.querySelector('.rail-current-details .position-stats');
  if (!stats || !evidence.center) return;
  const evaluation = evidence.center.evaluation;
  const label = evaluationLabel(evaluation);
  const badge = (root.ownerDocument ?? globalThis.document).createElement('span');
  badge.className = 'center-eval-detail';
  badge.innerHTML = label
    ? `<strong>${escapeHtml(label)}</strong>${evaluation?.depth ? ` <span>d${evaluation.depth}</span>` : ''}`
    : '<span>eval unavailable</span>';
  stats.appendChild(badge);
}

function relationshipForSatellite(
  element: HTMLElement,
  view: EvidencePresentationView,
): PresentationRelationship | null {
  const key = element.dataset.key;
  const composition = structureValue(view)?.composition;
  if (!key || !composition) return null;
  const visible = view.mode === 'roots'
    ? relationshipsFor(composition, key, { incoming: false })
    : relationshipsFor(composition, key, { outgoing: false });
  return visible[0] ?? null;
}

function decorateSatellites(
  root: Element,
  view: EvidencePresentationView,
  evidenceById: ReadonlyMap<string, EvidenceRelationship>,
): void {
  for (const element of root.querySelectorAll<HTMLElement>('.satellite[data-key]')) {
    const relationship = relationshipForSatellite(element, view);
    const evidence = relationship ? evidenceById.get(relationship.id) : null;
    if (!evidence) continue;
    const quality = evidence.moveEval?.quality ?? 'unknown';
    setClass(element, 'eval-', quality);
    setClass(element, 'rarity-', evidence.rarity);
    const label = element.querySelector('.mini-label');
    if (!label) continue;
    const pill = (root.ownerDocument ?? globalThis.document).createElement('span');
    pill.className = 'mini-eval';
    pill.textContent = evidence.moveEval ? lossLabel(evidence.moveEval) : '·';
    pill.title = evidence.moveEval ? `${lossLabel(evidence.moveEval)} pawn loss vs best` : 'eval unavailable';
    label.appendChild(pill);
  }
}

function decorateConnectors(
  root: Element,
  evidenceById: ReadonlyMap<string, EvidenceRelationship>,
): void {
  for (const path of root.querySelectorAll<SVGPathElement>('path[data-relationship-id]')) {
    const evidence = evidenceById.get(path.dataset.relationshipId ?? '');
    if (!evidence) continue;
    setClass(path, 'edge-quality-', evidence.moveEval?.quality ?? null);
    setClass(path, 'edge-rarity-', evidence.rarity);
  }
}

function railRowHtml(row: RailLine): string {
  const quality = row.moveEval?.quality ?? 'unknown';
  const share = evidencedShareLabel(row.frequency);
  const mismatch = `${humanMarkerHtml(row.mastersMismatch, 'masters')}${humanMarkerHtml(row.lichessMismatch, 'lichess')}` || '<span class="human-none">—</span>';
  return `<button class="eval-rail-row eval-${quality}" type="button" data-eval-nav="${escapeHtml(row.edge.target)}">
    <span class="eval-rail-move">${escapeHtml(row.edge.san ?? row.edge.uci)}${share ? ` · ${share}` : ''}</span>
    <span class="eval-badge">${row.moveEval ? lossLabel(row.moveEval) : '—'}</span>
    <span class="eval-human-cell">${mismatch}</span><span class="eval-play">›</span></button>`;
}

function decorateLineRail(root: Element, view: EvidencePresentationView, actions: NodusActions): void {
  if (view.mode !== 'lines') return;
  const list = root.querySelector('.analysis-rail .rail-explorer .explorer-list');
  if (!list) return;
  const rail = railValue(view);
  const rows = rail?.lines ?? [];
  list.classList.add('eval-rail-list');
  list.innerHTML = rows.length
    ? `<div class="eval-rail-head"><span>Move</span><span>Loss</span><span>Human</span><span></span></div>${rows.map(railRowHtml).join('')}`
    : '<div class="rail-empty">No Lichess Lines yet.</div>';
  list.querySelectorAll<HTMLElement>('[data-eval-nav]').forEach((button) => {
    bindRecenterTarget(button, actions, () => button.dataset.evalNav);
  });
}

function showPresentationFailure(root: Element, error?: string | null): void {
  const rail = root.querySelector('.analysis-rail .rail-explorer');
  if (!rail || rail.querySelector('.evidence-presentation-failure')) return;
  const note = (root.ownerDocument ?? globalThis.document).createElement('div');
  note.className = 'rail-empty evidence-presentation-failure';
  note.textContent = 'Supplementary evidence is temporarily unavailable.';
  note.title = error || 'Evidence presentation failed';
  rail.appendChild(note);
}

export function decorateEvidencePresentation(
  root: Element,
  view: EvidencePresentationView,
  actions: NodusActions,
  { showGuide = false }: PresentationOptions = {},
): void {
  renderGuide(root, showGuide);
  const lifecycle = evidenceLifecycle(view);
  if (lifecycle.status === 'failed') {
    showPresentationFailure(root, lifecycle.error);
    return;
  }
  if (lifecycle.status !== 'ready' || !lifecycle.value) return;

  const evidence = lifecycle.value;
  const evidenceById = new Map(
    (evidence.relationships ?? []).map((item) => [item.id, item] as const),
  );
  decorateCenter(root, evidence);
  decorateLineRail(root, view, actions);
  decorateSatellites(root, view, evidenceById);
  decorateConnectors(root, evidenceById);
}
