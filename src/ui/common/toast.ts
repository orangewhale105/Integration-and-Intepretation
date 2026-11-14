import { h } from './dom';

let current: HTMLElement | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;

/** 画面下部に短いメッセージを出す（警告など） */
export function showToast(message: string, kind: 'warn' | 'info' = 'warn'): void {
  current?.remove();
  if (timer) clearTimeout(timer);
  current = h('div', { class: `toast toast-${kind}`, role: 'alert' }, message);
  document.body.append(current);
  timer = setTimeout(() => {
    current?.remove();
    current = null;
  }, 4500);
}
