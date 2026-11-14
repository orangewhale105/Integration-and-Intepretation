// マウスとタッチ（iPad）の両方で動くドラッグ＆ドロップ。
// HTML5 の Drag and Drop は iPad Safari で扱いにくいため、Pointer Events で実装する。
import { h } from './dom';
import { closeContextMenu } from './contextMenu';

export type DragPayload = { kind: 'card'; cardId: string; origin: 'screen1' | 'send' | 'icidh' };

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

/**
 * handle をつかんでドラッグできるようにする。
 * getPayload が null を返したときはドラッグしない。
 */
export function makeDraggable(
  handle: HTMLElement,
  getPayload: () => DragPayload | null,
  ghostText: () => string,
): void {
  handle.style.touchAction = 'none';
  handle.addEventListener('pointerdown', (down) => {
    if (down.button !== 0) return;
    const payload = getPayload();
    if (!payload) return;
    const startX = down.clientX;
    const startY = down.clientY;
    let ghost: HTMLElement | null = null;
    let over: DropTarget | null = null;

    const move = (e: PointerEvent) => {
      if (!ghost) {
        if (Math.hypot(e.clientX - startX, e.clientY - startY) < START_DISTANCE) return;
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
