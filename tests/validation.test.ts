import { describe, expect, it } from 'vitest';
import { createCard, createRow } from '../src/model/caseData';
import { missingFields, sendBlockReason } from '../src/model/validation';

function filledCard() {
  const c = createCard('exam');
  c.name = 'ROM';
  c.criterion = '参考可動域を下回れば可動域制限';
  c.source = '日本整形外科学会';
  c.rows = [{ ...createRow(), result: '膝屈曲 100°', reference: '130°' }];
  c.label = '膝関節可動域制限';
  return c;
}

describe('入力不備の判定', () => {
  it('必須項目がそろっていれば不備なし', () => {
    expect(missingFields(filledCard())).toEqual([]);
  });

  it('空の項目を不備として挙げる。空白だけの行は結果に数えない', () => {
    const c = filledCard();
    c.source = '  ';
    c.rows = [{ ...createRow(), result: ' ', reference: '130°' }];
    expect(missingFields(c)).toEqual(['出典', '結果']);
  });
});

describe('画面2へ送る条件', () => {
  it('結果と問題点ラベルがあれば、基準・出典が空でも送れる', () => {
    const c = filledCard();
    c.criterion = '';
    c.source = '';
    expect(sendBlockReason(c)).toBeNull();
  });

  it('結果か問題点ラベルが空なら送れない', () => {
    const noLabel = filledCard();
    noLabel.label = '';
    expect(sendBlockReason(noLabel)).toContain('問題点ラベル');

    const noResult = filledCard();
    noResult.rows = [];
    expect(sendBlockReason(noResult)).toContain('結果');
  });
});
