// A4 横の印刷。画面とは別に印刷用の表示を作り、ブラウザの印刷機能で出力する。
// カードの途中で改ページしない。文字を読めないほど縮小しない。
import { CATEGORIES, type Card, type CaseData } from '../model/types';
import { h } from '../ui/common/dom';

function cardBlock(card: Card): HTMLElement {
  const rows = card.rows.filter((r) => r.result.trim() !== '' || r.reference.trim() !== '');
  const showRef = rows.some((r) => r.reference.trim() !== '');
  return h(
    'div',
    { class: 'p-card' },
    h('div', { class: 'p-label' }, card.label || '（ラベルなし）'),
    h(
      'table',
      { class: 'p-fields' },
      h('tr', {}, h('th', {}, '検査名'), h('td', {}, card.name)),
      h('tr', {}, h('th', {}, '基準'), h('td', { class: 'pre' }, card.criterion)),
      h('tr', {}, h('th', {}, '出典'), h('td', {}, card.source)),
      h(
        'tr',
        {},
        h('th', {}, '結果'),
        h(
          'td',
          {},
          h(
            'table',
            { class: 'p-rows' },
            ...rows.map((r) => h('tr', {}, h('td', {}, r.result), showRef ? h('td', { class: 'p-ref' }, r.reference) : null)),
          ),
        ),
      ),
    ),
  );
}

export function buildScreen1Print(data: CaseData): HTMLElement {
  const page = h('section', { class: 'p-page' }, h('h1', { class: 'p-title' }, `評価情報のカード　${data.caseName}`));
  for (const cat of CATEGORIES) {
    const cards = data.cards.filter((c) => c.category === cat.id);
    if (cards.length === 0) continue;
    page.append(h('h2', { class: 'p-category' }, cat.label), h('div', { class: 'p-cards' }, ...cards.map(cardBlock)));
  }
  return page;
}

export function printCase(data: CaseData): void {
  document.getElementById('print-root')?.remove();
  const root = h('div', { id: 'print-root' }, buildScreen1Print(data));
  document.body.append(root);
  const cleanup = () => {
    root.remove();
    window.removeEventListener('afterprint', cleanup);
  };
  window.addEventListener('afterprint', cleanup);
  window.print();
}
