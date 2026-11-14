import { describe, expect, it } from 'vitest';
import { createCard, createEmptyCase } from '../src/model/caseData';
import { addLink, deleteDisease, linkBlockReason, numbering, placeCard, problemList } from '../src/model/icidh';
import type { CaseData } from '../src/model/types';

function setup() {
  const data: CaseData = createEmptyCase();
  const mk = (label: string) => {
    const c = createCard('exam');
    c.label = label;
    data.cards.push(c);
    data.sent.push(c.id);
    return c.id;
  };
  const ids = {
    sensA: mk('表在感覚鈍麻'),
    sensB: mk('関節位置覚鈍麻'),
    quad: mk('大腿四頭筋筋力低下'),
    gait: mk('歩行能力低下'),
    job: mk('復職困難'),
  };
  data.icidh.diseases.push({ id: 'd1', name: '頚部脊柱管狭窄症' }, { id: 'd2', name: '2型糖尿病' });
  placeCard(data, ids.sensA, 'impairment', 9);
  placeCard(data, ids.sensB, 'impairment', 9);
  placeCard(data, ids.quad, 'impairment', 9);
  placeCard(data, ids.gait, 'disability', 0);
  placeCard(data, ids.job, 'handicap', 0);
  return { data, ids };
}

describe('矢印のルール', () => {
  it('3種類の矢印だけ引ける', () => {
    const { data, ids } = setup();
    expect(linkBlockReason(data, { kind: 'disease', id: 'd1' }, ids.quad)).toBeNull();
    expect(linkBlockReason(data, { kind: 'card', id: ids.quad }, ids.gait)).toBeNull();
    expect(linkBlockReason(data, { kind: 'card', id: ids.gait }, ids.job)).toBeNull();
  });

  it('逆向き・段階の飛ばし・同じ段階・疾患からの飛ばしは引けない', () => {
    const { data, ids } = setup();
    expect(linkBlockReason(data, { kind: 'card', id: ids.gait }, ids.quad)).not.toBeNull();
    expect(linkBlockReason(data, { kind: 'card', id: ids.quad }, ids.job)).not.toBeNull();
    expect(linkBlockReason(data, { kind: 'card', id: ids.sensA }, ids.sensB)).not.toBeNull();
    expect(linkBlockReason(data, { kind: 'disease', id: 'd1' }, ids.gait)).not.toBeNull();
    expect(linkBlockReason(data, { kind: 'card', id: ids.quad }, ids.quad)).not.toBeNull();
  });

  it('同じ矢印は2本引けない。1枚から複数の上位へは引ける', () => {
    const { data, ids } = setup();
    placeCard(data, ids.sensB, 'disability', 1);
    expect(typeof addLink(data, { kind: 'card', id: ids.quad }, ids.gait)).toBe('object');
    expect(typeof addLink(data, { kind: 'card', id: ids.quad }, ids.gait)).toBe('string');
    expect(typeof addLink(data, { kind: 'card', id: ids.quad }, ids.sensB)).toBe('object');
  });
});

describe('配置', () => {
  it('置き直すと移動になり、ルールに合わなくなった矢印は消える', () => {
    const { data, ids } = setup();
    addLink(data, { kind: 'disease', id: 'd1' }, ids.quad);
    addLink(data, { kind: 'card', id: ids.quad }, ids.gait);
    const removed = placeCard(data, ids.quad, 'disability', 0);
    expect(removed).toBe(2);
    expect(data.icidh.columns.impairment).not.toContain(ids.quad);
    expect(data.icidh.columns.disability).toEqual([ids.quad, ids.gait]);
  });

  it('同じ列の中で並べ替えられる', () => {
    const { data, ids } = setup();
    placeCard(data, ids.sensA, 'impairment', 3);
    expect(data.icidh.columns.impairment).toEqual([ids.sensB, ids.quad, ids.sensA]);
    placeCard(data, ids.sensA, 'impairment', 0);
    expect(data.icidh.columns.impairment).toEqual([ids.sensA, ids.sensB, ids.quad]);
  });

  it('送っていないカードは置けない', () => {
    const { data } = setup();
    const c = createCard('exam');
    data.cards.push(c);
    placeCard(data, c.id, 'impairment', 0);
    expect(data.icidh.columns.impairment).not.toContain(c.id);
  });

  it('疾患を消すと、その疾患からの矢印も消える', () => {
    const { data, ids } = setup();
    addLink(data, { kind: 'disease', id: 'd1' }, ids.quad);
    deleteDisease(data, 'd1');
    expect(data.icidh.links).toEqual([]);
  });
});

describe('番号と問題点リスト', () => {
  it('疾患は D1… 問題点は機能障害の上から #1…', () => {
    const { data, ids } = setup();
    const n = numbering(data);
    expect(n.disease.get('d2')).toBe(2);
    expect([ids.sensA, ids.sensB, ids.quad, ids.gait, ids.job].map((id) => n.card.get(id))).toEqual([1, 2, 3, 4, 5]);
  });

  it('レジュメの形式で、社会的不利を上・機能障害を下に並べる', () => {
    const { data, ids } = setup();
    addLink(data, { kind: 'disease', id: 'd2' }, ids.sensA);
    addLink(data, { kind: 'disease', id: 'd1' }, ids.sensA);
    for (const id of [ids.quad, ids.sensA, ids.sensB]) addLink(data, { kind: 'card', id }, ids.gait);
    const l = addLink(data, { kind: 'card', id: ids.gait }, ids.job);
    if (typeof l === 'object') l.note = '屋外歩行ができず通勤できない';

    const list = problemList(data);
    expect(list.map((i) => i.heading)).toEqual([
      '#5 復職困難（#4）',
      '#4 歩行能力低下（#1,2,3）',
      '#1 表在感覚鈍麻（D1,2）',
      '#2 関節位置覚鈍麻',
      '#3 大腿四頭筋筋力低下',
    ]);
    expect(list[0].notes).toEqual(['#4 → #5：屋外歩行ができず通勤できない']);
  });
});
