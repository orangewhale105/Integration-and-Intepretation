// A4 横の印刷。画面とは別に印刷用の表示を作り、ブラウザの印刷機能で出力する。
// カードの途中で改ページしない。文字を読めないほど縮小しない。
import { findCard } from '../model/caseData';
import { numbering, problemList } from '../model/icidh';
import { CATEGORIES, STAGES, type Card, type CaseData } from '../model/types';
import { h } from '../ui/common/dom';
import { anchorPoints, createArrowLayer, curve, svg } from '../ui/screen2/arrows';

/** A4 横・余白 10mm の印刷範囲（96dpi 換算の px） */
const PAGE_W = 1040;
const PAGE_H = 710;

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

const PRINT_MARKER = 'print-arrow-head';

/** 画面2の印刷：ICIDH の図（分割せず1ページに収める）と問題点リスト */
function buildScreen2Print(data: CaseData): { page: HTMLElement; finish: () => void } {
  const nums = numbering(data);
  const col = (title: string, nodes: HTMLElement[]) =>
    h('div', { class: 'p-col' }, h('div', { class: 'p-col-title' }, title), h('div', { class: 'p-col-body' }, ...nodes));
  const diseaseCol = col(
    '疾患・変調',
    data.icidh.diseases.map((d) =>
      h('div', { class: 'p-node', 'data-disease-id': d.id }, h('b', {}, `D${nums.disease.get(d.id)} `), d.name),
    ),
  );
  const stageCols = STAGES.map((s) =>
    col(
      s.label,
      data.icidh.columns[s.id].map((id) =>
        h('div', { class: 'p-node', 'data-card-id': id }, h('b', {}, `#${nums.card.get(id)} `), findCard(data, id)?.label || '（ラベルなし）'),
      ),
    ),
  );
  const columns = h('div', { class: 'p-icidh-cols' }, diseaseCol, ...stageCols);
  const diagram = h('div', { class: 'p-icidh' }, columns);
  const frame = h('div', { class: 'p-icidh-frame' }, diagram);

  const items = problemList(data);
  const list = h(
    'div',
    { class: 'p-problems' },
    h('h2', { class: 'p-category' }, '問題点リスト'),
    ...items.map((it) =>
      h('div', { class: 'p-problem' }, h('div', { class: 'p-problem-heading' }, it.heading), ...it.notes.map((n) => h('div', { class: 'p-problem-note' }, n))),
    ),
    ...data.icidh.diseases.map((d) => h('div', { class: 'p-problem p-disease' }, `D${nums.disease.get(d.id)} ${d.name}`)),
  );
  const title = h('h1', { class: 'p-title' }, `ICIDH による統合と解釈　${data.caseName}`);
  const page = h('section', { class: 'p-page p-page-icidh' }, title, frame, list);

  // 配置が決まってから矢印を引き、1ページに収まるよう縮小する
  const finish = () => {
    const layer = createArrowLayer(PRINT_MARKER);
    diagram.prepend(layer);
    layer.setAttribute('width', String(diagram.scrollWidth));
    layer.setAttribute('height', String(diagram.scrollHeight));
    for (const link of data.icidh.links) {
      const fromSel = link.from.kind === 'disease' ? `[data-disease-id="${link.from.id}"]` : `[data-card-id="${link.from.id}"]`;
      const fromEl = columns.querySelector(fromSel);
      const toEl = columns.querySelector(`[data-card-id="${link.toCardId}"]`);
      if (!fromEl || !toEl) continue;
      layer.append(svg('path', { d: curve(...anchorPoints(diagram, fromEl, toEl)), class: 'arrow-line', 'marker-end': `url(#${PRINT_MARKER})` }));
    }
    const available = PAGE_H - title.offsetHeight - 8;
    const scale = Math.min(1, available / diagram.offsetHeight);
    if (scale < 1) {
      diagram.style.transform = `scale(${scale})`;
      diagram.style.transformOrigin = 'top left';
      frame.style.height = `${diagram.offsetHeight * scale}px`;
      frame.style.width = `${PAGE_W * scale}px`;
    }
  };
  return { page, finish };
}

export function printCase(data: CaseData): void {
  document.getElementById('print-root')?.remove();
  const screen2 = buildScreen2Print(data);
  const root = h('div', { id: 'print-root', class: 'measuring' }, buildScreen1Print(data), screen2.page);
  document.body.append(root);
  screen2.finish();
  root.classList.remove('measuring');
  const cleanup = () => {
    root.remove();
    window.removeEventListener('afterprint', cleanup);
  };
  window.addEventListener('afterprint', cleanup);
  window.print();
}
