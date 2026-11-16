// 画面1と画面2の境界。ドラッグで左右に動かせる。
// 端まで動かすと、もう一方の画面がほぼ全面になる。
import { h } from './common/dom';

export function createSplitter(container: HTMLElement): HTMLElement {
  const bar = h('div', {
    class: 'splitter',
    role: 'separator',
    'aria-orientation': 'vertical',
    'aria-label': '単一検査の解釈と統合と解釈の境界',
    tabindex: 0,
    title: 'ドラッグして左右の画面の幅を変える',
  });
  bar.style.touchAction = 'none';

  const setRatio = (ratio: number) => {
    const r = Math.min(1, Math.max(0, ratio));
    container.style.setProperty('--split', `${(r * 100).toFixed(2)}%`);
    bar.setAttribute('aria-valuenow', String(Math.round(r * 100)));
  };
  setRatio(0.5);

  bar.addEventListener('pointerdown', (down) => {
    down.preventDefault();
    bar.setPointerCapture(down.pointerId);
    bar.classList.add('active');
    const rect = container.getBoundingClientRect();
    const move = (e: PointerEvent) => setRatio((e.clientX - rect.left) / rect.width);
    const up = () => {
      bar.classList.remove('active');
      bar.removeEventListener('pointermove', move);
      bar.removeEventListener('pointerup', up);
      bar.removeEventListener('pointercancel', up);
    };
    bar.addEventListener('pointermove', move);
    bar.addEventListener('pointerup', up);
    bar.addEventListener('pointercancel', up);
  });

  bar.addEventListener('keydown', (e) => {
    const cur = parseFloat(container.style.getPropertyValue('--split')) / 100;
    if (e.key === 'ArrowLeft') setRatio(cur - 0.05);
    else if (e.key === 'ArrowRight') setRatio(cur + 0.05);
    else return;
    e.preventDefault();
  });
  return bar;
}
