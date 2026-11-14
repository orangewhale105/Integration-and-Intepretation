// 矢印をクリック（iPad はタップ）したときに開く、説明の表示・編集と削除
import { showDialog } from '../common/dialog';
import { autoGrow, h } from '../common/dom';

export function showLinkDialog(title: string, note: string, onNote: (v: string) => void, onDelete: () => void): void {
  const ta = h('textarea', {
    class: 'field-input link-note',
    rows: 3,
    'aria-label': 'なぜつながるかの説明',
    placeholder: '例：大腿四頭筋の筋出力低下により、立脚期に膝折れを防げない',
  }) as HTMLTextAreaElement;
  ta.value = note;
  ta.addEventListener('input', () => {
    autoGrow(ta);
    onNote(ta.value);
  });
  const del = h('button', { type: 'button', class: 'btn btn-danger' }, 'この矢印を削除');
  const body = h(
    'div',
    { class: 'link-dialog' },
    h('label', { class: 'field-label' }, 'なぜつながるかの説明（任意）'),
    ta,
    h('div', { class: 'link-dialog-delete' }, del),
  );
  const close = showDialog(title, body);
  del.addEventListener('click', () => {
    onDelete();
    close();
  });
  requestAnimationFrame(() => {
    autoGrow(ta);
    ta.focus();
  });
}
