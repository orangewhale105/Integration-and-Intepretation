import './styles/base.css';
import './styles/screen1.css';
import './styles/print.css';
import { store } from './store';
import { loadAutosave } from './storage/storage';
import { h } from './ui/common/dom';
import { createHeader } from './ui/header';
import { createScreen1 } from './ui/screen1/screen1';
import { createSendColumn } from './ui/screen1/sendColumn';
import { createScreen2 } from './ui/screen2/screen2';
import { createSplitter } from './ui/splitter';

async function start(): Promise<void> {
  try {
    const saved = await loadAutosave();
    if (saved) store.replace(saved.data, saved.dirty);
  } catch (e) {
    console.error('自動保存の読み込みに失敗しました', e);
  }

  const split = h('main', { class: 'split' });
  const screen1 = h('div', { class: 'pane pane-left' }, createScreen1(), createSendColumn());
  const screen2 = h('div', { class: 'pane pane-right' }, createScreen2());
  split.append(screen1, createSplitter(split), screen2);

  document.getElementById('app')!.replaceChildren(createHeader(), split);

  window.addEventListener('pagehide', () => store.flush());
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') store.flush();
  });

  if ('serviceWorker' in navigator && import.meta.env.PROD) {
    navigator.serviceWorker.register('./sw.js').catch((e) => console.error('Service Worker の登録に失敗しました', e));
  }
}

start();
