// アプリ全体のデータ構造。
// 将来の全体ソフト（レジュメ作成）や ICF 画面からカード ID で参照できるよう、
// カードは画面2の配置と切り離して保持する。

/** 情報源の区分 */
export type SourceCategory = 'general' | 'medical' | 'otherDept' | 'exam';

/** 画面の上から並べる順 */
export const CATEGORIES: ReadonlyArray<{ id: SourceCategory; label: string }> = [
  { id: 'general', label: '一般情報' },
  { id: 'medical', label: '医学的情報' },
  { id: 'otherDept', label: '他部門情報' },
  { id: 'exam', label: '検査結果' },
];

export function categoryLabel(id: SourceCategory): string {
  return CATEGORIES.find((c) => c.id === id)?.label ?? '';
}

/** 結果の1行 */
export interface ResultRow {
  id: string;
  /** 結果（検査結果、または誰が何と言ったか・何を観察したかという事実） */
  result: string;
  /** 基準値（行ごとに比べる相手が異なる場合のみ。任意） */
  reference: string;
}

/**
 * カードの種類。
 * - problem：問題点のカード（1枚＝1つの問題点ラベル）。統合と解釈の機能障害・能力障害・社会的不利へ置ける
 * - info：情報のカード（例：氏名、主訴、現病歴）。判定基準・問題点のラベルを持たず、統合と解釈には置けない
 * - diagnosis：診断名のカード（医学的情報のみ）。統合と解釈の「疾患」の列へ置ける
 */
export type CardKind = 'problem' | 'info' | 'diagnosis';

export const CARD_KINDS: ReadonlyArray<{ id: CardKind; label: string }> = [
  { id: 'problem', label: '問題点' },
  { id: 'info', label: '情報' },
  { id: 'diagnosis', label: '診断名' },
];

/** その区分で作れるカードの種類（診断名は医学的情報のみ） */
export function kindsFor(category: SourceCategory): CardKind[] {
  return category === 'medical' ? ['problem', 'info', 'diagnosis'] : ['problem', 'info'];
}

/** 画面1のカード */
export interface Card {
  id: string;
  category: SourceCategory;
  kind: CardKind;
  /** 問題点：検査名／情報：項目名／診断名：診断名 */
  name: string;
  /** 判定基準（問題点のカードのみ） */
  criterion: string;
  /** 出典（なければ「自己定義」。問題点のカードのみ） */
  source: string;
  /** 問題点：検査結果／情報：内容（診断名のカードでは使わない） */
  rows: ResultRow[];
  /** 問題点のラベル（問題点のカードのみ） */
  label: string;
}

/** ICIDH の段階のうち、カードを置ける段階 */
export type IcidhStage = 'impairment' | 'disability' | 'handicap';

export const STAGES: ReadonlyArray<{ id: IcidhStage; label: string }> = [
  { id: 'impairment', label: '機能障害' },
  { id: 'disability', label: '能力障害' },
  { id: 'handicap', label: '社会的不利' },
];

/** 疾患の ID は診断名のカードの ID */
export type NodeRef = { kind: 'disease'; id: string } | { kind: 'card'; id: string };

/** 原因 → 結果の矢印 */
export interface Link {
  id: string;
  from: NodeRef;
  /** 矢印の先は常にカード（疾患は起点にしかならない） */
  toCardId: string;
  /** なぜつながるかの説明（任意） */
  note: string;
  /** 説明のテキストボックスを動かした量（矢印の中ほどからのずれ、px）。動かしていなければ null */
  notePos: { dx: number; dy: number } | null;
}

export interface IcidhData {
  /** 「疾患」の列に置いた診断名のカードの ID。上から D1、D2… */
  diseases: string[];
  /** 段階ごとのカード ID。上ほど重要度が高い */
  columns: Record<IcidhStage, string[]>;
  links: Link[];
}

export const CASE_FORMAT = 'integration-and-interpretation/case';
export const CASE_VERSION = 3;

export interface CaseData {
  format: typeof CASE_FORMAT;
  version: number;
  /** ケース名（書き出すファイル名） */
  caseName: string;
  cards: Card[];
  icidh: IcidhData;
}
