// 統合と解釈で問題点のカードを選んだときに、そのカードの内容を横に出す小さな窓。
// 窓の外をクリック（iPad はタップ）するか Esc で閉じる。
import type { Card } from '../../model/types';
import { h } from '../common/dom';
import { cardDetailBody } from '../screen1/cardDetail';

let current: { el: HTMLElement; onClose: () => void } | null = null;

export function closeCardPopover(): void {
  if (!current) return;
  const { el, onClose } = current;
  current = null;
  el.remove();
  onClose();
}

export function isCardPopoverOpen(): boolean {
  return current !== null;
}

/** anchor の横に、カードの内容を出す。開いていれば中身と位置を差し替える */
export function showCardPopover(anchor: HTMLElement, title: string, card: Card, onClose: () => void): void {
  const closeBtn = h('button', { type: 'button', class: 'popover-close', 'aria-label': '閉じる', title: '閉じる' }, '×');
  closeBtn.addEventListener('click', closeCardPopover);
  const el = h(
    'div',
    { class: 'card-popover', role: 'dialog', 'aria-label': title },
    h('div', { class: 'popover-head' }, h('span', { class: 'popover-title' }, title), closeBtn),
    h('div', { class: 'popover-body' }, cardDetailBody(card)),
  );
  if (current) {
    // 同じ窓のまま中身を差し替える（閉じたことにはしない）
    current.el.replaceWith(el);
    current = { el, onClose };
  } else {
    document.body.append(el);
    current = { el, onClose };
  }
  position(anchor, el);
}

function position(anchor: HTMLElement, el: HTMLElement): void {
  const a = anchor.getBoundingClientRect();
  const r = el.getBoundingClientRect();
  const gap = 8;
  // 右に入らなければ左に出す。どちらも入らなければ画面の右端に寄せる
  let left = a.right + gap;
  if (left + r.width > window.innerWidth - 4) left = a.left - gap - r.width;
  if (left < 4) left = Math.max(4, window.innerWidth - r.width - 4);
  const top = Math.min(Math.max(4, a.top), window.innerHeight - r.height - 4);
  el.style.left = `${left}px`;
  el.style.top = `${Math.max(4, top)}px`;
}

document.addEventListener(
  'pointerdown',
  (e) => {
    const t = e.target as Element | null;
    // 窓の中と、カードを選び直す操作では閉じない
    if (!current || current.el.contains(t) || t?.closest?.('.icidh-card')) return;
    closeCardPopover();
  },
  true,
);
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeCardPopover();
});
