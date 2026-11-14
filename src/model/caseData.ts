import { newId } from './id';
import { CASE_FORMAT, CASE_VERSION, type Card, type CaseData, type ResultRow, type SourceCategory } from './types';

export const DEFAULT_CASE_NAME = '新しいケース';

export function createEmptyCase(caseName = DEFAULT_CASE_NAME): CaseData {
  return {
    format: CASE_FORMAT,
    version: CASE_VERSION,
    caseName,
    cards: [],
    sent: [],
    icidh: {
      diseases: [],
      columns: { impairment: [], disability: [], handicap: [] },
      links: [],
    },
  };
}

export function createCard(category: SourceCategory): Card {
  return { id: newId(), category, name: '', criterion: '', source: '', rows: [], label: '', };
}

export function createRow(): ResultRow {
  return { id: newId(), result: '', reference: '' };
}

export function findCard(data: CaseData, id: string): Card | undefined {
  return data.cards.find((c) => c.id === id);
}

/** カードを削除する。画面2に置いてあれば画面2からも外し、そのカードの矢印も消す */
export function deleteCard(data: CaseData, cardId: string): void {
  data.cards = data.cards.filter((c) => c.id !== cardId);
  data.sent = data.sent.filter((id) => id !== cardId);
  removeFromIcidh(data, cardId);
}

/** 画面2からカードを外し、そのカードから出る矢印・入る矢印を消す */
export function removeFromIcidh(data: CaseData, cardId: string): void {
  const cols = data.icidh.columns;
  cols.impairment = cols.impairment.filter((id) => id !== cardId);
  cols.disability = cols.disability.filter((id) => id !== cardId);
  cols.handicap = cols.handicap.filter((id) => id !== cardId);
  data.icidh.links = data.icidh.links.filter(
    (l) => l.toCardId !== cardId && !(l.from.kind === 'card' && l.from.id === cardId),
  );
}

export function isPlaced(data: CaseData, cardId: string): boolean {
  const cols = data.icidh.columns;
  return cols.impairment.includes(cardId) || cols.disability.includes(cardId) || cols.handicap.includes(cardId);
}
