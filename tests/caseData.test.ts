import { describe, expect, it } from 'vitest';
import { createCard, createEmptyCase, deleteCard, isPlaced, setCardCategory, setCardKind } from '../src/model/caseData';

describe('カードの削除', () => {
  it('画面2からも外し、そのカードの矢印も消す', () => {
    const data = createEmptyCase();
    const a = createCard('exam');
    const b = createCard('general');
    data.cards.push(a, b);
    data.cards.push({ ...createCard('medical', 'diagnosis'), id: 'd1', name: '脳梗塞' });
    data.icidh.diseases.push('d1');
    data.icidh.columns.impairment.push(a.id);
    data.icidh.columns.disability.push(b.id);
    data.icidh.links.push(
      { id: 'l1', from: { kind: 'disease', id: 'd1' }, toCardId: a.id, note: '', notePos: null },
      { id: 'l2', from: { kind: 'card', id: a.id }, toCardId: b.id, note: '', notePos: null },
    );

    deleteCard(data, a.id);

    expect(data.cards.map((c) => c.id)).toEqual([b.id, 'd1']);
    expect(isPlaced(data, a.id)).toBe(false);
    expect(isPlaced(data, b.id)).toBe(true);
    expect(data.icidh.links).toEqual([]);
  });

  it('診断名のカードを削除すると、疾患の列からも外れる', () => {
    const data = createEmptyCase();
    const d = createCard('medical', 'diagnosis');
    data.cards.push(d);
    data.icidh.diseases.push(d.id);
    deleteCard(data, d.id);
    expect(data.icidh.diseases).toEqual([]);
  });
});

describe('カードの種類と区分の変更', () => {
  it('問題点のカードを情報のカードにすると、統合と解釈から外れる', () => {
    const data = createEmptyCase();
    const c = createCard('general');
    data.cards.push(c);
    data.icidh.columns.handicap.push(c.id);
    expect(setCardKind(data, c, 'info')).toBe(true);
    expect(isPlaced(data, c.id)).toBe(false);
  });

  it('診断名のカードをほかの区分へ移すと、情報のカードになり疾患の列から外れる', () => {
    const data = createEmptyCase();
    const d = createCard('medical', 'diagnosis');
    data.cards.push(d);
    data.icidh.diseases.push(d.id);
    expect(setCardCategory(data, d, 'general')).toBe(true);
    expect(d.kind).toBe('info');
    expect(data.icidh.diseases).toEqual([]);
  });
});
