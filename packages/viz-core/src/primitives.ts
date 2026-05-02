// @def.boundary viz-system-root
// @def.doc viz-system-root

/**
 * SVG Primitive Builders
 *
 * 순수 SVG 요소 문자열 빌더. 도메인 지식 없음.
 * 모든 좌표는 user-space 단위. 속성은 key-value Record로 전달.
 */

// ── 속성 타입 ─────────────────────────────────────────

export type Attrs = Record<string, string | number | undefined>;

/** 속성 맵 → "k=\"v\" ..." 문자열 */
function attrs(a: Attrs): string {
  return Object.entries(a)
    .filter(([, v]) => v !== undefined)
    .map(([k, v]) => `${k}="${v}"`)
    .join(" ");
}

// ── 기본 요소 ─────────────────────────────────────────

export function svgRect(
  x: number, y: number, w: number, h: number,
  a: Attrs = {},
): string {
  return `<rect x="${r(x)}" y="${r(y)}" width="${r(w)}" height="${r(h)}" ${attrs(a)}/>`;
}

export function svgCircle(cx: number, cy: number, radius: number, a: Attrs = {}): string {
  return `<circle cx="${r(cx)}" cy="${r(cy)}" r="${r(radius)}" ${attrs(a)}/>`;
}

export function svgPolygon(points: [number, number][], a: Attrs = {}): string {
  const pts = points.map(([x, y]) => `${r(x)},${r(y)}`).join(" ");
  return `<polygon points="${pts}" ${attrs(a)}/>`;
}

export function svgLine(x1: number, y1: number, x2: number, y2: number, a: Attrs = {}): string {
  return `<line x1="${r(x1)}" y1="${r(y1)}" x2="${r(x2)}" y2="${r(y2)}" ${attrs(a)}/>`;
}

export function svgPath(d: string, a: Attrs = {}): string {
  return `<path d="${d}" ${attrs(a)}/>`;
}

export function svgText(
  x: number, y: number,
  content: string,
  a: Attrs = {},
): string {
  return `<text x="${r(x)}" y="${r(y)}" ${attrs(a)}>${escapeXml(content)}</text>`;
}

export function svgGroup(children: string[], a: Attrs = {}): string {
  const attrStr = Object.keys(a).length ? ` ${attrs(a)}` : "";
  return `<g${attrStr}>\n  ${children.join("\n  ")}\n</g>`;
}

export function svgSvg(
  width: number, height: number,
  children: string[],
  extra: Attrs = {},
): string {
  const baseAttrs = attrs({
    xmlns: "http://www.w3.org/2000/svg",
    width: r(width),
    height: r(height),
    viewBox: `0 0 ${r(width)} ${r(height)}`,
    "font-family": "system-ui,sans-serif",
    ...extra,
  });
  return `<svg ${baseAttrs}>\n${children.join("\n")}\n</svg>`;
}

// ── 경로 빌더 ─────────────────────────────────────────

/** 수평 베지어 곡선 (왼→오) */
export function bezierH(x1: number, y1: number, x2: number, y2: number): string {
  const mx = (x1 + x2) / 2;
  return `M ${r(x1)} ${r(y1)} C ${r(mx)} ${r(y1)}, ${r(mx)} ${r(y2)}, ${r(x2)} ${r(y2)}`;
}

/** 위로 호를 그리는 U턴 곡선 */
export function arcAbove(x1: number, y1: number, x2: number, y2: number, lift: number): string {
  return `M ${r(x1)} ${r(y1)} C ${r(x1)} ${r(y1 - lift)}, ${r(x2)} ${r(y2 - lift)}, ${r(x2)} ${r(y2)}`;
}

// ── SVG marker defs 빌더 ──────────────────────────────

export interface MarkerDef {
  id: string;
  markerWidth: number;
  markerHeight: number;
  refX: number;
  refY: number;
  inner: string;
  orient?: string;
}

export function svgMarker(def: MarkerDef): string {
  const orient = def.orient ?? "auto";
  return `<marker id="${def.id}" markerWidth="${def.markerWidth}" markerHeight="${def.markerHeight}" refX="${def.refX}" refY="${def.refY}" orient="${orient}">${def.inner}</marker>`;
}

export function svgDefs(children: string[]): string {
  return `<defs>\n  ${children.join("\n  ")}\n</defs>`;
}

// ── 유틸 ─────────────────────────────────────────────

/** 소수점 2자리 반올림 */
export function r(n: number): number {
  return Math.round(n * 100) / 100;
}

export function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function escapeAttr(s: string): string {
  return s.replace(/"/g, "&quot;");
}
