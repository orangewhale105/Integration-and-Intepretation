import type { Card } from './types';

export function hasResult(card: Card): boolean {
  return card.rows.some((r) => r.result.trim() !== '');
}

/**
 * 必須項目がそろっていない項目名の一覧。
 * 問題点：検査名・検査結果・判定基準・出典・問題点のラベル／情報：項目名・内容／診断名：診断名
 */
export function missingFields(card: Card): string[] {
  if (card.kind === 'diagnosis') return card.name.trim() === '' ? ['診断名'] : [];
  if (card.kind === 'info') {
    const m: string[] = [];
    if (card.name.trim() === '') m.push('項目名');
    if (!hasResult(card)) m.push('内容');
    return m;
  }
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
  if (card.kind === 'info') return '情報のカードは統合と解釈に置けません。置けるのは問題点のカードと診断名のカードです。';
  if (card.kind === 'diagnosis') return card.name.trim() === '' ? '診断名が空のため置けません。入力してから置いてください。' : null;
  const lack: string[] = [];
  if (!hasResult(card)) lack.push('検査結果');
  if (card.label.trim() === '') lack.push('問題点のラベル');
  if (lack.length === 0) return null;
  return `${lack.join('と')}が空のカードは統合と解釈の画面へ置けません。入力してから置いてください。`;
}
