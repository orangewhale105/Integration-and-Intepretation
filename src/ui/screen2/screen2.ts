// 画面2：ICIDH による統合と解釈。
// 送り欄のカードを各段階の列へ置き、原因 → 結果の向きに矢印を引く。
// 画面1でラベリングした問題点以外は置けない（問題点を新しく作る手段は設けない）。
import { findCard } from '../../model/caseData';
import { addLink, deleteDisease, numbering, placeCard, problemList, refName, removeFromIcidh } from '../../model/icidh';
import { newId } from '../../model/id';
import { STAGES, type IcidhStage, type NodeRef } from '../../model/types';
import { isIncomplete } from '../../model/validation';
import { store } from '../../store';
import { attachContextMenu } from '../common/contextMenu';
import { h } from '../common/dom';
import { makeDraggable, registerDropTarget } from '../common/dragDrop';
import { showToast } from '../common/toast';
import { showCardDetail } from '../screen1/cardDetail';
import { anchorPoints, createArrowLayer, curve, svg } from './arrows';
import { showLinkDialog } from './linkDialog';

const MARKER_ID = 'icidh-arrow-head';

export function createScreen2(): HTMLElement {
  const columns = h('div', { class: 'icidh-columns' });
  const layer = createArrowLayer(MARKER_ID);
  const diagram = h('div', { class: 'icidh-diagram' }, columns);
  diagram.prepend(layer);
  const list = h('div', { class: 'problem-list' });
  const root = h(
    'section',
    { class: 'screen2', 'aria-label': '画面2' },
    h('h1', { class: 'pane-title' }, '画面2：ICIDH による統合と解釈'),
    h(
      'p',
      { class: 'screen2-note' },
      h('strong', {}, '各列では、上に置いたカードほど重要度が高いことを表します。'),
      ' 送り欄のカードをドラッグして列に置き、カードの右端の ● から原因 → 結果の向きに矢印を引きます。',
    ),
    diagram,
    list,
  );

  /** 描き直すたびにドロップ先を登録し直す */
  let unregister: Array<() => void> = [];
  const addDropTarget = (t: Parameters<typeof registerDropTarget>[0]) => unregister.push(registerDropTarget(t));

  /** 再描画のあとに入力欄へフォーカスを戻すための目印 */
  let focusAfterRender: string | null = null;

  // ---- 疾患・変調（直接入力。末尾の空の枠に書き始めると新しい枠になる） ----
  function diseaseColumn(): HTMLElement {
    const nums = numbering(store.data);
    const body = h('div', { class: 'col-body' });
    for (const d of store.data.icidh.diseases) {
      const input = h('input', {
        type: 'text',
        class: 'field-input disease-input',
        'data-focus-key': `disease:${d.id}`,
        'aria-label': `D${nums.disease.get(d.id)} 疾患名`,
      }) as HTMLInputElement;
      input.value = d.name;
      input.addEventListener('input', () => {
        d.name = input.value;
        focusAfterRender = `disease:${d.id}`;
        store.commit();
      });
      const box = h(
        'div',
        { class: 'disease-box node', 'data-disease-id': d.id },
        h('span', { class: 'node-num' }, `D${nums.disease.get(d.id)}`),
        input,
        connector({ kind: 'disease', id: d.id }),
      );
      body.append(box);
    }
    const blank = h('input', {
      type: 'text',
      class: 'field-input disease-input',
      placeholder: '疾患名を入力',
      'data-focus-key': 'disease:blank',
      'aria-label': '新しい疾患名',
    }) as HTMLInputElement;
    blank.addEventListener('input', () => {
      const d = { id: newId(), name: blank.value };
      store.data.icidh.diseases.push(d);
      focusAfterRender = `disease:${d.id}`;
      store.commit();
    });
    body.append(h('div', { class: 'disease-box blank' }, blank));

    const col = h('div', { class: 'icidh-col', 'data-stage': 'disease' }, h('h2', { class: 'col-title' }, '疾患・変調'), body);
    addDropTarget({
      el: col,
      accepts: (p) => p.kind === 'card',
      onDrop: () => showToast('「疾患・変調」は問題点ではないため、カードは置けません。疾患名は直接入力してください。'),
    });
    return col;
  }

  // ---- 機能障害・能力障害・社会的不利（カードを置く列） ----
  function stageColumn(stage: IcidhStage, title: string): HTMLElement {
    const nums = numbering(store.data);
    const body = h('div', { class: 'col-body' });
    for (const cardId of store.data.icidh.columns[stage]) {
      const card = findCard(store.data, cardId);
      if (!card) continue;
      const chip = h(
        'div',
        { class: `icidh-card node${isIncomplete(card) ? ' incomplete' : ''}`, 'data-card-id': cardId },
        h('span', { class: 'node-num' }, `#${nums.card.get(cardId)}`),
        h('span', { class: 'node-label' }, card.label.trim() || '（ラベルなし）'),
        stage === 'handicap' ? null : connector({ kind: 'card', id: cardId }),
      );
      makeDraggable(chip, () => ({ kind: 'card', cardId, origin: 'icidh' }), () => card.label);
      body.append(chip);
    }
    const indicator = h('div', { class: 'drop-line' });
    const col = h('div', { class: 'icidh-col', 'data-stage': stage }, h('h2', { class: 'col-title' }, title), body);

    const indexAt = (y: number) => {
      const chips = [...body.querySelectorAll<HTMLElement>('.icidh-card')];
      const i = chips.findIndex((c) => {
        const r = c.getBoundingClientRect();
        return y < r.top + r.height / 2;
      });
      return i === -1 ? chips.length : i;
    };
    addDropTarget({
      el: col,
      accepts: (p) => p.kind === 'card' && (p.origin === 'send' || p.origin === 'icidh'),
      onOver: (_p, _x, y) => {
        const chips = body.querySelectorAll('.icidh-card');
        const i = indexAt(y);
        if (i < chips.length) body.insertBefore(indicator, chips[i]);
        else body.append(indicator);
      },
      onLeave: () => indicator.remove(),
      onDrop: (p, _x, y) => {
        const index = indexAt(y);
        indicator.remove();
        const removed = placeCard(store.data, p.cardId, stage, index);
        store.commit();
        if (removed > 0) showToast(`段階が変わったため、ルールに合わなくなった矢印を ${removed} 本消しました。`, 'info');
      },
    });
    return col;
  }

  // ---- 矢印を引く操作（● から相手のカードまでドラッグ） ----
  function connector(from: NodeRef): HTMLElement {
    const dot = h('span', { class: 'connector', title: 'ドラッグして矢印を引く', 'aria-label': '矢印を引く' });
    dot.style.touchAction = 'none';
    dot.addEventListener('pointerdown', (down) => {
      if (down.button !== 0) return;
      down.preventDefault();
      down.stopPropagation();
      const temp = svg('path', { class: 'arrow-temp', 'marker-end': `url(#${MARKER_ID})` });
      layer.append(temp);
      const base = diagram.getBoundingClientRect();
      const a = dot.getBoundingClientRect();
      const x1 = a.left + a.width / 2 - base.left;
      const y1 = a.top + a.height / 2 - base.top;
      document.body.classList.add('is-linking');
      const move = (e: PointerEvent) => {
        const b = diagram.getBoundingClientRect();
        temp.setAttribute('d', curve(x1, y1, e.clientX - b.left, e.clientY - b.top));
      };
      const finish = (e: PointerEvent, cancelled: boolean) => {
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', up);
        window.removeEventListener('pointercancel', cancel);
        temp.remove();
        document.body.classList.remove('is-linking');
        if (cancelled) return;
        const target = document.elementFromPoint(e.clientX, e.clientY)?.closest<HTMLElement>('.icidh-card');
        if (!target || !root.contains(target)) return;
        const result = addLink(store.data, from, target.dataset.cardId!);
        if (typeof result === 'string') showToast(result);
        else store.commit();
      };
      const up = (e: PointerEvent) => finish(e, false);
      const cancel = (e: PointerEvent) => finish(e, true);
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', up);
      window.addEventListener('pointercancel', cancel);
    });
    return dot;
  }

  // ---- 右クリック（iPad は長押し）のメニュー ----
  attachContextMenu(columns, (target) => {
    const el = target instanceof Element ? target : null;
    const chip = el?.closest<HTMLElement>('.icidh-card');
    if (chip) {
      const card = findCard(store.data, chip.dataset.cardId!);
      if (!card) return null;
      return [
        { label: 'カードの内容を見る', action: () => showCardDetail(card) },
        {
          label: '画面2から外す',
          danger: true,
          action: () => {
            removeFromIcidh(store.data, card.id);
            store.commit();
          },
        },
      ];
    }
    const box = el?.closest<HTMLElement>('.disease-box');
    const id = box?.dataset.diseaseId;
    if (id) {
      return [
        {
          label: 'この疾患を削除',
          danger: true,
          action: () => {
            deleteDisease(store.data, id);
            store.commit();
          },
        },
      ];
    }
    return null;
  });

  // ---- 矢印の描画 ----
  function drawArrows(): void {
    layer.querySelectorAll('.arrow').forEach((n) => n.remove());
    layer.setAttribute('width', String(diagram.scrollWidth));
    layer.setAttribute('height', String(diagram.scrollHeight));
    const nums = numbering(store.data);
    for (const link of store.data.icidh.links) {
      const fromSel = link.from.kind === 'disease' ? `[data-disease-id="${link.from.id}"]` : `[data-card-id="${link.from.id}"]`;
      const fromEl = columns.querySelector(fromSel);
      const toEl = columns.querySelector(`[data-card-id="${link.toCardId}"]`);
      if (!fromEl || !toEl) continue;
      const d = curve(...anchorPoints(diagram, fromEl, toEl));
      const g = svg('g', { class: 'arrow' });
      g.append(svg('path', { d, class: 'arrow-line', 'marker-end': `url(#${MARKER_ID})` }));
      const hit = svg('path', { d, class: 'arrow-hit' });
      const title = `${refName(nums, link.from)} → #${nums.card.get(link.toCardId)} のつながり`;
      hit.addEventListener('click', () =>
        showLinkDialog(
          title,
          link.note,
          (v) => {
            link.note = v;
            store.commit();
          },
          () => {
            store.data.icidh.links = store.data.icidh.links.filter((l) => l !== link);
            store.commit();
          },
        ),
      );
      g.append(hit);
      layer.append(g);
    }
  }

  // ---- 問題点リスト（配置と矢印から自動で作る） ----
  function renderList(): void {
    const items = problemList(store.data);
    const nums = numbering(store.data);
    const diseases = store.data.icidh.diseases;
    list.replaceChildren(
      h('h2', { class: 'list-title' }, '問題点リスト'),
      items.length === 0 && diseases.length === 0
        ? h('p', { class: 'placeholder' }, 'カードを置くと、ここに問題点リストが作られます。')
        : h(
            'ul',
            { class: 'problems' },
            ...items.map((it) =>
              h(
                'li',
                {},
                h('div', { class: 'problem-heading' }, it.heading),
                ...it.notes.map((n) => h('div', { class: 'problem-note' }, n)),
              ),
            ),
            ...diseases.map((d) => h('li', { class: 'disease-item' }, `D${nums.disease.get(d.id)} ${d.name.trim() || '（疾患名なし）'}`)),
          ),
    );
  }

  function render(): void {
    const active = document.activeElement as HTMLElement | null;
    const key = focusAfterRender ?? (active && root.contains(active) ? active.dataset.focusKey : undefined);
    const sel = active instanceof HTMLInputElement ? [active.selectionStart, active.selectionEnd] : null;
    focusAfterRender = null;

    unregister.forEach((f) => f());
    unregister = [];
    columns.replaceChildren(diseaseColumn(), ...STAGES.map((s) => stageColumn(s.id, s.label)));
    renderList();
    requestAnimationFrame(drawArrows);

    if (key) {
      const el = root.querySelector<HTMLInputElement>(`[data-focus-key="${key}"]`);
      if (el) {
        el.focus();
        if (sel) el.setSelectionRange(sel[0], sel[1]);
      }
    }
  }

  new ResizeObserver(() => drawArrows()).observe(diagram);
  store.subscribe(render);
  render();
  return root;
}

