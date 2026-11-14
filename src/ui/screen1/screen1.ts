// 画面1：単一の評価情報の解釈。カードを情報源の区分ごとにまとめて表示する。
import { deleteCard } from '../../model/caseData';
import { CATEGORIES, type Card, type SourceCategory } from '../../model/types';
import { store } from '../../store';
import { attachContextMenu } from '../common/contextMenu';
import { h } from '../common/dom';
import { CardView, type CardViewHooks } from './cardView';

export function createScreen1(): HTMLElement {
  const sections = new Map<SourceCategory, HTMLElement>();
  const views = new Map<HTMLElement, CardView>();

  const list = h('div', { class: 'screen1-list' });
  const root = h(
    'section',
    { class: 'screen1-body', 'aria-label': '画面1' },
    h('h1', { class: 'pane-title' }, '画面1：単一の評価情報の解釈'),
    list,
  );

  const hooks: CardViewHooks = {
    onCreate: (card, view) => {
      store.data.cards.push(card);
      // 書き始めたカードの後ろに、新しい空のカードを置く
      const section = view.el.parentElement;
      if (section) section.append(newView(null, card.category).el);
      store.commit();
    },
    onChange: () => store.commit(),
    onCategoryChange: (card, view) => {
      // 移動先の区分では入力した順の最後に並べる
      store.data.cards = store.data.cards.filter((c) => c !== card);
      store.data.cards.push(card);
      const target = sections.get(card.category);
      const blank = target?.lastElementChild;
      if (target && blank && blank !== view.el) {
        target.insertBefore(view.el, blank);
        view.focusCategory();
      }
    },
  };

  function newView(card: Card | null, category: SourceCategory): CardView {
    const view = new CardView(card, category, hooks);
    views.set(view.el, view);
    return view;
  }

  attachContextMenu(list, (target) => {
    const el = target instanceof Element ? target.closest('.card') : null;
    const view = el ? views.get(el as HTMLElement) : undefined;
    if (!view || view.blank) return null;
    return [
      {
        label: 'このカードを削除',
        danger: true,
        action: () => {
          const name = view.card.label.trim() || '（ラベルなし）';
          if (!window.confirm(`カード「${name}」を削除します。画面2に置いてある場合は画面2からも消え、矢印も消えます。よろしいですか？`)) return;
          deleteCard(store.data, view.card.id);
          views.delete(view.el);
          view.el.remove();
          store.commit();
        },
      },
    ];
  });

  function render(): void {
    list.replaceChildren();
    sections.clear();
    views.clear();
    for (const cat of CATEGORIES) {
      const cards = h('div', { class: 'cards' });
      sections.set(cat.id, cards);
      for (const card of store.data.cards.filter((c) => c.category === cat.id)) cards.append(newView(card, cat.id).el);
      cards.append(newView(null, cat.id).el);
      list.append(h('section', { class: 'category' }, h('h2', { class: 'category-title' }, cat.label), cards));
    }
  }

  store.subscribe((kind) => {
    if (kind === 'replace') render();
  });
  render();
  return root;
}
