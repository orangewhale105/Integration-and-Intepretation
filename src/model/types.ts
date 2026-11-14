// アプリ全体のデータ構造。
// 将来の全体ソフト（レジュメ作成）や ICF 画面からカード ID で参照できるよう、
// カードは画面2の配置と切り離して保持する。

/** 情報源の区分 */
export type SourceCategory = 'exam' | 'observation' | 'interview' | 'otherDept' | 'family';

export const CATEGORIES: ReadonlyArray<{ id: SourceCategory; label: string }> = [
  { id: 'exam', label: '検査・測定' },
  { id: 'observation', label: '観察（視診・動作）' },
  { id: 'interview', label: '問診' },
  { id: 'otherDept', label: '他部門情報' },
  { id: 'family', label: '家族情報' },
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

/** 画面1のカード（1枚＝1つの問題点ラベル） */
export interface Card {
  id: string;
  category: SourceCategory;
  /** 検査名（情報の名称） */
  name: string;
  /** 基準（判定規則） */
  criterion: string;
  /** 出典（なければ「自己定義」） */
  source: string;
  rows: ResultRow[];
  /** 問題点ラベル */
  label: string;
}

/** ICIDH の段階のうち、カードを置ける段階 */
export type IcidhStage = 'impairment' | 'disability' | 'handicap';

export const STAGES: ReadonlyArray<{ id: IcidhStage; label: string }> = [
  { id: 'impairment', label: '機能障害' },
  { id: 'disability', label: '能力障害' },
  { id: 'handicap', label: '社会的不利' },
];

/** 疾患・変調（問題点ではないため直接入力） */
export interface Disease {
  id: string;
  name: string;
}

export type NodeRef = { kind: 'disease'; id: string } | { kind: 'card'; id: string };

/** 原因 → 結果の矢印 */
export interface Link {
  id: string;
  from: NodeRef;
  /** 矢印の先は常にカード（疾患・変調は起点にしかならない） */
  toCardId: string;
  /** なぜつながるかの説明（任意） */
  note: string;
}

export interface IcidhData {
  diseases: Disease[];
  /** 段階ごとのカード ID。上ほど重要度が高い */
  columns: Record<IcidhStage, string[]>;
  links: Link[];
}

export const CASE_FORMAT = 'integration-and-interpretation/case';
export const CASE_VERSION = 1;

export interface CaseData {
  format: typeof CASE_FORMAT;
  version: number;
  /** ケース名（書き出すファイル名） */
  caseName: string;
  cards: Card[];
  /** 画面2へ送ったカードの ID（送り欄に並ぶ） */
  sent: string[];
  icidh: IcidhData;
}
