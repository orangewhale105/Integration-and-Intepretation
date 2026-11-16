// 画面1のカード1枚分の表示と入力。種類（問題点・情報・診断名）によって入力欄が変わる。
// 「空のカード」は区分ごとの末尾に常に1枚置き、書き始めると新しいカードになる。
// カードは入力欄以外のどこをつかんでもドラッグでき、統合と解釈の画面へ直接置ける。
import { createCard, createRow, defaultKind } from '../../model/caseData';
import { CARD_KINDS, CATEGORIES, kindsFor, type Card, type CardKind, type ResultRow, type SourceCategory } from '../../model/types';
import { missingFields } from '../../model/validation';
import { autoGrow, h } from '../common/dom';
import { makeDraggable } from '../common/dragDrop';

export interface CardViewHooks {
  /** 空のカードに書き始めたとき：カードを登録する */
  onCreate: (card: Card, view: CardView) => void;
  /** 入力したとき */
  onChange: (card: Card) => void;
  /** 区分を変えたとき：該当する区分へ移動する */
  onCategoryChange: (card: Card, view: CardView, category: SourceCategory) => void;
  /** 種類を変えたとき */
  onKindChange: (card: Card, view: CardView, kind: CardKind) => void;
}

let fieldSeq = 0;

export class CardView {
  readonly el: HTMLElement;
  card: Card;
  blank: boolean;
  private rowsBody: HTMLElement = h('tbody');
  private body: HTMLElement;
  private warnIcon: HTMLElement;
  private placedMark: HTMLElement;
  private categorySelect: HTMLSelectElement;
  private kindSelect: HTMLSelectElement;
  private readonly uid = `c${++fieldSeq}`;

  constructor(card: Card | null, category: SourceCategory, private hooks: CardViewHooks) {
    this.blank = card === null;
    this.card = card ?? createCard(category, defaultKind(category));
    const uid = this.uid;

    this.categorySelect = h('select', { id: `${uid}-cat`, class: 'field-input' }) as HTMLSelectElement;
    for (const cat of CATEGORIES) {
      this.categorySelect.append(h('option', { value: cat.id, selected: cat.id === this.card.category }, cat.label));
    }
    this.categorySelect.addEventListener('change', () => {
      this.ensureCreated();
      this.hooks.onCategoryChange(this.card, this, this.categorySelect.value as SourceCategory);
      this.syncKind();
      this.changed();
    });

    this.kindSelect = h('select', { id: `${uid}-kind`, class: 'field-input' }) as HTMLSelectElement;
    this.kindSelect.addEventListener('change', () => {
      const kind = this.kindSelect.value as CardKind;
      // 空のカードは種類だけ変える（書き始めたときにカードになる）
      if (this.blank) this.card.kind = kind;
      else this.hooks.onKindChange(this.card, this, kind);
      this.syncKind();
      if (!this.blank) this.changed();
    });

    const handle = h('div', { class: 'card-handle', 'aria-hidden': 'true' }, '⠿');
    this.warnIcon = h('span', { class: 'warn-icon', role: 'img', 'aria-label': '入力不備' }, '!');
    this.placedMark = h('span', { class: 'placed-mark', title: 'このカードは統合と解釈の画面に置いてあります' }, '配置済み');
    this.placedMark.hidden = true;

    this.body = h('div', { class: 'card-body' });
    this.el = h(
      'article',
      { class: 'card' },
      h(
        'div',
        { class: 'card-head' },
        handle,
        this.field('情報源の区分', this.categorySelect),
        this.field('種類', this.kindSelect),
        this.placedMark,
        this.warnIcon,
      ),
      this.body,
    );
    makeDraggable(
      this.el,
      () => (this.blank ? null : { kind: 'card', cardId: this.card.id, origin: 'screen1' }),
      () => (this.card.kind === 'problem' ? this.card.label : this.card.name),
      { wholeArea: true },
    );
    this.syncKind();
  }

  /** 種類の選択肢と、種類に応じた入力欄を作り直す */
  private syncKind(): void {
    const kinds = kindsFor(this.card.category);
    this.kindSelect.replaceChildren(
      ...CARD_KINDS.filter((k) => kinds.includes(k.id)).map((k) => h('option', { value: k.id, selected: k.id === this.card.kind }, k.label)),
    );
    this.kindSelect.value = this.card.kind;
    if (this.body.dataset.kind !== this.card.kind) this.renderBody();
    this.refresh();
  }

  private renderBody(): void {
    const c = this.card;
    const uid = this.uid;
    this.body.dataset.kind = c.kind;
    this.el.dataset.kind = c.kind;
    if (c.kind === 'diagnosis') {
      const name = this.textInput(`${uid}-name`, c.name, (v) => (this.card.name = v), '例：変形性膝関節症');
      name.classList.add('label-input');
      this.body.replaceChildren(this.field('診断名', name));
      return;
    }
    const isProblem = c.kind === 'problem';
    this.rowsBody = h('tbody');
    const rowsTable = h(
      'table',
      { class: 'rows' },
      isProblem ? h('thead', {}, h('tr', {}, h('th', {}, '結果'), h('th', { class: 'ref-col' }, '基準値（任意）'))) : null,
      this.rowsBody,
    );
    for (const r of c.rows) this.rowsBody.append(this.rowEl(r, false, isProblem));
    this.rowsBody.append(this.rowEl(null, true, isProblem));

    if (!isProblem) {
      const name = this.textInput(`${uid}-name`, c.name, (v) => (this.card.name = v), '例：主訴、現病歴、Dr 情報');
      this.body.replaceChildren(
        this.field('項目名', name),
        h('div', { class: 'field' }, h('span', { class: 'field-label' }, '内容'), rowsTable),
      );
      return;
    }
    const name = this.textInput(`${uid}-name`, c.name, (v) => (this.card.name = v), '例：ROM');
    const criterion = this.textArea(`${uid}-crit`, c.criterion, (v) => (this.card.criterion = v), '例：参考可動域を下回れば可動域制限');
    const source = this.textInput(`${uid}-src`, c.source, (v) => (this.card.source = v), '文献名。出典がない場合は「自己定義」');
    const label = this.textInput(`${uid}-label`, c.label, (v) => (this.card.label = v), '例：膝関節可動域制限');
    label.classList.add('label-input');
    this.body.replaceChildren(
      this.field('検査名', name),
      h('div', { class: 'field' }, h('span', { class: 'field-label' }, '検査結果'), rowsTable),
      this.field('判定基準', criterion),
      this.field('出典', source),
      this.field('問題点のラベル', label),
    );
  }

  /** 入力不備の表示を更新する（空のカードには付けない） */
  refresh(): void {
    const missing = this.blank ? [] : missingFields(this.card);
    this.el.classList.toggle('blank', this.blank);
    this.el.classList.toggle('incomplete', missing.length > 0);
    this.warnIcon.hidden = missing.length === 0;
    this.warnIcon.title = missing.length ? `未入力：${missing.join('、')}` : '';
  }

  /** 統合と解釈の画面に置いたカードであることを表示する（カードは画面1に残る） */
  setPlaced(placed: boolean): void {
    this.el.classList.toggle('placed', placed);
    this.placedMark.hidden = !placed;
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

  /**
   * 検査結果の1行。表計算ソフトのように、末尾の空の行に書き始めると新しい行になる。
   * Enter で下の行へ（Shift+Enter で上の行へ）、↑↓ キーで上下の行へ移る。
   */
  private rowEl(row: ResultRow | null, isBlank: boolean, withRef: boolean): HTMLTableRowElement {
    let r = row ?? createRow();
    let blank = isBlank;
    const what = withRef ? '結果' : '内容';
    const result = h('input', { type: 'text', class: 'field-input', 'aria-label': what, 'data-col': 0, placeholder: blank ? `${what}を入力` : '' }) as HTMLInputElement;
    const ref = h('input', { type: 'text', class: 'field-input', 'aria-label': '基準値', 'data-col': 1 }) as HTMLInputElement;
    result.addEventListener('keydown', (e) => this.moveInRows(e, tr, 0));
    ref.addEventListener('keydown', (e) => this.moveInRows(e, tr, 1));
    result.value = r.result;
    ref.value = r.reference;
    const tr = h('tr', { class: blank ? 'row-blank' : '' }, h('td', {}, result), withRef ? h('td', { class: 'ref-col' }, ref) : null);

    const onInput = () => {
      if (blank) {
        blank = false;
        tr.classList.remove('row-blank');
        result.placeholder = '';
        this.ensureCreated();
        this.card.rows.push(r);
        this.rowsBody.append(this.rowEl(null, true, withRef));
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

  private moveInRows(e: KeyboardEvent, tr: HTMLTableRowElement, col: number): void {
    // 日本語入力の変換中の Enter は確定に使うため、移動しない
    if (e.isComposing || e.keyCode === 229) return;
    let step = 0;
    if (e.key === 'Enter') step = e.shiftKey ? -1 : 1;
    else if (e.key === 'ArrowDown') step = 1;
    else if (e.key === 'ArrowUp') step = -1;
    else return;
    e.preventDefault();
    const next = (step > 0 ? tr.nextElementSibling : tr.previousElementSibling) as HTMLTableRowElement | null;
    const input = next?.querySelector<HTMLInputElement>(`input[data-col="${col}"]`);
    if (!input) return;
    input.focus();
    input.select();
  }
}
