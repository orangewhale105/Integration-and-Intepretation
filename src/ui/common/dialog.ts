import { h } from './dom';

/** 閉じるボタン付きのダイアログ。背景のクリックか Esc でも閉じる */
export function showDialog(title: string, body: HTMLElement): () => void {
  const close = () => {
    overlay.remove();
    document.removeEventListener('keydown', onKey);
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') close();
  };
  const closeBtn = h('button', { type: 'button', class: 'btn' }, '閉じる');
  closeBtn.addEventListener('click', close);
  const dialog = h(
    'div',
    { class: 'dialog', role: 'dialog', 'aria-modal': 'true', 'aria-label': title },
    h('h2', { class: 'dialog-title' }, title),
    h('div', { class: 'dialog-body' }, body),
    h('div', { class: 'dialog-actions' }, closeBtn),
  );
  const overlay = h('div', { class: 'dialog-overlay' }, dialog);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close();
  });
  document.addEventListener('keydown', onKey);
  document.body.append(overlay);
  closeBtn.focus();
  return close;
}
