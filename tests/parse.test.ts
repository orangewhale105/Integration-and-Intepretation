import { describe, expect, it } from 'vitest';
import { createCard, createEmptyCase } from '../src/model/caseData';
import { CaseParseError, parseCase } from '../src/storage/parse';
import { caseNameFromFileName, safeFileName, serializeCase } from '../src/storage/storage';

describe('ケースファイルの読み込み', () => {
  it('書き出した内容をそのまま読み戻せる', () => {
    const data = createEmptyCase('症例A');
    const card = createCard('interview');
    card.label = '歩行時痛';
    card.rows = [{ id: 'r1', result: '「歩くと膝が痛い」（本人）', reference: '' }];
    data.cards.push(card);
    data.sent.push(card.id);
    data.icidh.columns.disability.push(card.id);
    expect(parseCase(JSON.parse(serializeCase(data)))).toEqual(data);
  });

  it('このアプリのファイルでなければエラー', () => {
    expect(() => parseCase({ foo: 1 })).toThrow(CaseParseError);
  });

  it('壊れた参照は取り除き、1枚のカードは1か所にしか置かない', () => {
    const data = createEmptyCase();
    const card = createCard('exam');
    data.cards.push(card);
    data.sent.push(card.id, 'missing');
    data.icidh.columns.impairment.push(card.id, 'missing');
    data.icidh.columns.disability.push(card.id);
    data.icidh.links.push({ id: 'l', from: { kind: 'disease', id: 'none' }, toCardId: card.id, note: '' });

    const parsed = parseCase(JSON.parse(serializeCase(data)));
    expect(parsed.sent).toEqual([card.id]);
    expect(parsed.icidh.columns.impairment).toEqual([card.id]);
    expect(parsed.icidh.columns.disability).toEqual([]);
    expect(parsed.icidh.links).toEqual([]);
  });
});

describe('ファイル名', () => {
  it('ファイル名からケース名を付ける', () => {
    expect(caseNameFromFileName('症例B.json')).toBe('症例B');
  });
  it('ファイル名に使えない文字を置き換える', () => {
    expect(safeFileName('a/b:c')).toBe('a_b_c');
    expect(safeFileName('  ')).toBe('新しいケース');
  });
});
