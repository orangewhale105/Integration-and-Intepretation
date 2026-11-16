// 画面1：単一検査結果の解釈。カードを情報源の区分ごとにまとめて表示する。
import { deleteCard, isPlaced } from '../../model/caseData';
import { CATEGORIES, type Card, type SourceCategory } from '../../model/types';
import { store } from '../../store';
import { attachContextMenu } from '../common/contextMenu';
import { h } from '../common/dom';
import { CardView, type CardViewHooks } from './cardView';
import { createDiagnosisList, type DiagnosisList } from './diagnosisList';

export function createScreen1(): HTMLElement {
  const sections = new Map<SourceCategory, HTMLElement>();
  const views = new Map<HTMLElement, CardView>();

  const list = h('div', { class: 'screen1-list' });
  const root = h(
    'section',
    { class: 'screen1-body', 'aria-label': '単一検査結果の解釈' },
    h('h1', { class: 'pane-title' }, '単一検査結果の解釈'),
    h('p', { class: 'pane-note' }, 'カードや診断名は、入力欄以外の部分をつかんで「統合と解釈」へドラッグして置きます。'),
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
    if (card) view.setPlaced(isPlaced(store.data, card.id));
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
          if (!window.confirm(`カード「${name}」を削除します。統合と解釈の画面に置いてある場合はそこからも消え、矢印も消えます。よろしいですか？`)) return;
          deleteCard(store.data, view.card.id);
          views.delete(view.el);
          view.el.remove();
          store.commit();
        },
      },
    ];
  });

  let diagnoses: DiagnosisList | null = null;

  function render(): void {
    list.replaceChildren();
    sections.clear();
    views.clear();
    for (const cat of CATEGORIES) {
      const cards = h('div', { class: 'cards' });
      sections.set(cat.id, cards);
      for (const card of store.data.cards.filter((c) => c.category === cat.id)) cards.append(newView(card, cat.id).el);
      cards.append(newView(null, cat.id).el);
      const section = h('section', { class: 'category' }, h('h2', { class: 'category-title' }, cat.label));
      // 診断名は医学的情報の先頭に入力する
      if (cat.id === 'medical') {
        diagnoses = createDiagnosisList();
        section.append(diagnoses.el);
      }
      section.append(cards);
      list.append(section);
    }
  }

  store.subscribe((kind) => {
    if (kind === 'replace') return render();
    for (const view of views.values()) if (!view.blank) view.setPlaced(isPlaced(store.data, view.card.id));
    diagnoses?.refresh();
  });
  render();
  return root;
}
