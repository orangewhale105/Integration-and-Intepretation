// 保存・読込・書き出しの処理はすべてこのファイルにまとめる。
// 将来スタンドアロンアプリに変換するときは、このファイルを差し替える。
// 学生が入力したデータはサーバーへ送信しない（端末内とファイルのみ）。

import type { CaseData } from '../model/types';
import { DEFAULT_CASE_NAME } from '../model/caseData';
import { CaseParseError, parseCase } from './parse';

const DB_NAME = 'integration-and-interpretation';
const STORE = 'kv';
const KEY_CURRENT = 'currentCase';

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

/** 端末内に自動保存したケースを読み込む。なければ null */
export async function loadAutosave(): Promise<SavedState | null> {
  const raw = await withStore<unknown>('readonly', (s) => s.get(KEY_CURRENT));
  if (!raw || typeof raw !== 'object') return null;
  const saved = raw as { data?: unknown; dirty?: unknown };
  try {
    return { data: parseCase(saved.data), dirty: saved.dirty === true };
  } catch {
    return null;
  }
}

/** 端末内に自動保存する */
export async function saveAutosave(state: SavedState): Promise<void> {
  // structuredClone で保存時点の内容を固定する
  const value = { data: structuredClone(state.data), dirty: state.dirty };
  await withStore('readwrite', (s) => s.put(value, KEY_CURRENT));
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

/** ケースを JSON ファイルとして書き出す（ファイル名＝ケース名） */
export function exportCaseFile(data: CaseData): void {
  const blob = new Blob([serializeCase(data)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${safeFileName(data.caseName)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
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
