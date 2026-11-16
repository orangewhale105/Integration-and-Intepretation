// 画面上部：ケース名（ファイル名）と、新規・開く・保存・印刷・Word 出力
import { createEmptyCase } from '../model/caseData';
import { store } from '../store';
import { CaseParseError, exportCaseFile, exportResumeFile, importCaseFile } from '../storage/storage';
import { h } from './common/dom';
import { showToast } from './common/toast';
import { printCase } from '../print/print';

const UNSAVED = '保存（書き出し）していない変更があります。破棄してよろしいですか？';

export function createHeader(): HTMLElement {
  const nameInput = h('input', {
    type: 'text',
    class: 'case-name',
    'aria-label': 'ケース名（ファイル名）',
    title: 'ケース名。保存するときのファイル名になります',
  }) as HTMLInputElement;
  nameInput.addEventListener('input', () => {
    store.data.caseName = nameInput.value;
    store.commit();
  });

  const fileInput = h('input', { type: 'file', accept: '.json,application/json', hidden: true }) as HTMLInputElement;
  fileInput.addEventListener('change', async () => {
    const file = fileInput.files?.[0];
    fileInput.value = '';
    if (!file) return;
    try {
      store.replace(await importCaseFile(file), false);
      showToast(`「${store.data.caseName}」を開きました。`, 'info');
    } catch (e) {
      showToast(e instanceof CaseParseError ? e.message : 'ファイルを読み込めませんでした。', 'warn');
    }
  });

  const btn = (label: string, onClick: () => void, title = '') => {
    const b = h('button', { type: 'button', class: 'btn', title }, label);
    b.addEventListener('click', onClick);
    return b;
  };

  const saveMark = h('span', { class: 'unsaved-mark', title: '保存（書き出し）していない変更があります' }, '未保存');

  const header = h(
    'header',
    { class: 'app-header' },
    h('span', { class: 'app-title' }, '統合と解釈'),
    h('label', { class: 'case-name-wrap' }, h('span', { class: 'case-name-label' }, 'ケース名'), nameInput),
    saveMark,
    h(
      'div',
      { class: 'header-actions' },
      btn('新規', () => {
        if (store.dirty && !window.confirm(UNSAVED)) return;
        store.replace(createEmptyCase(), false);
      }, '新しいケースを始める'),
      btn('開く', () => {
        if (store.dirty && !window.confirm(UNSAVED)) return;
        fileInput.click();
      }, '保存したケースのファイルを開く'),
      btn('保存', () => {
        exportCaseFile(store.data);
        store.markClean();
        sync();
      }, 'ケース名をファイル名として書き出す'),
      btn('印刷', () => printCase(store.data), '単一検査結果の解釈と統合と解釈の図を A4 横で印刷する（PDF 保存もできます）'),
      btn('Word出力', () => {
        exportResumeFile(store.data).catch((e) => {
          console.error(e);
          showToast('Word ファイルを作れませんでした。', 'warn');
        });
      }, 'レジュメ（入力した部分のみ）を A4 縦・2段組の Word ファイルにする'),
      fileInput,
    ),
  );

  const sync = () => {
    if (document.activeElement !== nameInput) nameInput.value = store.data.caseName;
    saveMark.hidden = !store.dirty;
  };
  store.subscribe(sync);
  sync();
  return header;
}
