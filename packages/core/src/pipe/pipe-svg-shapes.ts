/**
 * Pipe SVG 도형 + 디자인 토큰
 *
 * pipe-svg-primitives 위에서 동작하는 도메인 도형 레이어.
 * PipeRole, ConnectionKind, PipeConcern에 맞는 도형과 색상 토큰을 제공한다.
 * 이 모듈을 직접 import하면 그래프 없이도 개별 도형을 렌더링할 수 있다.
 */

import {
  escapeXml,
  svgRect, svgPolygon, svgCircle, svgPath, svgText, svgGroup,
  svgMarker, svgDefs,
  bezierH, arcAbove,
  type MarkerDef,
} from "./pipe-svg-primitives.js";
import type { PipeConcern, PipeRole } from "./pipe-interpret.js";
import type { ConnectionKind, PipePort } from "../types/pipe-spec.js";
import type { ZoomNodeStyle } from "./pipe-zoom.js";

// ── 디자인 토큰 ───────────────────────────────────────

export interface RoleTokens {
  fill: string;
  stroke: string;
}

/** PipeRole 5종 색상 토큰 */
export const ROLE_TOKENS: Record<PipeRole, RoleTokens> = {
  producer:    { fill: "#e3f2fd", stroke: "#1565c0" },
  consumer:    { fill: "#f3e5f5", stroke: "#6a1b9a" },
  transformer: { fill: "#e8f5e9", stroke: "#2e7d32" },
  router:      { fill: "#fff8e1", stroke: "#f57f17" },
  observer:    { fill: "#fce4ec", stroke: "#c62828" },
};

/** certainty별 테두리 스타일 */
export const CERTAINTY_STROKE_DASH: Record<ZoomNodeStyle["certainty"], string | undefined> = {
  strict:   undefined,
  flexible: "6 3",
  mixed:    "4 2",
};

export interface ConcernTokens {
  color: string;
  letter: string;
}

/** PipeConcern 8종 배지 토큰 */
export const CONCERN_TOKENS: Record<PipeConcern, ConcernTokens> = {
  "resilience":     { color: "#ef9a9a", letter: "R" },
  "latency":        { color: "#ffcc02", letter: "L" },
  "concurrency":    { color: "#80cbc4", letter: "C" },
  "data-mutation":  { color: "#f48fb1", letter: "M" },
  "data-read":      { color: "#a5d6a7", letter: "D" },
  "async-coupling": { color: "#90caf9", letter: "A" },
  "data-filtering": { color: "#ce93d8", letter: "F" },
  "observability":  { color: "#b0bec5", letter: "O" },
};

export interface EdgeTokens {
  stroke: string;
  strokeWidth: number;
  strokeDash?: string;
  markerEnd: string;
  markerStart?: string;
}

/** ConnectionKind 8종 엣지 토큰 */
export const EDGE_TOKENS: Record<ConnectionKind, EdgeTokens> = {
  next:        { stroke: "#546e7a", strokeWidth: 2,   markerEnd: "arr-next" },
  conditional: { stroke: "#1976d2", strokeWidth: 2,   strokeDash: "8 4", markerEnd: "arr-cond" },
  event:       { stroke: "#6a1b9a", strokeWidth: 3,   markerEnd: "arr-event" },
  error:       { stroke: "#c62828", strokeWidth: 2.5, strokeDash: "4 3", markerEnd: "arr-error" },
  compensate:  { stroke: "#ad1457", strokeWidth: 2.5, strokeDash: "3 3", markerEnd: "arr-comp-end", markerStart: "arr-comp-start" },
  "fan-out":   { stroke: "#0288d1", strokeWidth: 2,   markerEnd: "arr-fanout" },
  join:        { stroke: "#2e7d32", strokeWidth: 2,   markerEnd: "arr-join" },
  feedback:    { stroke: "#e65100", strokeWidth: 1.5, strokeDash: "6 3", markerEnd: "arr-feedback" },
};

const DEFAULT_PORT_COLOR = "#90a4ae";

// ── Marker defs ───────────────────────────────────────

const MARKER_DEFS: MarkerDef[] = [
  { id: "arr-next",       markerWidth: 10, markerHeight: 7,  refX: 10, refY: 3.5,
    inner: `<polygon points="0 0,10 3.5,0 7" fill="#546e7a"/>` },
  { id: "arr-cond",       markerWidth: 10, markerHeight: 8,  refX: 10, refY: 4,
    inner: `<polygon points="1 1,10 4,1 7" fill="none" stroke="#1976d2" stroke-width="1.5"/>` },
  { id: "arr-event",      markerWidth: 12, markerHeight: 9,  refX: 12, refY: 4.5,
    inner: `<polygon points="0 0,12 4.5,0 9" fill="#6a1b9a"/>` },
  { id: "arr-error",      markerWidth: 10, markerHeight: 10, refX: 10, refY: 5,
    inner: `<line x1="1" y1="1" x2="9" y2="9" stroke="#c62828" stroke-width="2"/><line x1="9" y1="1" x2="1" y2="9" stroke="#c62828" stroke-width="2"/>` },
  { id: "arr-comp-end",   markerWidth: 8,  markerHeight: 8,  refX: 8,  refY: 4,
    inner: `<circle cx="4" cy="4" r="3" fill="none" stroke="#ad1457" stroke-width="1.5"/>` },
  { id: "arr-comp-start", markerWidth: 8,  markerHeight: 8,  refX: 0,  refY: 4,
    inner: `<circle cx="4" cy="4" r="3" fill="none" stroke="#ad1457" stroke-width="1.5"/>` },
  { id: "arr-fanout",     markerWidth: 10, markerHeight: 8,  refX: 10, refY: 4,
    inner: `<polygon points="1 1,10 4,1 7" fill="none" stroke="#0288d1" stroke-width="1.5"/>` },
  { id: "arr-join",       markerWidth: 10, markerHeight: 7,  refX: 10, refY: 3.5,
    inner: `<polygon points="0 0,10 3.5,0 7" fill="#2e7d32"/>` },
  { id: "arr-feedback",   markerWidth: 10, markerHeight: 8,  refX: 10, refY: 4,
    inner: `<polygon points="1 1,10 4,1 7" fill="none" stroke="#e65100" stroke-width="1.5"/>` },
];

/** SVG <defs> 마커 블록 — 한 SVG당 한 번만 삽입 */
export function renderMarkerDefs(): string {
  return svgDefs(MARKER_DEFS.map(svgMarker));
}

// ── 노드 도형 ─────────────────────────────────────────

export interface NodeShapeOptions {
  role: PipeRole;
  style: ZoomNodeStyle;
}

/**
 * 노드 본체 도형 (role + certainty 반영).
 * x, y는 bounding box의 좌상단 좌표.
 */
export function drawNodeShape(
  x: number, y: number, w: number, h: number,
  { role, style }: NodeShapeOptions,
): string {
  const { fill, stroke } = ROLE_TOKENS[role] ?? { fill: "#eceff1", stroke: "#546e7a" };
  const dash = CERTAINTY_STROKE_DASH[style.certainty];
  const dashAttr = dash ? { "stroke-dasharray": dash } : {};
  const cx = x + w / 2;
  const cy = y + h / 2;

  switch (role) {
    case "producer": {
      // 오른쪽 뾰족 화살표
      const a = h * 0.38;
      return svgPolygon(
        [[x, y], [x + w - a, y], [x + w, cy], [x + w - a, y + h], [x, y + h]],
        { fill, stroke, "stroke-width": 2, ...dashAttr },
      );
    }
    case "consumer": {
      // 왼쪽 홈(notch) 화살표
      const a = h * 0.38;
      return svgPolygon(
        [[x + a, y], [x + w, y], [x + w, y + h], [x + a, y + h], [x, cy]],
        { fill, stroke, "stroke-width": 2, ...dashAttr },
      );
    }
    case "transformer": {
      // 평행사변형
      const sk = 14;
      return svgPolygon(
        [[x + sk, y], [x + w, y], [x + w - sk, y + h], [x, y + h]],
        { fill, stroke, "stroke-width": 2, ...dashAttr },
      );
    }
    case "router": {
      // 마름모 (diamond)
      return svgPolygon(
        [[cx, y], [x + w, cy], [cx, y + h], [x, cy]],
        { fill, stroke, "stroke-width": 2, ...dashAttr },
      );
    }
    case "observer": {
      // 얇은 점선 rect
      return svgRect(x, y, w, h, {
        rx: 4, fill, stroke,
        "stroke-width": 1.5,
        "stroke-dasharray": "5 3",
      });
    }
    default: {
      const rx = style.shape === "cloud" ? 12 : 4;
      return svgRect(x, y, w, h, { rx, fill, stroke, "stroke-width": 2, ...dashAttr });
    }
  }
}

/** 접힌 노드: 이중 테두리 stadium */
export function drawFoldedNode(x: number, y: number, w: number, h: number): string {
  const rx = h / 2;
  return [
    svgRect(x, y, w, h, {
      rx, fill: "#e1f5fe", stroke: "#0288d1", "stroke-width": 3,
    }),
    svgRect(x + 4, y + 4, w - 8, h - 8, {
      rx: Math.max(0, rx - 4), fill: "none", stroke: "#0288d1",
      "stroke-width": 1, "stroke-dasharray": "3 2",
    }),
  ].join("\n");
}

/** entry 마커: 노드 좌측 삼각형 ▶ */
export function drawEntryMarker(nodeX: number, cy: number, h: number): string {
  const size = Math.min(h * 0.3, 10);
  const tx = nodeX - 14;
  return svgPolygon(
    [[tx - size, cy - size], [tx, cy], [tx - size, cy + size]],
    { fill: "#5c6bc0" },
  );
}

/** concern 배지: 노드 우상단에 최대 4개 원형 배지 */
export function drawConcernBadges(
  concerns: readonly PipeConcern[],
  nodeRight: number, nodeTop: number, nodeHeight: number,
): string {
  const radius = 7;
  const gap = radius * 2 + 2;
  const startY = nodeTop + nodeHeight * 0.25;

  return concerns.slice(0, 4).map((c, i) => {
    const meta = CONCERN_TOKENS[c];
    if (!meta) return "";
    const bx = nodeRight + 2;
    const by = startY + i * gap;
    return [
      svgCircle(bx, by, radius, { fill: meta.color, stroke: "#fff", "stroke-width": 1 }),
      svgText(bx, by + 4, meta.letter, {
        "text-anchor": "middle", "font-size": 8, "font-weight": 700, fill: "#333",
      }),
    ].join("");
  }).filter(Boolean).join("\n");
}

/** 노드 레이블 텍스트 */
export function drawNodeLabel(cx: number, cy: number, label: string): string {
  return svgText(cx, cy + 5, label, {
    "text-anchor": "middle",
    "font-size": 11,
    "font-weight": 500,
    fill: "#1a1a1a",
    "pointer-events": "none",
  });
}

/** 접힌 노드 카운트 텍스트 */
export function drawFoldedCount(cx: number, bottom: number, count: number): string {
  return svgText(cx, bottom - 6, `×${count} pipes`, {
    "text-anchor": "middle",
    "font-size": 9,
    fill: "#546e7a",
  });
}

function hslToHex(hue: number, saturation: number, lightness: number): string {
  const s = saturation / 100;
  const l = lightness / 100;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const h = hue / 60;
  const x = c * (1 - Math.abs(h % 2 - 1));

  let red = 0;
  let green = 0;
  let blue = 0;

  if (h >= 0 && h < 1) {
    red = c;
    green = x;
  } else if (h < 2) {
    red = x;
    green = c;
  } else if (h < 3) {
    green = c;
    blue = x;
  } else if (h < 4) {
    green = x;
    blue = c;
  } else if (h < 5) {
    red = x;
    blue = c;
  } else {
    red = c;
    blue = x;
  }

  const m = l - c / 2;
  const toHex = (value: number) => Math.round((value + m) * 255)
    .toString(16)
    .padStart(2, "0");

  return `#${toHex(red)}${toHex(green)}${toHex(blue)}`;
}

function hashFacetTypeColor(facetType?: string): string {
  if (!facetType) return DEFAULT_PORT_COLOR;

  let hash = 0;
  for (const char of facetType) {
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  }

  return hslToHex(hash % 360, 58 + (hash % 10), 46 + (hash % 8));
}

function renderPortDot(
  cx: number,
  cy: number,
  port: PipePort,
): string {
  const radius = 5.5;
  const directionClass = port.direction === "in" ? "port-dot-in" : "port-dot-out";
  const color = hashFacetTypeColor(port.facetType);
  const title = port.facetType
    ? `${port.portId} (${port.facetType})`
    : port.portId;
  const points: [number, number][] = port.direction === "in"
    ? [[cx + 1.75, cy - 2.5], [cx - 1.75, cy], [cx + 1.75, cy + 2.5]]
    : [[cx - 1.75, cy - 2.5], [cx + 1.75, cy], [cx - 1.75, cy + 2.5]];

  return [
    `<g class="port-dot ${directionClass}">`,
    `  <title>${escapeXml(title)}</title>`,
    `  ${svgCircle(cx, cy, radius, { fill: color, stroke: "#ffffff", "stroke-width": 1.4 })}`,
    `  ${svgPolygon(points, { fill: "#ffffff", opacity: 0.95 })}`,
    `</g>`,
  ].join("\n");
}

/** 노드 경계 포트 점: input=왼쪽, output=오른쪽 */
export function drawPortDots(
  x: number, y: number, w: number, h: number,
  ports: PipePort[],
): string {
  if (ports.length === 0) return "";

  const parts: string[] = [];
  const groups: Array<[PipePort["direction"], number]> = [["in", x], ["out", x + w]];

  for (const [direction, cx] of groups) {
    const directionPorts = ports.filter(port => port.direction === direction);
    const step = h / (directionPorts.length + 1);

    directionPorts.forEach((port, index) => {
      const cy = y + step * (index + 1);
      parts.push(renderPortDot(cx, cy, port));
    });
  }

  return parts.length > 0 ? svgGroup(parts, { class: "port-dots" }) : "";
}

// ── 엣지 도형 ─────────────────────────────────────────

export interface EdgePathOptions {
  kind: ConnectionKind;
  /** feedback U턴 lift 높이 (기본: nodeHeight + 40) */
  feedbackLift?: number;
}

/** 엣지 path 요소 (마커 참조 포함) */
export function drawEdgePath(
  x1: number, y1: number,
  x2: number, y2: number,
  { kind, feedbackLift = 100 }: EdgePathOptions,
): string {
  const token = EDGE_TOKENS[kind] ?? EDGE_TOKENS.next;

  const d = kind === "feedback"
    ? arcAbove(x1, y1, x2, y2, feedbackLift)
    : bezierH(x1, y1, x2, y2);

  const parts: string[] = [];

  // event 엣지: 외곽선으로 이중 효과
  if (kind === "event") {
    parts.push(svgPath(d, {
      fill: "none",
      stroke: "#d1a8e8",
      "stroke-width": token.strokeWidth + 2,
      opacity: 0.4,
    }));
  }

  const pathAttrs: Record<string, string | number | undefined> = {
    fill: "none",
    stroke: token.stroke,
    "stroke-width": token.strokeWidth,
    "stroke-dasharray": token.strokeDash,
    "marker-end": `url(#${token.markerEnd})`,
    "marker-start": token.markerStart ? `url(#${token.markerStart})` : undefined,
  };

  parts.push(svgPath(d, pathAttrs));
  return parts.join("\n");
}

/** conditional 엣지 조건 라벨 pill 배지 */
export function drawConditionBadge(
  x1: number, y1: number,
  x2: number, y2: number,
  condition: string,
): string {
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2;
  const approxW = Math.max(condition.length * 6.5 + 12, 40);
  const bx = mx - approxW / 2;
  const by = my - 24;

  return [
    svgRect(bx, by, approxW, 16, {
      rx: 8, fill: "#e3f2fd", stroke: "#1976d2", "stroke-width": 1,
    }),
    svgText(mx, by + 12, condition, {
      "text-anchor": "middle",
      "font-size": 10,
      fill: "#1976d2",
    }),
  ].join("\n");
}

// ── 독립 렌더링 헬퍼 (Design Catalog용) ──────────────

export interface StandaloneNodeOptions {
  role: PipeRole;
  label: string;
  certainty?: ZoomNodeStyle["certainty"];
  concerns?: PipeConcern[];
  ports?: PipePort[];
  isEntry?: boolean;
  isFolded?: boolean;
  foldedCount?: number;
  width?: number;
  height?: number;
  padding?: number;
}

/**
 * 단독 노드 SVG.
 * PipeGraph 없이 노드 하나만 렌더링할 때 사용.
 */
export function standaloneNodeSvg(opts: StandaloneNodeOptions): string {
  const {
    role, label,
    certainty = "strict",
    concerns = [],
    ports = [],
    isEntry = false,
    isFolded = false,
    foldedCount = 0,
    width = 140,
    height = 60,
    padding = 28,
  } = opts;

  const entryW = isEntry ? 20 : 0;
  const x = padding + entryW;
  const y = padding;
  const cx = x + width / 2;
  const cy = y + height / 2;
  const hasOutputPorts = ports.some(port => port.direction === "out");

  const parts: string[] = [];

  if (isEntry) parts.push(drawEntryMarker(x, cy, height));

  if (isFolded) {
    parts.push(drawFoldedNode(x, y, width, height));
    if (foldedCount > 0) parts.push(drawFoldedCount(cx, y + height, foldedCount));
  } else {
    const style: ZoomNodeStyle = {
      certainty,
      shape: certainty === "flexible" ? "cloud" : "polygon",
      borderStyle: certainty === "flexible" ? "dashed" : "solid",
    };
    parts.push(drawNodeShape(x, y, width, height, { role, style }));
  }

  if (!isFolded && ports.length > 0) {
    parts.push(drawPortDots(x, y, width, height, ports));
  }

  parts.push(drawNodeLabel(cx, cy, label));

  if (concerns.length > 0) {
    parts.push(drawConcernBadges(concerns, x + width + (hasOutputPorts ? 12 : 0), y, height));
  }

  return svgGroup(parts, {});
}

export interface StandaloneEdgeOptions {
  kind: ConnectionKind;
  condition?: string;
  width?: number;
  height?: number;
  padding?: number;
}

/**
 * 단독 엣지 SVG (A ──→ B).
 * PipeGraph 없이 엣지 하나만 렌더링할 때 사용.
 */
export function standaloneEdgeSvg(opts: StandaloneEdgeOptions): string {
  const {
    kind, condition,
    width = 280, height = 110, padding = 32,
  } = opts;

  const nodeW = 70, nodeH = 44;
  const ax = padding;
  const bx = width - padding - nodeW;
  const cy = height / 2;

  const x1 = ax + nodeW;
  const x2 = bx;

  const parts: string[] = [
    renderMarkerDefs(),
    // A 노드
    svgRect(ax, cy - nodeH / 2, nodeW, nodeH, { rx: 4, fill: "#eceff1", stroke: "#78909c", "stroke-width": 1.5 }),
    svgText(ax + nodeW / 2, cy + 5, "A", { "text-anchor": "middle", "font-size": 13, fill: "#37474f" }),
    // B 노드
    svgRect(bx, cy - nodeH / 2, nodeW, nodeH, { rx: 4, fill: "#eceff1", stroke: "#78909c", "stroke-width": 1.5 }),
    svgText(bx + nodeW / 2, cy + 5, "B", { "text-anchor": "middle", "font-size": 13, fill: "#37474f" }),
    // 엣지
    drawEdgePath(x1, cy, x2, cy, { kind, feedbackLift: nodeH + 40 }),
    // 조건 배지
    ...(condition ? [drawConditionBadge(x1, cy, x2, cy, condition)] : []),
  ];

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" font-family="system-ui,sans-serif">\n${parts.join("\n")}\n</svg>`;
}
