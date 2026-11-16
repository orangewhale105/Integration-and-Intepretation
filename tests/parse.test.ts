import { describe, expect, it } from 'vitest';
import { createCard, createEmptyCase } from '../src/model/caseData';
import { CaseParseError, parseCase } from '../src/storage/parse';
import { caseNameFromFileName, safeFileName, serializeCase } from '../src/storage/storage';

describe('ケースファイルの読み込み', () => {
  it('書き出した内容をそのまま読み戻せる', () => {
    const data = createEmptyCase('症例A');
    const card = createCard('general');
    card.label = '歩行時痛';
    card.rows = [{ id: 'r1', result: '「歩くと膝が痛い」（本人）', reference: '' }];
    data.cards.push(card);
    data.diagnoses.push({ id: 'd1', name: '変形性膝関節症' });
    data.icidh.diseases.push('d1');
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
    data.icidh.diseases.push('missing');
    data.icidh.columns.impairment.push(card.id, 'missing');
    data.icidh.columns.disability.push(card.id);
    data.icidh.links.push({ id: 'l', from: { kind: 'disease', id: 'none' }, toCardId: card.id, note: '' });

    const parsed = parseCase(JSON.parse(serializeCase(data)));
    expect(parsed.icidh.diseases).toEqual([]);
    expect(parsed.icidh.columns.impairment).toEqual([card.id]);
    expect(parsed.icidh.columns.disability).toEqual([]);
    expect(parsed.icidh.links).toEqual([]);
  });
});

describe('第1版のファイル', () => {
  it('区分を読み替え、画面2の疾患名を画面1の診断名に移す', () => {
    const raw = {
      format: 'integration-and-interpretation/case',
      version: 1,
      caseName: '旧',
      cards: [
        { id: 'a', category: 'observation', name: '', criterion: '', source: '', rows: [], label: 'x' },
        { id: 'b', category: 'interview', name: '', criterion: '', source: '', rows: [], label: 'y' },
        { id: 'c', category: 'family', name: '', criterion: '', source: '', rows: [], label: 'z' },
        { id: 'e', category: 'otherDept', name: '', criterion: '', source: '', rows: [], label: 'w' },
      ],
      sent: ['a'],
      icidh: {
        diseases: [{ id: 'd1', name: '脳梗塞' }],
        columns: { impairment: ['a'], disability: [], handicap: [] },
        links: [{ id: 'l', from: { kind: 'disease', id: 'd1' }, toCardId: 'a', note: 'n' }],
      },
    };
    const data = parseCase(raw);
    expect(data.cards.map((c) => c.category)).toEqual(['exam', 'general', 'general', 'otherDept']);
    expect(data.diagnoses).toEqual([{ id: 'd1', name: '脳梗塞' }]);
    expect(data.icidh.diseases).toEqual(['d1']);
    expect(data.icidh.links).toHaveLength(1);
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
