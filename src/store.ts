import { createEmptyCase } from './model/caseData';
import type { CaseData } from './model/types';
import { saveAutosave } from './storage/storage';

/** edit: 入力による変更 / replace: ケースの入れ替え（画面を作り直す） */
export type ChangeKind = 'edit' | 'replace';
type Listener = (kind: ChangeKind) => void;

/** 開いているケースの状態。変更は commit() で通知し、自動保存する */
class Store {
  data: CaseData = createEmptyCase();
  dirty = false;
  private listeners = new Set<Listener>();
  private saveTimer: ReturnType<typeof setTimeout> | null = null;

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  /** データを変更した後に呼ぶ */
  commit(): void {
    this.dirty = true;
    this.notify('edit');
    this.scheduleSave();
  }

  /** ケースを丸ごと入れ替える（新規・読込） */
  replace(data: CaseData, dirty: boolean): void {
    this.data = data;
    this.dirty = dirty;
    this.notify('replace');
    this.scheduleSave(0);
  }

  markClean(): void {
    this.dirty = false;
    this.scheduleSave(0);
  }

  private notify(kind: ChangeKind): void {
    for (const fn of this.listeners) fn(kind);
  }

  private scheduleSave(delay = 400): void {
    if (this.saveTimer) clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => {
      this.saveTimer = null;
      saveAutosave({ data: this.data, dirty: this.dirty }).catch((e) => console.error('自動保存に失敗しました', e));
    }, delay);
  }

  /** ページを離れる前などに、保留中の自動保存をすぐ行う */
  flush(): void {
    if (!this.saveTimer) return;
    clearTimeout(this.saveTimer);
    this.saveTimer = null;
    saveAutosave({ data: this.data, dirty: this.dirty }).catch(() => {});
  }
}

export const store = new Store();
