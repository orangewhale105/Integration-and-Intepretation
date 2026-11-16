import { categoryLabel, type Card } from '../../model/types';
import { missingFields } from '../../model/validation';
import { showDialog } from '../common/dialog';
import { h } from '../common/dom';

const orEmpty = (s: string) => (s.trim() === '' ? h('span', { class: 'empty' }, '（未入力）') : s);

/** カードの全情報を表示する（統合と解釈の画面から参照する） */
export function showCardDetail(card: Card): void {
  const rows = card.rows.filter((r) => r.result.trim() !== '' || r.reference.trim() !== '');
  const showRef = rows.some((r) => r.reference.trim() !== '');
  const missing = missingFields(card);
  const body = h(
    'div',
    { class: 'card-detail' },
    missing.length ? h('p', { class: 'detail-warn' }, `未入力：${missing.join('、')}`) : null,
    h(
      'dl',
      {},
      h('dt', {}, '情報源の区分'), h('dd', {}, categoryLabel(card.category)),
      h('dt', {}, '検査名'), h('dd', {}, orEmpty(card.name)),
      h('dt', {}, '検査結果'),
      h(
        'dd',
        {},
        rows.length === 0
          ? orEmpty('')
          : h(
              'table',
              { class: 'rows' },
              h('thead', {}, h('tr', {}, h('th', {}, '結果'), showRef ? h('th', {}, '基準値') : null)),
              h('tbody', {}, ...rows.map((r) => h('tr', {}, h('td', {}, r.result), showRef ? h('td', {}, r.reference) : null))),
            ),
      ),
      h('dt', {}, '判定基準'), h('dd', { class: 'pre' }, orEmpty(card.criterion)),
      h('dt', {}, '出典'), h('dd', {}, orEmpty(card.source)),
      h('dt', {}, '問題点のラベル'), h('dd', { class: 'detail-label' }, orEmpty(card.label)),
    ),
  );
  showDialog('カードの内容', body);
}
