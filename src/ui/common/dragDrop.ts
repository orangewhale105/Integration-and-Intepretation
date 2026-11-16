// マウスとタッチ（iPad）の両方で動くドラッグ＆ドロップ。
// HTML5 の Drag and Drop は iPad Safari で扱いにくいため、Pointer Events で実装する。
import { h } from './dom';
import { closeContextMenu } from './contextMenu';

export type DragPayload =
  | { kind: 'card'; cardId: string; origin: 'screen1' | 'icidh' }
  | { kind: 'disease'; id: string; origin: 'screen1' | 'icidh' };

export interface DropTarget {
  el: HTMLElement;
  accepts: (p: DragPayload) => boolean;
  onDrop: (p: DragPayload, x: number, y: number) => void;
  /** ドラッグ中に上を通ったとき（並べ替えの位置表示などに使う） */
  onOver?: (p: DragPayload, x: number, y: number) => void;
  onLeave?: () => void;
}

const targets = new Set<DropTarget>();

export function registerDropTarget(t: DropTarget): () => void {
  targets.add(t);
  return () => targets.delete(t);
}

function findTarget(x: number, y: number, p: DragPayload): DropTarget | null {
  const hit = document.elementFromPoint(x, y);
  if (!hit) return null;
  let best: DropTarget | null = null;
  for (const t of targets) {
    if (!t.el.isConnected || !t.el.contains(hit) || !t.accepts(p)) continue;
    // 入れ子になっているときは内側を優先する
    if (!best || best.el.contains(t.el)) best = t;
  }
  return best;
}

const START_DISTANCE = 6;
/** タッチでは、少し押さえてから動かすとドラッグになる（すぐに動かすとスクロール） */
const TOUCH_HOLD_MS = 250;
const TOUCH_TOLERANCE = 10;

/** 入力欄やボタンの上では、ドラッグを始めない（文字の選択や入力を優先する） */
function isInteractive(t: EventTarget | null): boolean {
  return t instanceof Element && !!t.closest('input, textarea, select, button, .connector');
}

export interface DraggableOptions {
  /**
   * 要素のどこをつかんでもドラッグできるようにする（入力欄などを除く）。
   * タッチではスクロールと区別するため、少し押さえてから動かす。
   */
  wholeArea?: boolean;
}

/**
 * handle をつかんでドラッグできるようにする。
 * getPayload が null を返したときはドラッグしない。
 */
export function makeDraggable(
  handle: HTMLElement,
  getPayload: () => DragPayload | null,
  ghostText: () => string,
  options: DraggableOptions = {},
): void {
  const holdForTouch = !!options.wholeArea;
  if (!holdForTouch) handle.style.touchAction = 'none';

  /** タッチで押さえ続けてドラッグの準備ができた状態か */
  let armed = false;
  if (holdForTouch) {
    // 準備ができた後の指の動きでは、スクロールさせない
    handle.addEventListener('touchmove', (e) => {
      if (armed) e.preventDefault();
    }, { passive: false });
  }

  handle.addEventListener('pointerdown', (down) => {
    if (down.button !== 0 || isInteractive(down.target)) return;
    const payload = getPayload();
    if (!payload) return;
    const startX = down.clientX;
    const startY = down.clientY;
    const touch = holdForTouch && down.pointerType === 'touch';
    let ghost: HTMLElement | null = null;
    let over: DropTarget | null = null;
    let holdTimer: ReturnType<typeof setTimeout> | null = null;
    armed = !touch;
    if (touch) {
      holdTimer = setTimeout(() => {
        holdTimer = null;
        armed = true;
        handle.classList.add('drag-armed');
      }, TOUCH_HOLD_MS);
    }

    const move = (e: PointerEvent) => {
      if (!ghost) {
        const dist = Math.hypot(e.clientX - startX, e.clientY - startY);
        if (!armed) {
          // 押さえる前に動かした：スクロールとして扱い、ドラッグはしない
          if (dist > TOUCH_TOLERANCE) end(e, true);
          return;
        }
        if (dist < START_DISTANCE) return;
        closeContextMenu();
        ghost = h('div', { class: 'drag-ghost' }, ghostText() || '（ラベルなし）');
        document.body.append(ghost);
        document.body.classList.add('is-dragging');
      }
      e.preventDefault();
      ghost.style.transform = `translate(${e.clientX + 12}px, ${e.clientY + 8}px)`;
      const t = findTarget(e.clientX, e.clientY, payload);
      if (t !== over) {
        over?.el.classList.remove('drop-over');
        over?.onLeave?.();
        over = t;
        over?.el.classList.add('drop-over');
      }
      over?.onOver?.(payload, e.clientX, e.clientY);
    };
    const end = (e: PointerEvent, cancelled: boolean) => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', cancel);
      if (holdTimer) clearTimeout(holdTimer);
      armed = false;
      handle.classList.remove('drag-armed');
      if (!ghost) return;
      ghost.remove();
      document.body.classList.remove('is-dragging');
      over?.el.classList.remove('drop-over');
      over?.onLeave?.();
      if (!cancelled && over) over.onDrop(payload, e.clientX, e.clientY);
    };
    const up = (e: PointerEvent) => end(e, false);
    const cancel = (e: PointerEvent) => end(e, true);
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', cancel);
  });
}
