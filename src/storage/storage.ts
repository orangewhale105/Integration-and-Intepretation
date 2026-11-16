// 保存・読込・書き出しの処理はすべてこのファイルにまとめる。
// 将来スタンドアロンアプリに変換するときは、このファイルを差し替える。
// 学生が入力したデータはサーバーへ送信しない（端末内とファイルのみ）。

import type { CaseData } from '../model/types';
import { DEFAULT_CASE_NAME } from '../model/caseData';
import { CaseParseError, parseCase } from './parse';

const DB_NAME = 'integration-and-interpretation';
const STORE = 'kv';
const KEY_CURRENT = 'currentCase';
/** ページを閉じる直前の控え（IndexedDB の書き込みが間に合わない場合に備える） */
const KEY_BACKUP = 'integration-and-interpretation/backup';

export interface SavedState {
  data: CaseData;
  /** 最後にファイルへ書き出した（または読み込んだ）後に変更があるか */
  dirty: boolean;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function withStore<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb();
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const req = fn(tx.objectStore(STORE));
      tx.oncomplete = () => resolve(req.result);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

type Stored = { data: unknown; dirty: boolean; savedAt: number };

function toSaved(raw: unknown): (SavedState & { savedAt: number }) | null {
  if (!raw || typeof raw !== 'object') return null;
  const saved = raw as { data?: unknown; dirty?: unknown; savedAt?: unknown };
  try {
    return {
      data: parseCase(saved.data),
      dirty: saved.dirty === true,
      savedAt: typeof saved.savedAt === 'number' ? saved.savedAt : 0,
    };
  } catch {
    return null;
  }
}

/** 端末内に自動保存したケースを読み込む。IndexedDB と控えのうち新しい方を使う。なければ null */
export async function loadAutosave(): Promise<SavedState | null> {
  let fromDb: ReturnType<typeof toSaved> = null;
  try {
    fromDb = toSaved(await withStore<unknown>('readonly', (s) => s.get(KEY_CURRENT)));
  } catch (e) {
    console.error('IndexedDB を読み込めませんでした', e);
  }
  let backup: ReturnType<typeof toSaved> = null;
  try {
    const text = localStorage.getItem(KEY_BACKUP);
    backup = text ? toSaved(JSON.parse(text)) : null;
  } catch {
    backup = null;
  }
  const best = !backup ? fromDb : !fromDb || backup.savedAt > fromDb.savedAt ? backup : fromDb;
  return best ? { data: best.data, dirty: best.dirty } : null;
}

/** 端末内に自動保存する */
export async function saveAutosave(state: SavedState): Promise<void> {
  // structuredClone で保存時点の内容を固定する
  const value: Stored = { data: structuredClone(state.data), dirty: state.dirty, savedAt: Date.now() };
  await withStore('readwrite', (s) => s.put(value, KEY_CURRENT));
  try {
    localStorage.removeItem(KEY_BACKUP);
  } catch {
    /* 控えを消せなくても、新しい方が読まれるため問題ない */
  }
}

/**
 * ページを閉じる直前に呼ぶ。IndexedDB の書き込みは完了を待てないため、
 * 同期的に書ける localStorage に控えを残す。
 */
export function saveBackupNow(state: SavedState): void {
  const value: Stored = { data: state.data, dirty: state.dirty, savedAt: Date.now() };
  try {
    localStorage.setItem(KEY_BACKUP, JSON.stringify(value));
  } catch (e) {
    console.error('控えを保存できませんでした', e);
  }
  saveAutosave(state).catch(() => {});
}

/** ファイル名に使えない文字を置き換える */
export function safeFileName(name: string): string {
  const cleaned = name.replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_').trim();
  return cleaned === '' ? DEFAULT_CASE_NAME : cleaned;
}

export function caseNameFromFileName(fileName: string): string {
  return fileName.replace(/\.json$/i, '').trim() || DEFAULT_CASE_NAME;
}

export function serializeCase(data: CaseData): string {
  return JSON.stringify(data, null, 2);
}

/** 端末にファイルとして保存させる（ダウンロード） */
function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/** ケースを JSON ファイルとして書き出す（ファイル名＝ケース名） */
export function exportCaseFile(data: CaseData): void {
  downloadBlob(new Blob([serializeCase(data)], { type: 'application/json' }), `${safeFileName(data.caseName)}.json`);
}

/** レジュメ（入力部分のみ）を Word ファイルとして書き出す。Word の部品は必要になったときに読み込む */
export async function exportResumeFile(data: CaseData): Promise<void> {
  const { buildResumeBlob } = await import('../export/resumeDocx');
  downloadBlob(await buildResumeBlob(data), `${safeFileName(data.caseName)}_レジュメ.docx`);
}

/** JSON ファイルからケースを読み込む。ケース名はファイル名から付ける */
export async function importCaseFile(file: File): Promise<CaseData> {
  let raw: unknown;
  try {
    raw = JSON.parse(await file.text());
  } catch {
    throw new CaseParseError('ファイルを読み込めませんでした。JSON 形式のケースファイルを選んでください。');
  }
  const data = parseCase(raw);
  data.caseName = caseNameFromFileName(file.name);
  return data;
}

export { CaseParseError };
