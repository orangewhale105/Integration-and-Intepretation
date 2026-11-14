// 右クリックのメニュー。iPad では長押しで同じメニューを開く。
import { h } from './dom';

export interface MenuItem {
  label: string;
  danger?: boolean;
  action: () => void;
}

let openMenu: HTMLElement | null = null;

export function closeContextMenu(): void {
  openMenu?.remove();
  openMenu = null;
}

export function showContextMenu(x: number, y: number, items: MenuItem[]): void {
  closeContextMenu();
  const menu = h('div', { class: 'context-menu', role: 'menu' });
  for (const item of items) {
    const btn = h('button', { type: 'button', role: 'menuitem', class: item.danger ? 'danger' : '' }, item.label);
    btn.addEventListener('click', () => {
      closeContextMenu();
      item.action();
    });
    menu.append(btn);
  }
  document.body.append(menu);
  const rect = menu.getBoundingClientRect();
  menu.style.left = `${Math.min(x, window.innerWidth - rect.width - 4)}px`;
  menu.style.top = `${Math.min(y, window.innerHeight - rect.height - 4)}px`;
  openMenu = menu;
}

document.addEventListener('pointerdown', (e) => {
  if (openMenu && !openMenu.contains(e.target as Node)) closeContextMenu();
}, true);
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeContextMenu();
});
window.addEventListener('blur', closeContextMenu);

const LONG_PRESS_MS = 550;
const MOVE_TOLERANCE = 10;

/** 入力欄の上では、ブラウザ標準のメニュー（コピー・貼り付けなど）を優先する */
function isTextInput(t: EventTarget | null): boolean {
  return t instanceof HTMLElement && !!t.closest('input, textarea, select');
}

/**
 * 要素に右クリック（Windows）と長押し（iPad）のメニューを付ける。
 * getItems が null を返したときはメニューを出さない。
 */
export function attachContextMenu(el: HTMLElement, getItems: (target: EventTarget | null) => MenuItem[] | null): void {
  el.addEventListener('contextmenu', (e) => {
    if (isTextInput(e.target)) return;
    const items = getItems(e.target);
    if (!items) return;
    e.preventDefault();
    e.stopPropagation();
    showContextMenu(e.clientX, e.clientY, items);
  });

  let timer: ReturnType<typeof setTimeout> | null = null;
  let start: { x: number; y: number } | null = null;
  const cancel = () => {
    if (timer) clearTimeout(timer);
    timer = null;
    start = null;
  };
  el.addEventListener('pointerdown', (e) => {
    if (e.pointerType !== 'touch' || isTextInput(e.target)) return;
    const target = e.target;
    start = { x: e.clientX, y: e.clientY };
    timer = setTimeout(() => {
      timer = null;
      const items = getItems(target);
      if (!items || !start) return;
      suppressNextClick(el);
      showContextMenu(start.x, start.y, items);
    }, LONG_PRESS_MS);
  });
  el.addEventListener('pointermove', (e) => {
    if (start && Math.hypot(e.clientX - start.x, e.clientY - start.y) > MOVE_TOLERANCE) cancel();
  });
  el.addEventListener('pointerup', cancel);
  el.addEventListener('pointercancel', cancel);
}

/** 長押しの直後に発生するクリックを無視する */
function suppressNextClick(el: HTMLElement): void {
  const handler = (e: Event) => {
    e.stopPropagation();
    e.preventDefault();
  };
  el.addEventListener('click', handler, { capture: true, once: true });
  setTimeout(() => el.removeEventListener('click', handler, { capture: true }), 800);
}
