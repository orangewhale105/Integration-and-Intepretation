import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { createEmptyCase } from '../src/model/caseData';
import { loadAutosave, saveAutosave, saveBackupNow } from '../src/storage/storage';

describe('自動保存', () => {
  it('保存した内容を読み戻せる', async () => {
    await saveAutosave({ data: createEmptyCase('症例A'), dirty: true });
    const loaded = await loadAutosave();
    expect(loaded?.data.caseName).toBe('症例A');
    expect(loaded?.dirty).toBe(true);
  });

  it('ページを閉じる直前の控えが新しければ、控えを使う', async () => {
    await saveAutosave({ data: createEmptyCase('古い内容'), dirty: false });
    await new Promise((r) => setTimeout(r, 5));
    // IndexedDB への書き込みが間に合わなかった場合を再現するため、控えだけを書く
    localStorage.setItem(
      'integration-and-interpretation/backup',
      JSON.stringify({ data: createEmptyCase('閉じる直前の内容'), dirty: true, savedAt: Date.now() }),
    );
    expect((await loadAutosave())?.data.caseName).toBe('閉じる直前の内容');
  });

  it('控えのあとに通常の保存が済めば、通常の保存を使う', async () => {
    saveBackupNow({ data: createEmptyCase('控え'), dirty: true });
    await new Promise((r) => setTimeout(r, 5));
    await saveAutosave({ data: createEmptyCase('最新'), dirty: true });
    expect((await loadAutosave())?.data.caseName).toBe('最新');
  });
});
