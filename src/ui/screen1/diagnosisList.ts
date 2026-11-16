// 医学的情報の先頭に置く診断名のリスト。
// 末尾の空の項目に書き始めると新しい診断名になる。項目をつかんで「疾患」の列へドラッグして置く。
import { createDiagnosis, deleteDiagnosis, isDiseasePlaced } from '../../model/caseData';
import type { Disease } from '../../model/types';
import { store } from '../../store';
import { attachContextMenu } from '../common/contextMenu';
import { h } from '../common/dom';
import { makeDraggable } from '../common/dragDrop';

export interface DiagnosisList {
  el: HTMLElement;
  /** 配置済みの表示を更新する */
  refresh: () => void;
}

export function createDiagnosisList(): DiagnosisList {
  const items = h('div', { class: 'diagnosis-items' });
  const el = h('div', { class: 'diagnosis-list' }, h('h3', { class: 'diagnosis-title' }, '診断名'), items);
  const entries = new Map<HTMLElement, { dx: Disease | null; mark: HTMLElement }>();

  function itemEl(dx: Disease | null): HTMLElement {
    let current = dx;
    const input = h('input', {
      type: 'text',
      class: 'field-input diagnosis-input',
      'aria-label': '診断名',
      placeholder: current ? '' : '診断名を入力',
    }) as HTMLInputElement;
    input.value = current?.name ?? '';
    const mark = h('span', { class: 'placed-mark', title: 'この診断名は統合と解釈の画面に置いてあります' }, '配置済み');
    mark.hidden = true;
    const item = h('div', { class: `diagnosis-item${current ? '' : ' blank'}` }, h('span', { class: 'card-handle', 'aria-hidden': 'true' }, '⠿'), input, mark);
    const entry = { dx: current, mark };
    entries.set(item, entry);

    input.addEventListener('input', () => {
      if (!current) {
        current = createDiagnosis();
        entry.dx = current;
        store.data.diagnoses.push(current);
        item.classList.remove('blank');
        input.placeholder = '';
        items.append(itemEl(null));
      }
      current.name = input.value;
      store.commit();
    });
    // 空にした診断名は、離れたときに取り除く（統合と解釈の画面に置いてあるものは残す）
    input.addEventListener('blur', () => {
      if (!current || current.name.trim() !== '' || isDiseasePlaced(store.data, current.id)) return;
      deleteDiagnosis(store.data, current.id);
      entries.delete(item);
      item.remove();
      store.commit();
    });
    makeDraggable(
      item,
      () => (current ? { kind: 'disease', id: current.id, origin: 'screen1' } : null),
      () => current?.name ?? '',
      { wholeArea: true },
    );
    return item;
  }

  attachContextMenu(items, (target) => {
    const item = target instanceof Element ? target.closest<HTMLElement>('.diagnosis-item') : null;
    const entry = item ? entries.get(item) : undefined;
    const dx = entry?.dx;
    if (!item || !dx) return null;
    return [
      {
        label: 'この診断名を削除',
        danger: true,
        action: () => {
          const name = dx.name.trim() || '（診断名なし）';
          if (!window.confirm(`診断名「${name}」を削除します。統合と解釈の画面に置いてある場合はそこからも消え、矢印も消えます。よろしいですか？`)) return;
          deleteDiagnosis(store.data, dx.id);
          entries.delete(item);
          item.remove();
          store.commit();
        },
      },
    ];
  });

  function refresh(): void {
    for (const [item, { dx, mark }] of entries) {
      const placed = !!dx && isDiseasePlaced(store.data, dx.id);
      mark.hidden = !placed;
      item.classList.toggle('placed', placed);
    }
  }

  for (const dx of store.data.diagnoses) items.append(itemEl(dx));
  items.append(itemEl(null));
  refresh();
  return { el, refresh };
}
