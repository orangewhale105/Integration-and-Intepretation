import { newId } from './id';
import { CASE_FORMAT, CASE_VERSION, type Card, type CardKind, type CaseData, type ResultRow, type SourceCategory } from './types';

export const DEFAULT_CASE_NAME = '新しいケース';

export function createEmptyCase(caseName = DEFAULT_CASE_NAME): CaseData {
  return {
    format: CASE_FORMAT,
    version: CASE_VERSION,
    caseName,
    cards: [],
    icidh: {
      diseases: [],
      columns: { impairment: [], disability: [], handicap: [] },
      links: [],
    },
  };
}

/** 空のカードの種類（検査結果は問題点、それ以外は情報） */
export function defaultKind(category: SourceCategory): CardKind {
  return category === 'exam' ? 'problem' : 'info';
}

export function createCard(category: SourceCategory, kind: CardKind = 'problem'): Card {
  return { id: newId(), category, kind, name: '', criterion: '', source: '', rows: [], label: '' };
}

export function createRow(): ResultRow {
  return { id: newId(), result: '', reference: '' };
}

export function findCard(data: CaseData, id: string): Card | undefined {
  return data.cards.find((c) => c.id === id);
}

/** 診断名のカード */
export function findDiagnosis(data: CaseData, id: string): Card | undefined {
  return data.cards.find((c) => c.id === id && c.kind === 'diagnosis');
}

export function diagnosisCards(data: CaseData): Card[] {
  return data.cards.filter((c) => c.kind === 'diagnosis');
}

/** カードを削除する。統合と解釈に置いてあればそこからも外し、そのカードの矢印も消す */
export function deleteCard(data: CaseData, cardId: string): void {
  data.cards = data.cards.filter((c) => c.id !== cardId);
  removeFromIcidh(data, cardId);
  removeDiseaseFromIcidh(data, cardId);
}

/** 統合と解釈から問題点のカードを外し、そのカードから出る矢印・入る矢印を消す */
export function removeFromIcidh(data: CaseData, cardId: string): void {
  const cols = data.icidh.columns;
  cols.impairment = cols.impairment.filter((id) => id !== cardId);
  cols.disability = cols.disability.filter((id) => id !== cardId);
  cols.handicap = cols.handicap.filter((id) => id !== cardId);
  data.icidh.links = data.icidh.links.filter(
    (l) => l.toCardId !== cardId && !(l.from.kind === 'card' && l.from.id === cardId),
  );
}

/** 統合と解釈の「疾患」の列から診断名を外し、その疾患からの矢印を消す */
export function removeDiseaseFromIcidh(data: CaseData, diseaseId: string): void {
  data.icidh.diseases = data.icidh.diseases.filter((id) => id !== diseaseId);
  data.icidh.links = data.icidh.links.filter((l) => !(l.from.kind === 'disease' && l.from.id === diseaseId));
}

/** 問題点のカードとして置いてあるか */
export function isPlaced(data: CaseData, cardId: string): boolean {
  const cols = data.icidh.columns;
  return cols.impairment.includes(cardId) || cols.disability.includes(cardId) || cols.handicap.includes(cardId);
}

export function isDiseasePlaced(data: CaseData, cardId: string): boolean {
  return data.icidh.diseases.includes(cardId);
}

/** 問題点・診断名のどちらかとして統合と解釈に置いてあるか */
export function isOnIcidh(data: CaseData, cardId: string): boolean {
  return isPlaced(data, cardId) || isDiseasePlaced(data, cardId);
}

/**
 * カードの種類を変える。置ける場所が変わるため、合わなくなった配置は外す。
 * 外したときは true を返す。
 */
export function setCardKind(data: CaseData, card: Card, kind: CardKind): boolean {
  const was = isOnIcidh(data, card.id);
  card.kind = kind;
  if (kind !== 'problem') removeFromIcidh(data, card.id);
  if (kind !== 'diagnosis') removeDiseaseFromIcidh(data, card.id);
  return was && !isOnIcidh(data, card.id);
}

/**
 * カードの区分を変える。診断名のカードは医学的情報にしか置けないため、
 * ほかの区分へ移すときは情報のカードにする。統合と解釈から外したときは true を返す。
 */
export function setCardCategory(data: CaseData, card: Card, category: SourceCategory): boolean {
  card.category = category;
  if (card.kind === 'diagnosis' && category !== 'medical') return setCardKind(data, card, 'info');
  return false;
}
