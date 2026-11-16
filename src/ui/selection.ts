// 統合と解釈で選んだカード。単一検査の解釈の画面で、同じカードを強調表示するために共有する。
type Listener = (cardId: string | null) => void;

let selected: string | null = null;
const listeners = new Set<Listener>();

export const selection = {
  get: (): string | null => selected,
  set(cardId: string | null): void {
    if (selected === cardId) return;
    selected = cardId;
    listeners.forEach((f) => f(cardId));
  },
  subscribe(f: Listener): void {
    listeners.add(f);
  },
};
