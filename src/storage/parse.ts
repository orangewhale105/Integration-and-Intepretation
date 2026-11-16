import { createEmptyCase } from '../model/caseData';
import { newId } from '../model/id';
import {
  CASE_FORMAT,
  CASE_VERSION,
  CATEGORIES,
  type Card,
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
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);

/** 読み込んだ JSON を検証し、欠けた値を補って CaseData にする */
export function parseCase(raw: unknown): CaseData {
  if (!isObj(raw) || raw.format !== CASE_FORMAT) {
    throw new CaseParseError('このアプリで保存したケースのファイルではありません。');
  }
  if (typeof raw.version !== 'number' || raw.version > CASE_VERSION) {
    throw new CaseParseError('新しい版のアプリで保存されたファイルのため、読み込めません。アプリを更新してください。');
  }
  const data = createEmptyCase(str(raw.caseName));
  const categoryIds = new Set<string>(CATEGORIES.map((c) => c.id));
  const toCategory = (v: string): SourceCategory =>
    categoryIds.has(v) ? (v as SourceCategory) : (OLD_CATEGORIES[v] ?? 'exam');

  for (const c of arr(raw.cards)) {
    if (!isObj(c)) continue;
    const category = toCategory(str(c.category));
    const card: Card = {
      id: str(c.id) || newId(),
      category,
      name: str(c.name),
      criterion: str(c.criterion),
      source: str(c.source),
      label: str(c.label),
      rows: arr(c.rows)
        .filter(isObj)
        .map((r) => ({ id: str(r.id) || newId(), result: str(r.result), reference: str(r.reference) })),
    };
    if (data.cards.some((x) => x.id === card.id)) card.id = newId();
    data.cards.push(card);
  }
  const cardIds = new Set(data.cards.map((c) => c.id));

  const icidh = isObj(raw.icidh) ? raw.icidh : {};
  const addDiagnosis = (d: Record<string, unknown>) => {
    const dx = { id: str(d.id) || newId(), name: str(d.name) };
    if (data.diagnoses.some((x) => x.id === dx.id)) dx.id = newId();
    data.diagnoses.push(dx);
    return dx.id;
  };
  if (raw.version < 2) {
    // 第1版：疾患名は画面2で直接入力していた。画面1の診断名に移し、画面2にはそのまま置く
    for (const d of arr(icidh.diseases).filter(isObj)) data.icidh.diseases.push(addDiagnosis(d));
  } else {
    arr(raw.diagnoses).filter(isObj).forEach(addDiagnosis);
    const known = new Set(data.diagnoses.map((d) => d.id));
    data.icidh.diseases = [...new Set(arr(icidh.diseases).map(str))].filter((id) => known.has(id));
  }
  const diseaseIds = new Set(data.icidh.diseases);

  // 1枚のカードは画面2の1か所にしか置けない。重複していれば最初の1か所だけ残す
  const placed = new Set<string>();
  const cols = isObj(icidh.columns) ? icidh.columns : {};
  for (const stage of ['impairment', 'disability', 'handicap'] as IcidhStage[]) {
    for (const id of arr(cols[stage]).map(str)) {
      if (!cardIds.has(id) || placed.has(id)) continue;
      placed.add(id);
      data.icidh.columns[stage].push(id);
    }
  }

  for (const l of arr(icidh.links)) {
    if (!isObj(l) || !isObj(l.from)) continue;
    const kind = l.from.kind;
    const fromId = str(l.from.id);
    let from: NodeRef;
    if (kind === 'disease' && diseaseIds.has(fromId)) from = { kind: 'disease', id: fromId };
    else if (kind === 'card' && placed.has(fromId)) from = { kind: 'card', id: fromId };
    else continue;
    const toCardId = str(l.toCardId);
    if (!placed.has(toCardId)) continue;
    const link: Link = { id: str(l.id) || newId(), from, toCardId, note: str(l.note) };
    data.icidh.links.push(link);
  }
  return data;
}
