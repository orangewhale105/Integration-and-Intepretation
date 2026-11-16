// ICIDH の図の矢印（SVG）。カードの右端から、つながる先のカードの左端へ引く。
const SVG_NS = 'http://www.w3.org/2000/svg';

export interface ArrowSpec {
  id: string;
  fromEl: Element;
  toEl: Element;
}

export function svg<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number> = {}): SVGElementTagNameMap[K] {
  const el = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v));
  return el;
}

export function createArrowLayer(markerId: string): SVGSVGElement {
  const layer = svg('svg', { class: 'arrow-layer', 'aria-hidden': 'true' });
  const defs = svg('defs');
  const marker = svg('marker', {
    id: markerId,
    viewBox: '0 0 10 10',
    refX: 9,
    refY: 5,
    markerWidth: 7,
    markerHeight: 7,
    orient: 'auto-start-reverse',
  });
  marker.append(svg('path', { d: 'M0,0 L10,5 L0,10 z', class: 'arrow-head' }));
  defs.append(marker);
  layer.append(defs);
  return layer;
}

/** 2点を結ぶ緩やかな曲線 */
export function curve(x1: number, y1: number, x2: number, y2: number): string {
  const dx = Math.max(24, (x2 - x1) / 2);
  return `M${x1},${y1} C${x1 + dx},${y1} ${x2 - dx},${y2} ${x2},${y2}`;
}

/** curve() で描いた曲線の中ほどの点 */
export function curveMidpoint(x1: number, y1: number, x2: number, y2: number): [number, number] {
  // 3次ベジェ曲線の t = 0.5。制御点は始点・終点と同じ高さにある
  const dx = Math.max(24, (x2 - x1) / 2);
  const cx1 = x1 + dx;
  const cx2 = x2 - dx;
  return [(x1 + 3 * cx1 + 3 * cx2 + x2) / 8, (y1 + y2) / 2];
}

/** 座標の基準となる要素（container）から見た位置で矢印を描く */
export function anchorPoints(container: Element, fromEl: Element, toEl: Element): [number, number, number, number] {
  const base = container.getBoundingClientRect();
  const a = fromEl.getBoundingClientRect();
  const b = toEl.getBoundingClientRect();
  return [a.right - base.left, a.top + a.height / 2 - base.top, b.left - base.left, b.top + b.height / 2 - base.top];
}
