// 画面1の右端の「画面2へ送る」欄（送り欄）。
// 画面1のカードをここへドロップすると画面2へ送られる。問題点ラベル名だけを区分ごとに並べる。
import { findCard, isPlaced } from '../../model/caseData';
import { CATEGORIES } from '../../model/types';
import { isIncomplete, sendBlockReason } from '../../model/validation';
import { store } from '../../store';
import { h } from '../common/dom';
import { makeDraggable, registerDropTarget } from '../common/dragDrop';
import { showToast } from '../common/toast';
import { showCardDetail } from './cardDetail';

export function createSendColumn(): HTMLElement {
  const list = h('div', { class: 'send-list' });
  const hint = h('p', { class: 'send-hint' }, '画面1のカードをここへドラッグすると画面2へ送られます。右クリック（iPad は長押し）でカードの内容を表示します。');
  const root = h('aside', { class: 'send-column', 'aria-label': '画面2へ送る' }, h('h2', { class: 'send-title' }, '画面2へ送る'), hint, list);

  registerDropTarget({
    el: root,
    accepts: (p) => p.origin === 'screen1',
    onDrop: (p) => {
      const card = findCard(store.data, p.cardId);
      if (!card) return;
      if (store.data.sent.includes(card.id)) {
        showToast('このカードはすでに送っています。', 'info');
        return;
      }
      const reason = sendBlockReason(card);
      if (reason) {
        showToast(reason, 'warn');
        return;
      }
      store.data.sent.push(card.id);
      store.commit();
    },
  });

  function render(): void {
    const data = store.data;
    const groups = CATEGORIES.map((cat) => {
      const items = data.cards
        .filter((c) => c.category === cat.id && data.sent.includes(c.id))
        .map((card) => {
          const placed = isPlaced(data, card.id);
          const item = h(
            'div',
            {
              class: `send-item${isIncomplete(card) ? ' incomplete' : ''}${placed ? ' placed' : ''}`,
              title: placed ? '画面2に配置済み' : '',
            },
            h('span', { class: 'send-label' }, card.label.trim() || '（ラベルなし）'),
            placed ? h('span', { class: 'placed-mark' }, '配置済み') : null,
          );
          makeDraggable(item, () => ({ kind: 'card', cardId: card.id, origin: 'send' }), () => card.label);
          openDetailOnContext(item, () => showCardDetail(card));
          return item;
        });
      if (items.length === 0) return null;
      return h('section', { class: 'send-group' }, h('h3', { class: 'send-group-title' }, cat.label), ...items);
    });
    list.replaceChildren(...groups.filter((g): g is HTMLElement => g !== null));
  }

  store.subscribe(render);
  render();
  return root;
}

/** 右クリック、または長押し（iPad）でカードの内容を表示する */
function openDetailOnContext(el: HTMLElement, open: () => void): void {
  el.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    open();
  });
  let timer: ReturnType<typeof setTimeout> | null = null;
  let sx = 0;
  let sy = 0;
  const cancel = () => {
    if (timer) clearTimeout(timer);
    timer = null;
  };
  el.addEventListener('pointerdown', (e) => {
    if (e.pointerType !== 'touch') return;
    sx = e.clientX;
    sy = e.clientY;
    timer = setTimeout(() => {
      timer = null;
      open();
    }, 550);
  });
  el.addEventListener('pointermove', (e) => {
    if (Math.hypot(e.clientX - sx, e.clientY - sy) > 10) cancel();
  });
  el.addEventListener('pointerup', cancel);
  el.addEventListener('pointercancel', cancel);
}
