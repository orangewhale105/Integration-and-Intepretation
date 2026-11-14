// 画面1のカード1枚分の表示と入力。
// 「空のカード」は区分ごとの末尾に常に1枚置き、書き始めると新しいカードになる。
import { createCard, createRow } from '../../model/caseData';
import { CATEGORIES, type Card, type ResultRow, type SourceCategory } from '../../model/types';
import { missingFields } from '../../model/validation';
import { autoGrow, h } from '../common/dom';
import { makeDraggable } from '../common/dragDrop';

export interface CardViewHooks {
  /** 空のカードに書き始めたとき：カードを登録する */
  onCreate: (card: Card, view: CardView) => void;
  /** 入力したとき */
  onChange: (card: Card) => void;
  /** 区分を変えたとき：該当する区分へ移動する */
  onCategoryChange: (card: Card, view: CardView) => void;
}

let fieldSeq = 0;

export class CardView {
  readonly el: HTMLElement;
  card: Card;
  blank: boolean;
  private rowsBody: HTMLElement;
  private warnIcon: HTMLElement;
  private categorySelect: HTMLSelectElement;

  constructor(card: Card | null, category: SourceCategory, private hooks: CardViewHooks) {
    this.blank = card === null;
    this.card = card ?? createCard(category);
    const c = this.card;
    const uid = `c${++fieldSeq}`;

    this.categorySelect = h('select', { id: `${uid}-cat`, class: 'field-input' }) as HTMLSelectElement;
    for (const cat of CATEGORIES) {
      this.categorySelect.append(h('option', { value: cat.id, selected: cat.id === c.category }, cat.label));
    }
    this.categorySelect.addEventListener('change', () => {
      this.ensureCreated();
      this.card.category = this.categorySelect.value as SourceCategory;
      this.hooks.onCategoryChange(this.card, this);
      this.changed();
    });

    const handle = h('div', { class: 'card-handle', title: 'ドラッグして「画面2へ送る」欄へ置く', 'aria-label': 'つかんで移動' }, '⠿');
    makeDraggable(
      handle,
      () => (this.blank ? null : { kind: 'card', cardId: this.card.id, origin: 'screen1' }),
      () => this.card.label,
    );

    this.warnIcon = h('span', { class: 'warn-icon', role: 'img', 'aria-label': '入力不備' }, '!');

    const name = this.textInput(`${uid}-name`, c.name, (v) => (this.card.name = v), '例：ROM');
    const criterion = this.textArea(`${uid}-crit`, c.criterion, (v) => (this.card.criterion = v), '例：参考可動域を下回れば可動域制限');
    const source = this.textInput(`${uid}-src`, c.source, (v) => (this.card.source = v), '文献名。出典がない場合は「自己定義」');
    const label = this.textInput(`${uid}-label`, c.label, (v) => (this.card.label = v), '例：膝関節可動域制限');
    label.classList.add('label-input');

    this.rowsBody = h('tbody');
    const rowsTable = h(
      'table',
      { class: 'rows' },
      h('thead', {}, h('tr', {}, h('th', {}, '結果'), h('th', { class: 'ref-col' }, '基準値（任意）'))),
      this.rowsBody,
    );
    for (const r of c.rows) this.rowsBody.append(this.rowEl(r, false));
    this.rowsBody.append(this.rowEl(null, true));

    this.el = h(
      'article',
      { class: 'card' },
      h('div', { class: 'card-head' }, handle, this.field('情報源の区分', this.categorySelect), this.warnIcon),
      this.field('検査名（情報の名称）', name),
      this.field('基準（判定規則）', criterion),
      this.field('出典', source),
      h('div', { class: 'field' }, rowsTable),
      this.field('問題点ラベル', label),
    );
    this.refresh();
  }

  /** 入力不備の表示を更新する（空のカードには付けない） */
  refresh(): void {
    const missing = this.blank ? [] : missingFields(this.card);
    this.el.classList.toggle('blank', this.blank);
    this.el.classList.toggle('incomplete', missing.length > 0);
    this.warnIcon.hidden = missing.length === 0;
    this.warnIcon.title = missing.length ? `未入力：${missing.join('、')}` : '';
  }

  focusCategory(): void {
    this.categorySelect.focus();
  }

  private ensureCreated(): void {
    if (!this.blank) return;
    this.blank = false;
    this.hooks.onCreate(this.card, this);
  }

  private changed(): void {
    this.refresh();
    this.hooks.onChange(this.card);
  }

  private field(label: string, input: HTMLElement): HTMLElement {
    return h('div', { class: 'field' }, h('label', { class: 'field-label', for: input.id }, label), input);
  }

  private textInput(id: string, value: string, set: (v: string) => void, placeholder: string): HTMLInputElement {
    const el = h('input', { id, type: 'text', class: 'field-input', placeholder }) as HTMLInputElement;
    el.value = value;
    el.addEventListener('input', () => {
      this.ensureCreated();
      set(el.value);
      this.changed();
    });
    return el;
  }

  private textArea(id: string, value: string, set: (v: string) => void, placeholder: string): HTMLTextAreaElement {
    const el = h('textarea', { id, class: 'field-input', rows: 1, placeholder }) as HTMLTextAreaElement;
    el.value = value;
    requestAnimationFrame(() => autoGrow(el));
    el.addEventListener('input', () => {
      autoGrow(el);
      this.ensureCreated();
      set(el.value);
      this.changed();
    });
    return el;
  }

  /** 結果の1行。末尾の空の行に書き始めると新しい行になる */
  private rowEl(row: ResultRow | null, isBlank: boolean): HTMLTableRowElement {
    let r = row ?? createRow();
    let blank = isBlank;
    const result = h('input', { type: 'text', class: 'field-input', 'aria-label': '結果', placeholder: blank ? '結果を入力' : '' }) as HTMLInputElement;
    const ref = h('input', { type: 'text', class: 'field-input', 'aria-label': '基準値' }) as HTMLInputElement;
    result.value = r.result;
    ref.value = r.reference;
    const tr = h('tr', { class: blank ? 'row-blank' : '' }, h('td', {}, result), h('td', { class: 'ref-col' }, ref));

    const onInput = () => {
      if (blank) {
        blank = false;
        tr.classList.remove('row-blank');
        result.placeholder = '';
        this.ensureCreated();
        this.card.rows.push(r);
        this.rowsBody.append(this.rowEl(null, true));
      }
      r.result = result.value;
      r.reference = ref.value;
      this.changed();
    };
    result.addEventListener('input', onInput);
    ref.addEventListener('input', onInput);

    // 空にした行は、行から離れたときに取り除く（末尾の空の行は残す）
    tr.addEventListener('focusout', (e) => {
      if (blank || tr.contains(e.relatedTarget as Node)) return;
      if (r.result.trim() === '' && r.reference.trim() === '') {
        this.card.rows = this.card.rows.filter((x) => x !== r);
        tr.remove();
        this.changed();
        r = createRow();
      }
    });
    return tr;
  }
}
