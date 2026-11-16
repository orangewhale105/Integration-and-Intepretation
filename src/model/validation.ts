import type { Card } from './types';

export function hasResult(card: Card): boolean {
  return card.rows.some((r) => r.result.trim() !== '');
}

/** 必須項目（検査名・検査結果・判定基準・出典・問題点のラベル）がそろっていない項目名の一覧 */
export function missingFields(card: Card): string[] {
  const missing: string[] = [];
  if (card.name.trim() === '') missing.push('検査名');
  if (!hasResult(card)) missing.push('検査結果');
  if (card.criterion.trim() === '') missing.push('判定基準');
  if (card.source.trim() === '') missing.push('出典');
  if (card.label.trim() === '') missing.push('問題点のラベル');
  return missing;
}

export function isIncomplete(card: Card): boolean {
  return missingFields(card).length > 0;
}

/**
 * 統合と解釈の画面へ置けるかの判定。検査結果と問題点のラベルは置くための必須項目。
 * それ以外の不備（判定基準・出典など）は赤枠のまま置ける。
 */
export function placeBlockReason(card: Card): string | null {
  const lack: string[] = [];
  if (!hasResult(card)) lack.push('検査結果');
  if (card.label.trim() === '') lack.push('問題点のラベル');
  if (lack.length === 0) return null;
  return `${lack.join('と')}が空のカードは統合と解釈の画面へ置けません。入力してから置いてください。`;
}
