import './eval-ui.css';
import { edgeId } from './graph.ts';
import type { EvidenceEdge, MoveEvidence, PositionEvidence } from './evidence-source.ts';
import type { PreparedConstellationEvidence } from './evidence-presentation.ts';
import { bindRecenterTarget } from './recenter-input.ts';
import type { CurrentViewActions } from './current-view-controller.ts';

type MoveEvaluation = Readonly<{ lossCp: number; quality: string }>;
type PositionEvaluation = Readonly<{ cp?: number | null; mate?: number | null; depth?: number | null }>;
type Frequency = Readonly<{ games?: number; share?: number }>;
type HumanMismatch = Readonly<{ direction: 'up' | 'down' }>;
type PresentationRelationship = Readonly<{ id: string; source: string; target: string; edge: EvidenceEdge }>;
type PresentationNode = Readonly<{ key: string; relation?: string; relationships?: readonly string[]; edge?: Readonly<{ id?: string }> }>;
type PresentationStructure = Readonly<{ composition?: Readonly<{ nodes?: readonly PresentationNode[]; relationships?: readonly PresentationRelationship[] }> }>;
type RailLine = Readonly<{ edge: Readonly<{ target?: string; san?: string; uci?: string }>; frequency?: Frequency | null; moveEval?: MoveEvaluation | null; mastersMismatch?: HumanMismatch | null; lichessMismatch?: HumanMismatch | null }>;
type RailValue = Readonly<{ lines?: readonly RailLine[] }>;
type EvidencePresentationView = Readonly<{
  structure: Readonly<{ value?: unknown }>;
  rail?: Readonly<{ status?: string; value?: unknown }>;
}>;
type RelationshipOptions = Readonly<{ incoming?: boolean; outgoing?: boolean }>;
type PresentationOptions = Readonly<{ showGuide?: boolean }>;

function structureValue(view: EvidencePresentationView): PresentationStructure | null | undefined { return view.structure.value as PresentationStructure | null | undefined; }
function railValue(view: EvidencePresentationView): RailValue | null | undefined { return view.rail?.value as RailValue | null | undefined; }
function escapeHtml(value: unknown = ''): string { return String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;'); }
function lossLabel(moveEval?: MoveEvaluation | null, empty = '—'): string { return Number.isFinite(moveEval?.lossCp) ? ((moveEval?.lossCp ?? 0) / 100).toFixed(1) : empty; }
function evaluationLabel(evaluation?: PositionEvaluation | null): string | null {
  const cp = evaluation?.cp;
  if (typeof cp === 'number' && Number.isFinite(cp)) { const pawns = cp / 100; return `${pawns >= 0 ? '+' : ''}${pawns.toFixed(1)}`; }
  const mate = evaluation?.mate;
  return typeof mate === 'number' && Number.isFinite(mate) ? `#${mate}` : null;
}
function evidencedShareLabel(frequency?: Frequency | null): string {
  const games = Number(frequency?.games ?? 0); const share = frequency?.share;
  if (!(games > 0) || typeof share !== 'number' || !Number.isFinite(share) || share <= 0) return '';
  const value = share * 100; return value < 0.5 ? '<1%' : `${Math.round(value)}%`;
}
function humanMarkerHtml(mismatch: HumanMismatch | null | undefined, population: 'masters' | 'lichess'): string {
  if (!mismatch) return ''; const arrow = mismatch.direction === 'up' ? '▲' : '▼';
  return `<span class="human-marker human-${population} human-${mismatch.direction}">${arrow}</span>`;
}
function setClass(element: Element, prefix: string, value?: string | null): void {
  for (const className of [...element.classList]) if (className.startsWith(prefix)) element.classList.remove(className);
  if (value) element.classList.add(`${prefix}${value}`);
}
function relationshipsFor(composition: PresentationStructure['composition'], key: string, options: RelationshipOptions = {}): PresentationRelationship[] {
  const { incoming = true, outgoing = true } = options;
  return (composition?.relationships ?? []).filter((relationship) => (incoming && relationship.target === key) || (outgoing && relationship.source === key));
}
function nodeRecord(composition: PresentationStructure['composition'], key: string) {
  return composition?.nodes?.find((node) => node.key === key) ?? null;
}
function isImmediateRootRelationship(composition: PresentationStructure['composition'], relationship: PresentationRelationship): boolean {
  const source = nodeRecord(composition, relationship.source);
  const target = nodeRecord(composition, relationship.target);
  return source?.relation === 'root' && target == null;
}
function evidenceForRelationship(
  evidence: PreparedConstellationEvidence,
  relationship: PresentationRelationship | null,
): MoveEvidence | null {
  return relationship ? evidence.moves.get(edgeId(relationship.edge)) ?? null : null;
}
function renderGuide(root: Element, visible: boolean): void {
  const rail = root.querySelector('.analysis-rail'); const existing = rail?.querySelector('.eval-guide');
  if (!visible) { existing?.remove(); return; }
  if (!rail || existing) return;
  const position = rail.querySelector('.rail-current-details'); if (!position) return;
  position.insertAdjacentHTML('beforebegin', `<section class="eval-guide" aria-label="Chessview guide"><div><strong>Engine</strong><span class="guide-dot guide-strong"></span>&lt;0.5 pawn <span class="guide-dot guide-dubious"></span>0.5–1.0 <span class="guide-dot guide-bad"></span>1.0+</div><div><strong>Human mismatch</strong><span class="human-marker human-masters">▲</span> Masters <span class="human-marker human-lichess">▲</span> Lichess</div></section>`);
}
function decorateCenter(root: Element, position: PositionEvidence): void {
  const stats = root.querySelector('.rail-current-details .position-stats'); if (!stats) return;
  const evaluation = position.evaluation as PositionEvaluation | null; const label = evaluationLabel(evaluation);
  const badge = (root.ownerDocument ?? globalThis.document).createElement('span'); badge.className = 'center-eval-detail';
  badge.innerHTML = label ? `<strong>${escapeHtml(label)}</strong>${evaluation?.depth ? ` <span>d${evaluation.depth}</span>` : ''}` : '<span>eval unavailable</span>';
  stats.appendChild(badge);
}
function relationshipForSatellite(element: HTMLElement, view: EvidencePresentationView): PresentationRelationship | null {
  const key = element.dataset.key; const composition = structureValue(view)?.composition; if (!key || !composition) return null;
  const node = composition.nodes?.find((item) => item.key === key);
  const preferredId = node?.edge?.id ?? node?.relationships?.[0];
  if (preferredId) {
    const preferred = composition.relationships?.find((relationship) => relationship.id === preferredId);
    if (preferred) return preferred;
  }
  return relationshipsFor(composition, key)[0] ?? null;
}
function decorateSatellites(root: Element, view: EvidencePresentationView, evidence: PreparedConstellationEvidence): void {
  const composition = structureValue(view)?.composition;
  for (const element of root.querySelectorAll<HTMLElement>('.satellite[data-key]')) {
    const relationship = relationshipForSatellite(element, view);
    const moveEvidence = evidenceForRelationship(evidence, relationship);
    if (!relationship || !moveEvidence) continue;
    setClass(element, 'eval-', moveEvidence.moveEval?.quality ?? 'unknown');
    setClass(element, 'rarity-', isImmediateRootRelationship(composition, relationship) ? moveEvidence.rarity : null);
    const label = element.querySelector('.mini-label'); if (!label) continue;
    const pill = (root.ownerDocument ?? globalThis.document).createElement('span'); pill.className = 'mini-eval'; pill.textContent = moveEvidence.moveEval ? lossLabel(moveEvidence.moveEval) : '·';
    pill.title = moveEvidence.moveEval ? `${lossLabel(moveEvidence.moveEval)} pawn loss vs best` : 'eval unavailable'; label.appendChild(pill);
  }
}
function decorateConnectors(root: Element, view: EvidencePresentationView, evidence: PreparedConstellationEvidence): void {
  const composition = structureValue(view)?.composition;
  for (const path of root.querySelectorAll<SVGPathElement>('path[data-relationship-id]')) {
    const relationship = composition?.relationships?.find((item) => item.id === (path.dataset.relationshipId ?? '')) ?? null;
    const moveEvidence = evidenceForRelationship(evidence, relationship);
    if (!relationship || !moveEvidence) continue;
    setClass(path, 'edge-quality-', moveEvidence.moveEval?.quality ?? null);
    setClass(path, 'edge-rarity-', isImmediateRootRelationship(composition, relationship) ? moveEvidence.rarity : null);
  }
}
function railRowHtml(row: RailLine): string {
  const quality = row.moveEval?.quality ?? 'unknown'; const share = evidencedShareLabel(row.frequency);
  const mismatch = `${humanMarkerHtml(row.mastersMismatch, 'masters')}${humanMarkerHtml(row.lichessMismatch, 'lichess')}` || '<span class="human-none">—</span>';
  return `<button class="eval-rail-row eval-${quality}" type="button" data-eval-nav="${escapeHtml(row.edge.target)}"><span class="eval-rail-move">${escapeHtml(row.edge.san ?? row.edge.uci)}${share ? ` · ${share}` : ''}</span><span class="eval-badge">${row.moveEval ? lossLabel(row.moveEval) : '—'}</span><span class="eval-human-cell">${mismatch}</span><span class="eval-play">›</span></button>`;
}
function decorateLineRail(root: Element, view: EvidencePresentationView, actions: CurrentViewActions): void {
  if (view.rail?.status === 'loading') return;
  const list = root.querySelector('.analysis-rail .rail-explorer .explorer-list'); if (!list) return;
  const rows = railValue(view)?.lines ?? []; list.classList.add('eval-rail-list');
  list.innerHTML = rows.length ? `<div class="eval-rail-head"><span>Move</span><span>Loss</span><span>Human</span><span></span></div>${rows.map(railRowHtml).join('')}` : '<div class="rail-empty">No Lichess Lines yet.</div>';
  list.querySelectorAll<HTMLElement>('[data-eval-nav]').forEach((button) => bindRecenterTarget(button, actions, () => button.dataset.evalNav));
}
export function decorateEvidencePresentationFailure(root: Element, error: unknown): void {
  const rail = root.querySelector('.analysis-rail .rail-explorer'); if (!rail || rail.querySelector('.evidence-presentation-failure')) return;
  const note = (root.ownerDocument ?? globalThis.document).createElement('div'); note.className = 'rail-empty evidence-presentation-failure'; note.textContent = 'Supplementary evidence is temporarily unavailable.';
  note.title = error instanceof Error ? error.message : String(error ?? 'Evidence presentation failed');
  rail.appendChild(note);
}
export function decorateEvidencePresentation(
  root: Element,
  view: EvidencePresentationView,
  actions: CurrentViewActions,
  evidence: PreparedConstellationEvidence | null = null,
  { showGuide = false }: PresentationOptions = {},
): void {
  renderGuide(root, showGuide);
  decorateLineRail(root, view, actions);
  if (!evidence) return;
  decorateCenter(root, evidence.position);
  decorateSatellites(root, view, evidence);
  decorateConnectors(root, view, evidence);
}
