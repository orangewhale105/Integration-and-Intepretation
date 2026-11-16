// 画面2：統合と解釈（ICIDH）。
// 画面1のカード・診断名を各列へ直接ドラッグして置き、原因 → 結果の向きに矢印を引く。
// 画面1でラベリングした問題点以外は置けない（問題点を新しく作る手段は設けない）。
import { findCard, findDiagnosis } from '../../model/caseData';
import { addLink, numbering, placeCard, placeDisease, problemList, refName, removeDiseaseFromIcidh, removeFromIcidh } from '../../model/icidh';
import { STAGES, type IcidhStage, type NodeRef } from '../../model/types';
import { isIncomplete, placeBlockReason } from '../../model/validation';
import { store } from '../../store';
import { attachContextMenu } from '../common/contextMenu';
import { h } from '../common/dom';
import { makeDraggable, registerDropTarget } from '../common/dragDrop';
import { showToast } from '../common/toast';
import { showCardDetail } from '../screen1/cardDetail';
import { anchorPoints, createArrowLayer, curve, curveMidpoint, svg } from './arrows';
import { showLinkDialog } from './linkDialog';

const MARKER_ID = 'icidh-arrow-head';
/** 図の上に出す、矢印の説明の文字数 */
const NOTE_PREVIEW = 8;

export function createScreen2(): HTMLElement {
  const columns = h('div', { class: 'icidh-columns' });
  const layer = createArrowLayer(MARKER_ID);
  /** 矢印の説明の冒頭を、矢印の中ほどに出す */
  const notes = h('div', { class: 'arrow-notes' });
  const diagram = h('div', { class: 'icidh-diagram' }, columns, notes);
  diagram.prepend(layer);
  const list = h('div', { class: 'problem-list' });
  const root = h(
    'section',
    { class: 'screen2', 'aria-label': '統合と解釈' },
    h('h1', { class: 'pane-title' }, '統合と解釈'),
    h(
      'p',
      { class: 'screen2-note' },
      h('strong', {}, '各列では、上に置いたカードほど重要度が高いことを表します。'),
      ' 左の画面のカード・診断名をドラッグして列に置き、右端の ● から原因 → 結果の向きに矢印を引きます。矢印の説明は、矢印か説明をクリック（iPad はタップ）すると表示・編集できます。',
    ),
    diagram,
    list,
  );

  /** 描き直すたびにドロップ先を登録し直す */
  let unregister: Array<() => void> = [];
  const addDropTarget = (t: Parameters<typeof registerDropTarget>[0]) => unregister.push(registerDropTarget(t));

  /** 列の中で、y の位置に置いたときの順番 */
  const indexAt = (body: HTMLElement, selector: string, y: number) => {
    const items = [...body.querySelectorAll<HTMLElement>(selector)];
    const i = items.findIndex((c) => {
      const r = c.getBoundingClientRect();
      return y < r.top + r.height / 2;
    });
    return i === -1 ? items.length : i;
  };
  const showDropLine = (body: HTMLElement, indicator: HTMLElement, selector: string, y: number) => {
    const items = body.querySelectorAll(selector);
    const i = indexAt(body, selector, y);
    if (i < items.length) body.insertBefore(indicator, items[i]);
    else body.append(indicator);
  };

  // ---- 疾患（画面1の医学的情報で入力した診断名を置く） ----
  function diseaseColumn(): HTMLElement {
    const nums = numbering(store.data);
    const body = h('div', { class: 'col-body' });
    for (const id of store.data.icidh.diseases) {
      const dx = findDiagnosis(store.data, id);
      if (!dx) continue;
      const box = h(
        'div',
        { class: `disease-box node${dx.name.trim() === '' ? ' incomplete' : ''}`, 'data-disease-id': id },
        h('span', { class: 'node-num' }, `D${nums.disease.get(id)}`),
        h('span', { class: 'node-label' }, dx.name.trim() || '（診断名なし）'),
        connector({ kind: 'disease', id }),
      );
      makeDraggable(box, () => ({ kind: 'disease', id, origin: 'icidh' }), () => dx.name);
      body.append(box);
    }
    const indicator = h('div', { class: 'drop-line' });
    const col = h('div', { class: 'icidh-col', 'data-stage': 'disease' }, h('h2', { class: 'col-title' }, '疾患'), body);
    addDropTarget({
      el: col,
      accepts: () => true,
      onOver: (p, _x, y) => {
        if (p.kind === 'disease') showDropLine(body, indicator, '.disease-box', y);
      },
      onLeave: () => indicator.remove(),
      onDrop: (p, _x, y) => {
        indicator.remove();
        if (p.kind === 'card') {
          showToast('「疾患」の列にはカードは置けません。診断名は医学的情報に入力してから、ここへドラッグしてください。');
          return;
        }
        const dx = findDiagnosis(store.data, p.id);
        if (!dx) return;
        if (dx.name.trim() === '') {
          showToast('診断名が空のため置けません。入力してから置いてください。', 'warn');
          return;
        }
        placeDisease(store.data, p.id, indexAt(body, '.disease-box', y));
        store.commit();
      },
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

    addDropTarget({
      el: col,
      accepts: () => true,
      onOver: (p, _x, y) => {
        if (p.kind === 'card') showDropLine(body, indicator, '.icidh-card', y);
      },
      onLeave: () => indicator.remove(),
      onDrop: (p, _x, y) => {
        indicator.remove();
        if (p.kind === 'disease') {
          showToast('診断名は「疾患」の列に置いてください。');
          return;
        }
        const card = findCard(store.data, p.cardId);
        if (!card) return;
        // 画面1から置くとき：検査結果と問題点のラベルがなければ置かない（ドロップした時点で判定する）
        if (p.origin === 'screen1') {
          const reason = placeBlockReason(card);
          if (reason) {
            showToast(reason, 'warn');
            return;
          }
        }
        const index = indexAt(body, '.icidh-card', y);
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
          label: '統合と解釈から外す',
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
          label: '統合と解釈から外す',
          danger: true,
          action: () => {
            removeDiseaseFromIcidh(store.data, id);
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
    notes.replaceChildren();
    layer.setAttribute('width', String(diagram.scrollWidth));
    layer.setAttribute('height', String(diagram.scrollHeight));
    const nums = numbering(store.data);
    for (const link of store.data.icidh.links) {
      const fromSel = link.from.kind === 'disease' ? `[data-disease-id="${link.from.id}"]` : `[data-card-id="${link.from.id}"]`;
      const fromEl = columns.querySelector(fromSel);
      const toEl = columns.querySelector(`[data-card-id="${link.toCardId}"]`);
      if (!fromEl || !toEl) continue;
      const points = anchorPoints(diagram, fromEl, toEl);
      const d = curve(...points);
      const g = svg('g', { class: 'arrow' });
      g.append(svg('path', { d, class: 'arrow-line', 'marker-end': `url(#${MARKER_ID})` }));
      const hit = svg('path', { d, class: 'arrow-hit' });
      const title = `${refName(nums, link.from)} → #${nums.card.get(link.toCardId)} のつながり`;
      const open = () =>
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
        );
      hit.addEventListener('click', open);
      g.append(hit);
      layer.append(g);

      const note = link.note.trim();
      if (note) {
        const [mx, my] = curveMidpoint(...points);
        const short = note.length > NOTE_PREVIEW ? `${note.slice(0, NOTE_PREVIEW)}…` : note;
        const tag = h('button', { type: 'button', class: 'arrow-note', title: note }, short.replace(/\s+/g, ' '));
        tag.style.left = `${mx}px`;
        tag.style.top = `${my}px`;
        tag.addEventListener('click', open);
        // 説明にマウスを乗せたときも、その矢印を強調する
        tag.addEventListener('pointerenter', () => g.classList.add('hover'));
        tag.addEventListener('pointerleave', () => g.classList.remove('hover'));
        notes.append(tag);
      }
    }
  }

  // ---- 問題点リスト（配置と矢印から自動で作る） ----
  function renderList(): void {
    const items = problemList(store.data);
    const nums = numbering(store.data);
    const diseases = store.data.icidh.diseases.map((id) => findDiagnosis(store.data, id)).filter((d) => !!d);
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
    unregister.forEach((f) => f());
    unregister = [];
    columns.replaceChildren(diseaseColumn(), ...STAGES.map((s) => stageColumn(s.id, s.label)));
    renderList();
    requestAnimationFrame(drawArrows);
  }

  new ResizeObserver(() => drawArrows()).observe(diagram);
  store.subscribe(render);
  render();
  return root;
}

