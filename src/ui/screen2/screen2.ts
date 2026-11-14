// 画面2：ICIDH による統合と解釈（次の段階で実装する）
import { h } from '../common/dom';

export function createScreen2(): HTMLElement {
  return h(
    'section',
    { class: 'screen2', 'aria-label': '画面2' },
    h('h1', { class: 'pane-title' }, '画面2：ICIDH による統合と解釈'),
    h('p', { class: 'placeholder' }, '画面2は現在作成中です。'),
  );
}
