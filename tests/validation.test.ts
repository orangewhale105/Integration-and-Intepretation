import { describe, expect, it } from 'vitest';
import { createCard, createRow } from '../src/model/caseData';
import { missingFields, placeBlockReason } from '../src/model/validation';

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
    expect(missingFields(c)).toEqual(['検査結果', '出典']);
  });
});

describe('統合と解釈の画面へ置く条件', () => {
  it('検査結果と問題点のラベルがあれば、判定基準・出典が空でも置ける', () => {
    const c = filledCard();
    c.criterion = '';
    c.source = '';
    expect(placeBlockReason(c)).toBeNull();
  });

  it('検査結果か問題点のラベルが空なら置けない', () => {
    const noLabel = filledCard();
    noLabel.label = '';
    expect(placeBlockReason(noLabel)).toContain('問題点のラベル');

    const noResult = filledCard();
    noResult.rows = [];
    expect(placeBlockReason(noResult)).toContain('検査結果');
  });
});
