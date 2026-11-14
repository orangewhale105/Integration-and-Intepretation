import { describe, expect, it } from 'vitest';
import { createCard, createEmptyCase, deleteCard, isPlaced } from '../src/model/caseData';

describe('カードの削除', () => {
  it('画面2からも外し、そのカードの矢印も消す', () => {
    const data = createEmptyCase();
    const a = createCard('exam');
    const b = createCard('observation');
    data.cards.push(a, b);
    data.sent.push(a.id, b.id);
    data.icidh.diseases.push({ id: 'd1', name: '脳梗塞' });
    data.icidh.columns.impairment.push(a.id);
    data.icidh.columns.disability.push(b.id);
    data.icidh.links.push(
      { id: 'l1', from: { kind: 'disease', id: 'd1' }, toCardId: a.id, note: '' },
      { id: 'l2', from: { kind: 'card', id: a.id }, toCardId: b.id, note: '' },
    );

    deleteCard(data, a.id);

    expect(data.cards.map((c) => c.id)).toEqual([b.id]);
    expect(data.sent).toEqual([b.id]);
    expect(isPlaced(data, a.id)).toBe(false);
    expect(isPlaced(data, b.id)).toBe(true);
    expect(data.icidh.links).toEqual([]);
  });
});
