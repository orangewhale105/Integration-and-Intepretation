import type { Card } from './types';

export function hasResult(card: Card): boolean {
  return card.rows.some((r) => r.result.trim() !== '');
}

/** 必須項目（区分・検査名・基準・出典・結果・問題点ラベル）がそろっていない項目名の一覧 */
export function missingFields(card: Card): string[] {
  const missing: string[] = [];
  if (card.name.trim() === '') missing.push('検査名');
  if (card.criterion.trim() === '') missing.push('基準');
  if (card.source.trim() === '') missing.push('出典');
  if (!hasResult(card)) missing.push('結果');
  if (card.label.trim() === '') missing.push('問題点ラベル');
  return missing;
}

export function isIncomplete(card: Card): boolean {
  return missingFields(card).length > 0;
}

/**
 * 画面2へ送れるかの判定。結果と問題点ラベルは送るための必須項目。
 * それ以外の不備（基準・出典など）は赤枠のまま送れる。
 */
export function sendBlockReason(card: Card): string | null {
  const lack: string[] = [];
  if (!hasResult(card)) lack.push('結果');
  if (card.label.trim() === '') lack.push('問題点ラベル');
  if (lack.length === 0) return null;
  return `${lack.join('と')}が空のカードは画面2へ送れません。入力してから送ってください。`;
}
