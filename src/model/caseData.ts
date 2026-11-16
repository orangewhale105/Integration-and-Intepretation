import { newId } from './id';
import { CASE_FORMAT, CASE_VERSION, type Card, type CaseData, type Disease, type ResultRow, type SourceCategory } from './types';

export const DEFAULT_CASE_NAME = '新しいケース';

export function createEmptyCase(caseName = DEFAULT_CASE_NAME): CaseData {
  return {
    format: CASE_FORMAT,
    version: CASE_VERSION,
    caseName,
    cards: [],
    diagnoses: [],
    icidh: {
      diseases: [],
      columns: { impairment: [], disability: [], handicap: [] },
      links: [],
    },
  };
}

export function createCard(category: SourceCategory): Card {
  return { id: newId(), category, name: '', criterion: '', source: '', rows: [], label: '' };
}

export function createRow(): ResultRow {
  return { id: newId(), result: '', reference: '' };
}

export function createDiagnosis(name = ''): Disease {
  return { id: newId(), name };
}

export function findCard(data: CaseData, id: string): Card | undefined {
  return data.cards.find((c) => c.id === id);
}

export function findDiagnosis(data: CaseData, id: string): Disease | undefined {
  return data.diagnoses.find((d) => d.id === id);
}

/** カードを削除する。画面2に置いてあれば画面2からも外し、そのカードの矢印も消す */
export function deleteCard(data: CaseData, cardId: string): void {
  data.cards = data.cards.filter((c) => c.id !== cardId);
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

/** 画面2の「疾患」の列から診断名を外し、その疾患からの矢印を消す */
export function removeDiseaseFromIcidh(data: CaseData, diseaseId: string): void {
  data.icidh.diseases = data.icidh.diseases.filter((id) => id !== diseaseId);
  data.icidh.links = data.icidh.links.filter((l) => !(l.from.kind === 'disease' && l.from.id === diseaseId));
}

/** 診断名を削除する。画面2に置いてあれば画面2からも外す */
export function deleteDiagnosis(data: CaseData, diseaseId: string): void {
  data.diagnoses = data.diagnoses.filter((d) => d.id !== diseaseId);
  removeDiseaseFromIcidh(data, diseaseId);
}

export function isPlaced(data: CaseData, cardId: string): boolean {
  const cols = data.icidh.columns;
  return cols.impairment.includes(cardId) || cols.disability.includes(cardId) || cols.handicap.includes(cardId);
}

export function isDiseasePlaced(data: CaseData, diseaseId: string): boolean {
  return data.icidh.diseases.includes(diseaseId);
}
