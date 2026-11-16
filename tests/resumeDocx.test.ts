import JSZip from 'jszip';
import { Packer } from 'docx';
import { describe, expect, it } from 'vitest';
import { createCard, createEmptyCase } from '../src/model/caseData';
import { placeCard, placeDisease } from '../src/model/icidh';
import { buildResumeDocument } from '../src/export/resumeDocx';

describe('レジュメの Word 出力', () => {
  it('A4 縦・2段組で、入力した部分を見本の見出しの順に並べる', async () => {
    const data = createEmptyCase('症例A');
    const general = createCard('general');
    general.name = '主訴';
    general.rows = [{ id: 'r1', result: '手足が痺れる', reference: '' }];
    const exam = createCard('exam');
    exam.name = 'MMT';
    exam.rows = [{ id: 'r2', result: '右大腿四頭筋 3', reference: '5' }];
    exam.label = '大腿四頭筋の筋出力低下';
    data.cards.push(general, exam);
    data.cards.push({ ...createCard('medical', 'diagnosis'), id: 'd1', name: '頚部脊柱管狭窄症' });
    placeDisease(data, 'd1', 0);
    placeCard(data, exam.id, 'impairment', 0);

    const zip = await JSZip.loadAsync(await Packer.toBuffer(buildResumeDocument(data)));
    const xml = await zip.file('word/document.xml')!.async('string');
    expect(xml).toContain('<w:cols w:space="414" w:num="2"');
    expect(xml).toMatch(/<w:pgSz w:w="11906" w:h="16838"/);
    const text = xml.replace(/<[^>]+>/g, '');
    const order = ['Ⅱ．一般情報', '主訴：手足が痺れる', 'Ⅲ．医学的情報', '診断名：頚部脊柱管狭窄症', 'Ⅳ．他部門情報', 'Ⅴ．理学療法初期評価', '1. MMT', 'Ⅵ．問題点抽出', 'Impairment level', '＃1　大腿四頭筋の筋出力低下'];
    let at = 0;
    for (const s of order) {
      const i = text.indexOf(s, at);
      expect(i, s).toBeGreaterThanOrEqual(0);
      at = i;
    }
  });
});
