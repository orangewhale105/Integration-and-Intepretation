// 画面2：統合と解釈（ICIDH）。
// 画面1のカード・診断名を各列へ直接ドラッグして置き、原因 → 結果の向きに矢印を引く。
// 画面1でラベリングした問題点以外は置けない（問題点を新しく作る手段は設けない）。
import { findCard, findDiagnosis } from '../../model/caseData';
import { addLink, numbering, placeCard, placeDisease, problemList, refName, removeDiseaseFromIcidh, removeFromIcidh } from '../../model/icidh';
import { STAGES, type IcidhStage, type Link, type NodeRef } from '../../model/types';
import { isIncomplete, placeBlockReason } from '../../model/validation';
import { store } from '../../store';
import { attachContextMenu } from '../common/contextMenu';
import { autoGrow, h } from '../common/dom';
import { makeDraggable, registerDropTarget, type DragPayload } from '../common/dragDrop';
import { showToast } from '../common/toast';
import { showCardDetail } from '../screen1/cardDetail';
import { selection } from '../selection';
import { closeCardPopover, isCardPopoverOpen, showCardPopover } from './cardPopover';
import { anchorPoints, createArrowLayer, curve, curveMidpoint, svg } from './arrows';
import { LIST_ORDER } from '../../model/icidh';

const MARKER_ID = 'icidh-arrow-head';

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
      ' 左の画面のカード・診断名をドラッグして列に置き、右端の ● から原因 → 結果の向きに矢印を引きます。矢印をクリック（iPad はタップ）すると、図の上に説明を書けます。説明は上端の ⠿ をつかんで動かせます。',
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
    /** ドラッグしているものが診断名なら、その ID */
    const diagnosisId = (p: DragPayload) => (p.kind === 'disease' ? p.id : findDiagnosis(store.data, p.cardId)?.id);
    addDropTarget({
      el: col,
      accepts: () => true,
      onOver: (p, _x, y) => {
        if (diagnosisId(p)) showDropLine(body, indicator, '.disease-box', y);
      },
      onLeave: () => indicator.remove(),
      onDrop: (p, _x, y) => {
        indicator.remove();
        const id = diagnosisId(p);
        if (!id) {
          showToast('「疾患」の列には診断名のカードだけを置けます。診断名は医学的情報に「診断名」のカードとして入力してください。');
          return;
        }
        const reason = placeBlockReason(findDiagnosis(store.data, id)!);
        if (reason) {
          showToast(reason, 'warn');
          return;
        }
        placeDisease(store.data, id, indexAt(body, '.disease-box', y));
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
        { class: `icidh-card node${isIncomplete(card) ? ' incomplete' : ''}${selection.get() === cardId ? ' selected' : ''}`, 'data-card-id': cardId },
        h('span', { class: 'node-num' }, `#${nums.card.get(cardId)}`),
        h('span', { class: 'node-label' }, card.label.trim() || '（ラベルなし）'),
        stage === 'handicap' ? null : connector({ kind: 'card', id: cardId }),
      );
      makeDraggable(chip, () => ({ kind: 'card', cardId, origin: 'icidh' }), () => card.label);
      // 選ぶと、単一検査の解釈の画面で同じカードを強調し、ここにもカードの内容を出す
      chip.addEventListener('click', (e) => {
        if ((e.target as Element).closest('.connector')) return;
        selectCard(cardId);
      });
      body.append(chip);
    }
    const indicator = h('div', { class: 'drop-line' });
    const col = h('div', { class: 'icidh-col', 'data-stage': stage }, h('h2', { class: 'col-title' }, title), body);

    addDropTarget({
      el: col,
      accepts: () => true,
      onOver: (p, _x, y) => {
        if (p.kind === 'card' && findCard(store.data, p.cardId)?.kind === 'problem') showDropLine(body, indicator, '.icidh-card', y);
      },
      onLeave: () => indicator.remove(),
      onDrop: (p, _x, y) => {
        indicator.remove();
        const card = p.kind === 'card' ? findCard(store.data, p.cardId) : undefined;
        if (p.kind === 'disease' || card?.kind === 'diagnosis') {
          showToast('診断名のカードは「疾患」の列に置いてください。');
          return;
        }
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

  // ---- 矢印の描画と、説明のテキストボックス ----
  /** 説明が空でも、テキストボックスを出しておく矢印（矢印をクリックした直後） */
  let editingLinkId: string | null = null;
  /** 説明の入力中は図を作り直さない（入力欄が消えないように） */
  let typingNote = false;

  const deleteLinkItem = (link: Link) => ({
    label: 'この矢印を削除',
    danger: true,
    action: () => {
      store.data.icidh.links = store.data.icidh.links.filter((l) => l !== link);
      store.commit();
    },
  });

  function drawArrows(): void {
    // 入力中のテキストボックスがあれば、作り直した後にカーソルを戻す
    const active = document.activeElement;
    const focused = active instanceof HTMLTextAreaElement && notes.contains(active)
      ? { id: active.dataset.linkId, start: active.selectionStart, end: active.selectionEnd }
      : null;

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
      const g = svg('g', { class: 'arrow', 'data-link-id': link.id });
      g.append(svg('path', { d, class: 'arrow-line', 'marker-end': `url(#${MARKER_ID})` }));
      const hit = svg('path', { d, class: 'arrow-hit' });
      g.append(hit);
      layer.append(g);
      // 矢印をクリック（iPad はタップ）すると、説明のテキストボックスを出して書ける
      hit.addEventListener('click', () => {
        editingLinkId = link.id;
        drawArrows();
        notes.querySelector<HTMLTextAreaElement>(`textarea[data-link-id="${link.id}"]`)?.focus();
      });

      if (link.note.trim() === '' && editingLinkId !== link.id) continue;
      const [mx, my] = curveMidpoint(...points);
      notes.append(noteBox(link, g, mx, my, `${refName(nums, link.from)} → #${nums.card.get(link.toCardId)} の説明`));
    }
    if (focused) {
      const ta = notes.querySelector<HTMLTextAreaElement>(`textarea[data-link-id="${focused.id}"]`);
      if (ta) {
        ta.focus();
        ta.setSelectionRange(focused.start, focused.end);
      }
    }
  }

  /** 矢印の説明のテキストボックス。図の上で直接書け、上端のつまみでドラッグして動かせる */
  function noteBox(link: Link, arrow: SVGGElement, mx: number, my: number, title: string): HTMLElement {
    const ta = h('textarea', {
      class: 'note-text',
      rows: 1,
      'data-link-id': link.id,
      'aria-label': title,
      placeholder: 'なぜつながるか',
    }) as HTMLTextAreaElement;
    ta.value = link.note;
    requestAnimationFrame(() => autoGrow(ta));
    ta.addEventListener('input', () => {
      autoGrow(ta);
      link.note = ta.value;
      typingNote = true;
      store.commit();
      typingNote = false;
      renderList();
    });
    ta.addEventListener('blur', () => {
      if (editingLinkId !== link.id) return;
      editingLinkId = null;
      // 空のまま離れたときは、テキストボックスを閉じる
      if (link.note.trim() === '') requestAnimationFrame(drawArrows);
    });

    const grip = h('div', { class: 'note-grip', title: 'ドラッグして動かす' }, '⠿');
    const box = h('div', { class: 'arrow-note', 'data-link-id': link.id }, grip, ta);
    const place = (dx: number, dy: number) => {
      box.style.left = `${mx + dx}px`;
      box.style.top = `${my + dy}px`;
    };
    const base = link.notePos ?? { dx: 0, dy: 0 };
    place(base.dx, base.dy);

    grip.style.touchAction = 'none';
    grip.addEventListener('pointerdown', (down) => {
      if (down.button !== 0) return;
      down.preventDefault();
      grip.setPointerCapture(down.pointerId);
      box.classList.add('moving');
      let dx = base.dx;
      let dy = base.dy;
      const move = (e: PointerEvent) => {
        dx = base.dx + e.clientX - down.clientX;
        dy = base.dy + e.clientY - down.clientY;
        place(dx, dy);
      };
      const up = () => {
        grip.removeEventListener('pointermove', move);
        grip.removeEventListener('pointerup', up);
        grip.removeEventListener('pointercancel', up);
        box.classList.remove('moving');
        if (dx === base.dx && dy === base.dy) return;
        link.notePos = { dx: Math.round(dx), dy: Math.round(dy) };
        store.commit();
      };
      grip.addEventListener('pointermove', move);
      grip.addEventListener('pointerup', up);
      grip.addEventListener('pointercancel', up);
    });

    // テキストボックスに触れているときは、その矢印を強調する
    box.addEventListener('pointerenter', () => arrow.classList.add('hover'));
    box.addEventListener('pointerleave', () => arrow.classList.remove('hover'));
    ta.addEventListener('focus', () => arrow.classList.add('hover'));
    ta.addEventListener('blur', () => arrow.classList.remove('hover'));
    return box;
  }

  // 矢印とテキストボックスのつまみを右クリック（iPad は長押し）すると、矢印を削除できる
  // （テキストボックスの中では、ブラウザ標準のコピー・貼り付けのメニューを出す）
  attachContextMenu(diagram, (target) => {
    const el = target instanceof Element ? target.closest('[data-link-id]') : null;
    const id = el?.getAttribute('data-link-id');
    const link = id ? store.data.icidh.links.find((l) => l.id === id) : undefined;
    return link ? [deleteLinkItem(link)] : null;
  });

  // ---- 問題点リスト（配置と矢印から自動で作る。レジュメと同じく段階ごとに分ける） ----
  function renderList(): void {
    const items = problemList(store.data);
    const nums = numbering(store.data);
    const diseases = store.data.icidh.diseases.map((id) => findDiagnosis(store.data, id)).filter((d) => !!d);
    const sections: HTMLElement[] = [];
    for (const stage of LIST_ORDER) {
      const group = items.filter((it) => it.stage === stage.id);
      if (group.length === 0) continue;
      sections.push(
        h('h3', { class: 'list-level' }, stage.label),
        h(
          'ul',
          { class: 'problems' },
          ...group.map((it) =>
            h('li', {}, h('div', { class: 'problem-heading' }, it.heading), ...it.notes.map((n) => h('div', { class: 'problem-note' }, n))),
          ),
        ),
      );
    }
    if (diseases.length) {
      sections.push(
        h('h3', { class: 'list-level' }, '疾患'),
        h('ul', { class: 'problems' }, ...diseases.map((d) => h('li', {}, `D${nums.disease.get(d.id)} ${d.name.trim() || '（診断名なし）'}`))),
      );
    }
    list.replaceChildren(
      h('h2', { class: 'list-title' }, '問題点リスト'),
      ...(sections.length ? sections : [h('p', { class: 'placeholder' }, 'カードを置くと、ここに問題点リストが作られます。')]),
    );
  }

  // ---- カードを選ぶ ----
  function selectCard(cardId: string): void {
    selection.set(cardId);
    columns.querySelectorAll('.icidh-card.selected').forEach((c) => c.classList.remove('selected'));
    columns.querySelector(`.icidh-card[data-card-id="${cardId}"]`)?.classList.add('selected');
    showSelectedPopover();
  }

  /** 選んだカードの内容の窓を、今のカードの位置と内容で出し直す */
  function showSelectedPopover(): void {
    const id = selection.get();
    const chip = id ? columns.querySelector<HTMLElement>(`.icidh-card[data-card-id="${id}"]`) : null;
    const card = id ? findCard(store.data, id) : undefined;
    if (!chip || !card) {
      closeCardPopover();
      return;
    }
    const num = numbering(store.data).card.get(card.id);
    showCardPopover(chip, `#${num} ${card.label.trim() || '（ラベルなし）'}`, card, () => {
      selection.set(null);
      columns.querySelectorAll('.icidh-card.selected').forEach((c) => c.classList.remove('selected'));
    });
  }

  function render(): void {
    if (typingNote) return;
    unregister.forEach((f) => f());
    unregister = [];
    columns.replaceChildren(diseaseColumn(), ...STAGES.map((s) => stageColumn(s.id, s.label)));
    renderList();
    requestAnimationFrame(drawArrows);
    if (isCardPopoverOpen()) showSelectedPopover();
  }

  new ResizeObserver(() => drawArrows()).observe(diagram);
  store.subscribe((kind) => {
    if (kind === 'replace') closeCardPopover();
    render();
  });
  render();
  return root;
}

