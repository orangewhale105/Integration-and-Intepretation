// ICIDH（画面2）のルールと、問題点リストの組み立て。
// 引ける矢印は「疾患 → 機能障害」「機能障害 → 能力障害」「能力障害 → 社会的不利」の3種類のみ。
import { findCard, findDiagnosis, removeDiseaseFromIcidh, removeFromIcidh } from './caseData';
import { newId } from './id';
import type { CaseData, IcidhStage, Link, NodeRef } from './types';

export type NodeStage = 'disease' | IcidhStage;

/** 問題点リストの段階の並び（レジュメと同じく社会的不利を上に） */
export const LIST_ORDER: ReadonlyArray<{ id: IcidhStage; label: string }> = [
  { id: 'handicap', label: '社会的不利' },
  { id: 'disability', label: '能力障害' },
  { id: 'impairment', label: '機能障害' },
];

const NEXT: Record<NodeStage, IcidhStage | null> = {
  disease: 'impairment',
  impairment: 'disability',
  disability: 'handicap',
  handicap: null,
};

const STAGE_NAME: Record<NodeStage, string> = {
  disease: '疾患',
  impairment: '機能障害',
  disability: '能力障害',
  handicap: '社会的不利',
};

export function stageOfCard(data: CaseData, cardId: string): IcidhStage | null {
  const cols = data.icidh.columns;
  if (cols.impairment.includes(cardId)) return 'impairment';
  if (cols.disability.includes(cardId)) return 'disability';
  if (cols.handicap.includes(cardId)) return 'handicap';
  return null;
}

export function stageOfNode(data: CaseData, ref: NodeRef): NodeStage | null {
  if (ref.kind === 'disease') return data.icidh.diseases.includes(ref.id) ? 'disease' : null;
  return stageOfCard(data, ref.id);
}

const sameRef = (a: NodeRef, b: NodeRef) => a.kind === b.kind && a.id === b.id;

/** 矢印を引けない理由。引けるときは null */
export function linkBlockReason(data: CaseData, from: NodeRef, toCardId: string): string | null {
  const fromStage = stageOfNode(data, from);
  const toStage = stageOfCard(data, toCardId);
  if (!fromStage || !toStage) return '統合と解釈の画面に置いたものどうしでのみ矢印を引けます。';
  if (from.kind === 'card' && from.id === toCardId) return '同じカードには矢印を引けません。';
  const expected = NEXT[fromStage];
  if (expected !== toStage) {
    if (fromStage === toStage) return `同じ段階（${STAGE_NAME[fromStage]}）どうしには矢印を引けません。`;
    if (expected === null) return '社会的不利から先へは矢印を引けません。';
    return `${STAGE_NAME[fromStage]}からは${STAGE_NAME[expected]}へだけ矢印を引けます（逆向き・段階の飛ばしはできません）。`;
  }
  if (data.icidh.links.some((l) => sameRef(l.from, from) && l.toCardId === toCardId)) return 'この矢印はすでに引いてあります。';
  return null;
}

export function addLink(data: CaseData, from: NodeRef, toCardId: string): Link | string {
  const reason = linkBlockReason(data, from, toCardId);
  if (reason) return reason;
  const link: Link = { id: newId(), from, toCardId, note: '', notePos: null };
  data.icidh.links.push(link);
  return link;
}

function isLinkValid(data: CaseData, l: Link): boolean {
  const fromStage = stageOfNode(data, l.from);
  const toStage = stageOfCard(data, l.toCardId);
  return !!fromStage && !!toStage && NEXT[fromStage] === toStage;
}

/**
 * カードを画面2の段階 stage の index 番目に置く。1枚のカードは1か所にしか置けないため、
 * すでに置いてあれば移動になる。移動によってルールに合わなくなった矢印は消し、その数を返す。
 * 置ける条件（検査結果と問題点のラベル）は、画面1から置くときに呼び出し側で判定する。
 */
export function placeCard(data: CaseData, cardId: string, stage: IcidhStage, index: number): number {
  if (findCard(data, cardId)?.kind !== 'problem') return 0;
  const cols = data.icidh.columns;
  const prevStage = stageOfCard(data, cardId);
  let at = index;
  if (prevStage) {
    const prevIndex = cols[prevStage].indexOf(cardId);
    cols[prevStage].splice(prevIndex, 1);
    if (prevStage === stage && prevIndex < at) at -= 1;
  }
  const col = cols[stage];
  col.splice(Math.max(0, Math.min(at, col.length)), 0, cardId);
  const before = data.icidh.links.length;
  data.icidh.links = data.icidh.links.filter((l) => isLinkValid(data, l));
  return before - data.icidh.links.length;
}

/** 診断名を「疾患」の列の index 番目に置く。すでに置いてあれば並べ替えになる */
export function placeDisease(data: CaseData, diseaseId: string, index: number): void {
  if (!findDiagnosis(data, diseaseId)) return;
  const col = data.icidh.diseases;
  let at = index;
  const prev = col.indexOf(diseaseId);
  if (prev !== -1) {
    col.splice(prev, 1);
    if (prev < at) at -= 1;
  }
  col.splice(Math.max(0, Math.min(at, col.length)), 0, diseaseId);
}

export { removeDiseaseFromIcidh, removeFromIcidh };

export interface Numbering {
  /** カード ID → 問題点の#番号 */
  card: Map<string, number>;
  /** 疾患 ID → D番号 */
  disease: Map<string, number>;
}

/**
 * 番号を振る。疾患は上から D1、D2…。
 * 問題点は機能障害から #1 として、能力障害、社会的不利の順に、列の上から振る。
 */
export function numbering(data: CaseData): Numbering {
  const disease = new Map<string, number>();
  data.icidh.diseases.forEach((id, i) => disease.set(id, i + 1));
  const card = new Map<string, number>();
  let n = 1;
  for (const stage of ['impairment', 'disability', 'handicap'] as IcidhStage[]) {
    for (const id of data.icidh.columns[stage]) card.set(id, n++);
  }
  return { card, disease };
}

export function refName(nums: Numbering, ref: NodeRef): string {
  return ref.kind === 'disease' ? `D${nums.disease.get(ref.id) ?? '?'}` : `#${nums.card.get(ref.id) ?? '?'}`;
}

export interface ProblemItem {
  cardId: string;
  number: number;
  stage: IcidhStage;
  label: string;
  /** 「#6 歩行能力低下（#1,2,3,4,5）」の形の見出し */
  heading: string;
  /** 矢印の説明（「#1 → #6：…」の形）。説明を書いた矢印のみ */
  notes: string[];
}

/** 原因の番号を「#1,2,3」「D1,2」の形にまとめる */
function formatCauses(nums: Numbering, causes: NodeRef[]): string {
  const d = causes.filter((c) => c.kind === 'disease').map((c) => nums.disease.get(c.id) ?? 0).sort((a, b) => a - b);
  const p = causes.filter((c) => c.kind === 'card').map((c) => nums.card.get(c.id) ?? 0).sort((a, b) => a - b);
  const parts: string[] = [];
  if (d.length) parts.push(`D${d.join(',')}`);
  if (p.length) parts.push(`#${p.join(',')}`);
  return parts.join(', ');
}

/** 問題点リスト。表示順は社会的不利を上、機能障害を下。同じ段階の中は列の上から */
export function problemList(data: CaseData): ProblemItem[] {
  const nums = numbering(data);
  const items: ProblemItem[] = [];
  for (const stage of ['handicap', 'disability', 'impairment'] as IcidhStage[]) {
    for (const cardId of data.icidh.columns[stage]) {
      const card = findCard(data, cardId);
      const number = nums.card.get(cardId)!;
      const label = card?.label.trim() || '（ラベルなし）';
      const incoming = data.icidh.links.filter((l) => l.toCardId === cardId);
      incoming.sort((a, b) => {
        if (a.from.kind !== b.from.kind) return a.from.kind === 'disease' ? -1 : 1;
        const na = a.from.kind === 'disease' ? nums.disease.get(a.from.id)! : nums.card.get(a.from.id)!;
        const nb = b.from.kind === 'disease' ? nums.disease.get(b.from.id)! : nums.card.get(b.from.id)!;
        return na - nb;
      });
      const causes = formatCauses(nums, incoming.map((l) => l.from));
      items.push({
        cardId,
        number,
        stage,
        label,
        heading: `#${number} ${label}${causes ? `（${causes}）` : ''}`,
        notes: incoming
          .filter((l) => l.note.trim() !== '')
          .map((l) => `${refName(nums, l.from)} → #${number}：${l.note.trim()}`),
      });
    }
  }
  return items;
}
