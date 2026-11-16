import { createEmptyCase } from '../model/caseData';
import { newId } from '../model/id';
import {
  CARD_KINDS,
  CASE_FORMAT,
  CASE_VERSION,
  CATEGORIES,
  kindsFor,
  type Card,
  type CardKind,
  type CaseData,
  type IcidhStage,
  type Link,
  type NodeRef,
  type SourceCategory,
} from '../model/types';

export class CaseParseError extends Error {}

/** 第1版の区分を今の区分へ読み替える（観察は検査結果、問診・家族情報は一般情報） */
const OLD_CATEGORIES: Record<string, SourceCategory> = {
  observation: 'exam',
  interview: 'general',
  family: 'general',
};

const str = (v: unknown): string => (typeof v === 'string' ? v : '');
const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);

/**
 * 読み込んだ JSON を検証し、欠けた値を補って CaseData にする。
 * 古い版のファイルは今の形に直す。
 * - 第1版：疾患名は画面2で直接入力していた
 * - 第2版：診断名は医学的情報のリスト（カードではない）だった
 */
export function parseCase(raw: unknown): CaseData {
  if (!isObj(raw) || raw.format !== CASE_FORMAT) {
    throw new CaseParseError('このアプリで保存したケースのファイルではありません。');
  }
  if (typeof raw.version !== 'number' || raw.version > CASE_VERSION) {
    throw new CaseParseError('新しい版のアプリで保存されたファイルのため、読み込めません。アプリを更新してください。');
  }
  const version = raw.version;
  const data = createEmptyCase(str(raw.caseName));
  const categoryIds = new Set<string>(CATEGORIES.map((c) => c.id));
  const kindIds = new Set<string>(CARD_KINDS.map((k) => k.id));
  const toCategory = (v: string): SourceCategory =>
    categoryIds.has(v) ? (v as SourceCategory) : (OLD_CATEGORIES[v] ?? 'exam');
  const usedIds = new Set<string>();
  const uniqueId = (v: unknown) => {
    let id = str(v) || newId();
    if (usedIds.has(id)) id = newId();
    usedIds.add(id);
    return id;
  };
  const icidh = isObj(raw.icidh) ? raw.icidh : {};

  // 古い版の診断名は、医学的情報の先頭の診断名のカードにする
  const oldDiagnoses = version < 2 ? arr(icidh.diseases) : version < 3 ? arr(raw.diagnoses) : [];
  const oldDiagnosisIds: string[] = [];
  for (const d of oldDiagnoses.filter(isObj)) {
    const card: Card = { id: uniqueId(d.id), category: 'medical', kind: 'diagnosis', name: str(d.name), criterion: '', source: '', rows: [], label: '' };
    data.cards.push(card);
    oldDiagnosisIds.push(card.id);
  }

  for (const c of arr(raw.cards)) {
    if (!isObj(c)) continue;
    const category = toCategory(str(c.category));
    let kind: CardKind = version < 3 ? 'problem' : kindIds.has(str(c.kind)) ? (str(c.kind) as CardKind) : 'problem';
    if (!kindsFor(category).includes(kind)) kind = 'info';
    data.cards.push({
      id: uniqueId(c.id),
      category,
      kind,
      name: str(c.name),
      criterion: str(c.criterion),
      source: str(c.source),
      label: str(c.label),
      rows: arr(c.rows)
        .filter(isObj)
        .map((r) => ({ id: str(r.id) || newId(), result: str(r.result), reference: str(r.reference) })),
    });
  }
  const kindOf = new Map(data.cards.map((c) => [c.id, c.kind]));

  // 疾患の列：古い版で画面2に置いてあった疾患はそのまま置く（第2版は置いたものだけ）
  const diseaseIds = version < 2 ? oldDiagnosisIds : arr(icidh.diseases).map(str);
  data.icidh.diseases = [...new Set(diseaseIds)].filter((id) => kindOf.get(id) === 'diagnosis');
  const placedDiseases = new Set(data.icidh.diseases);

  // 1枚のカードは1か所にしか置けない。重複していれば最初の1か所だけ残す
  const placed = new Set<string>();
  const cols = isObj(icidh.columns) ? icidh.columns : {};
  for (const stage of ['impairment', 'disability', 'handicap'] as IcidhStage[]) {
    for (const id of arr(cols[stage]).map(str)) {
      if (kindOf.get(id) !== 'problem' || placed.has(id)) continue;
      placed.add(id);
      data.icidh.columns[stage].push(id);
    }
  }

  for (const l of arr(icidh.links)) {
    if (!isObj(l) || !isObj(l.from)) continue;
    const kind = l.from.kind;
    const fromId = str(l.from.id);
    let from: NodeRef;
    if (kind === 'disease' && placedDiseases.has(fromId)) from = { kind: 'disease', id: fromId };
    else if (kind === 'card' && placed.has(fromId)) from = { kind: 'card', id: fromId };
    else continue;
    const toCardId = str(l.toCardId);
    if (!placed.has(toCardId)) continue;
    const pos = isObj(l.notePos) ? l.notePos : null;
    const dx = num(pos?.dx);
    const dy = num(pos?.dy);
    const link: Link = {
      id: str(l.id) || newId(),
      from,
      toCardId,
      note: str(l.note),
      notePos: dx !== null && dy !== null ? { dx, dy } : null,
    };
    data.icidh.links.push(link);
  }
  return data;
}
