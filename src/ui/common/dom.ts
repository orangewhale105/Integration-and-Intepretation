type Attrs = Record<string, string | number | boolean | undefined | null>;

/** 要素を作る小さなヘルパー */
export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Attrs = {},
  ...children: Array<Node | string | null | undefined | false>
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === null || v === false) continue;
    if (k === 'class') el.className = String(v);
    else if (v === true) el.setAttribute(k, '');
    else el.setAttribute(k, String(v));
  }
  for (const c of children) {
    if (c === null || c === undefined || c === false) continue;
    el.append(c);
  }
  return el;
}

/** 入力欄の内容に合わせて textarea の高さを変える */
export function autoGrow(ta: HTMLTextAreaElement): void {
  ta.style.height = 'auto';
  ta.style.height = `${ta.scrollHeight + 2}px`;
}
