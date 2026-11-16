// 画面1：単一検査の解釈。カードを情報源の区分ごとにまとめて表示する。
import { deleteCard, isOnIcidh, setCardCategory, setCardKind } from '../../model/caseData';
import { CATEGORIES, type Card, type SourceCategory } from '../../model/types';
import { store } from '../../store';
import { attachContextMenu } from '../common/contextMenu';
import { h } from '../common/dom';
import { CardView, type CardViewHooks } from './cardView';
import { showToast } from '../common/toast';
import { selection } from '../selection';

export function createScreen1(): HTMLElement {
  const sections = new Map<SourceCategory, HTMLElement>();
  const views = new Map<HTMLElement, CardView>();

  const list = h('div', { class: 'screen1-list' });
  const root = h(
    'section',
    { class: 'screen1-body', 'aria-label': '単一検査の解釈' },
    h('h1', { class: 'pane-title' }, '単一検査の解釈'),
    h('p', { class: 'pane-note' }, '問題点・診断名のカードは、入力欄以外の部分をつかんで「統合と解釈」へドラッグして置きます。'),
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
    onCategoryChange: (card, view, category) => {
      if (setCardCategory(store.data, card, category)) {
        showToast('診断名のカードは医学的情報にしか置けないため、情報のカードにして統合と解釈から外しました。', 'info');
      }
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
    onKindChange: (card, _view, kind) => {
      if (setCardKind(store.data, card, kind)) {
        showToast('カードの種類を変えたため、統合と解釈から外しました。', 'info');
      }
    },
  };

  function newView(card: Card | null, category: SourceCategory): CardView {
    const view = new CardView(card, category, hooks);
    if (card) view.setPlaced(isOnIcidh(store.data, card.id));
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
          const c = view.card;
          const name = (c.kind === 'problem' ? c.label : c.name).trim() || '（名前なし）';
          if (!window.confirm(`カード「${name}」を削除します。統合と解釈の画面に置いてある場合はそこからも消え、矢印も消えます。よろしいですか？`)) return;
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

  // 統合と解釈で選んだカードを強調し、見える位置まで動かす
  const highlight = (cardId: string | null) => {
    list.querySelectorAll('.card.highlight').forEach((el) => el.classList.remove('highlight'));
    if (!cardId) return;
    const view = [...views.values()].find((v) => !v.blank && v.card.id === cardId);
    if (!view) return;
    view.el.classList.add('highlight');
    view.el.scrollIntoView({ block: 'center', behavior: 'smooth' });
  };
  selection.subscribe(highlight);

  store.subscribe((kind) => {
    if (kind === 'replace') {
      render();
      return highlight(selection.get());
    }
    for (const view of views.values()) if (!view.blank) view.setPlaced(isOnIcidh(store.data, view.card.id));
  });
  render();
  return root;
}
