// @def.boundary shared-utility-group
// @def.doc shared-utility-group

import type {
  RLSCDocument,
  RLSCNode,
  CanvasRenderOptions,
  LayoutMetrics,
  ProximityGroup,
  RLSCRelation,
} from "./types.js";
import { flattenTree } from "./tree-utils.js";

// ─── 기본 팔레트 ─────────────────────────────────────────────────────

const DEFAULT_ROLE_PALETTE: Record<string, string> = {
  banner: "#4A90D9",
  navigation: "#7B68EE",
  main: "#5CB85C",
  complementary: "#F0AD4E",
  contentinfo: "#D9534F",
  dialog: "#FF6B6B",
  form: "#20B2AA",
  search: "#9370DB",
};

const DEFAULT_LAYER_PALETTE: Record<string, string> = {
  background: "#E8E8E8",
  content: "#5CB85C",
  sticky: "#F0AD4E",
  overlay: "#FF9933",
  modal: "#D9534F",
  tooltip: "#9370DB",
};

// ─── 내부 유틸 ───────────────────────────────────────────────────────

/** z-index 값을 레이어 이름으로 변환 */
function zIndexToLayerName(zIndex: number): string {
  if (zIndex <= 0) return "background";
  if (zIndex < 10) return "content";
  if (zIndex < 100) return "sticky";
  if (zIndex < 1000) return "overlay";
  if (zIndex < 10000) return "modal";
  return "tooltip";
}

/** depth 기반 HSL 색상 보간 (spec: hsl(200, 60%, {30+ratio*50}%)) */
function depthToColor(depth: number, maxDepth: number): string {
  const ratio = maxDepth > 0 ? depth / maxDepth : 0;
  const lightness = Math.round(30 + ratio * 50);
  return `hsl(200, 60%, ${lightness}%)`;
}

// ─── assignColors ────────────────────────────────────────────────────

/**
 * 노드 배열에 색상을 할당한다.
 * @returns nodeId → CSS color 맵
 */
export function assignColors(
  nodes: readonly RLSCNode[],
  options: CanvasRenderOptions,
): Map<string, string> {
  const colorBy = options.colorBy ?? "role";
  const palette = options.palette;
  const result = new Map<string, string>();

  const maxDepth = nodes.reduce((max, n) => (n.depth > max ? n.depth : max), 0);

  for (const node of nodes) {
    let color: string;

    switch (colorBy) {
      case "role": {
        color = DEFAULT_ROLE_PALETTE[node.role ?? ""] ?? "#999999";
        break;
      }
      case "depth": {
        color = depthToColor(node.depth, maxDepth);
        break;
      }
      case "layer": {
        const layerName = zIndexToLayerName(node.zIndex);
        color = DEFAULT_LAYER_PALETTE[layerName] ?? "#999999";
        break;
      }
      case "custom": {
        color = (palette && palette[node.id]) ? palette[node.id]! : "#999999";
        break;
      }
      default: {
        color = DEFAULT_ROLE_PALETTE[node.role ?? ""] ?? "#999999";
        break;
      }
    }

    result.set(node.id, color);
  }

  return result;
}

// ─── SVG 오버레이 내부 함수 ──────────────────────────────────────────

function svgGridLines(width: number, height: number, cellSize: number): string {
  const lines: string[] = [];
  for (let x = cellSize; x < width; x += cellSize) {
    lines.push(
      `  <line x1="${x}" y1="0" x2="${x}" y2="${height}" stroke="#999999" stroke-width="1" opacity="0.5"/>`,
    );
  }
  for (let y = cellSize; y < height; y += cellSize) {
    lines.push(
      `  <line x1="0" y1="${y}" x2="${width}" y2="${y}" stroke="#999999" stroke-width="1" opacity="0.5"/>`,
    );
  }
  return lines.join("\n");
}

function svgProximityGroups(groups: readonly ProximityGroup[]): string {
  const parts: string[] = [];
  groups.forEach((group, index) => {
    const r = group.boundingRect;
    parts.push(
      `  <rect x="${r.x}" y="${r.y}" width="${r.width}" height="${r.height}" fill="none" stroke="#FF6600" stroke-width="1.5" stroke-dasharray="4 2" opacity="0.7"/>`,
    );
    parts.push(
      `  <text x="${r.x + 4}" y="${r.y + 14}" font-size="11" fill="#FF6600" opacity="0.9">${index + 1}</text>`,
    );
  });
  return parts.join("\n");
}

function svgBalanceAxis(width: number, height: number): string {
  const cx = Math.round(width / 2);
  const cy = Math.round(height / 2);
  return [
    `  <line x1="${cx}" y1="0" x2="${cx}" y2="${height}" stroke="#0066FF" stroke-width="1" stroke-dasharray="6 3" opacity="0.4"/>`,
    `  <line x1="0" y1="${cy}" x2="${width}" y2="${cy}" stroke="#0066FF" stroke-width="1" stroke-dasharray="6 3" opacity="0.4"/>`,
  ].join("\n");
}

function svgFlowArrows(
  relations: readonly RLSCRelation[],
  nodeMap: Map<string, RLSCNode>,
): string {
  const parts: string[] = [
    '  <defs><marker id="arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L0,6 L8,3 z" fill="#333" opacity="0.6"/></marker></defs>',
  ];

  for (const rel of relations) {
    if (rel.type !== "flow" && rel.type !== "adjacent-x" && rel.type !== "adjacent-y") {
      continue;
    }
    const src = nodeMap.get(rel.source);
    const tgt = nodeMap.get(rel.target);
    if (!src || !tgt) continue;

    const x1 = src.rect.x + src.rect.width / 2;
    const y1 = src.rect.y + src.rect.height / 2;
    const x2 = tgt.rect.x + tgt.rect.width / 2;
    const y2 = tgt.rect.y + tgt.rect.height / 2;

    parts.push(
      `  <line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="#333" stroke-width="1.5" opacity="0.5" marker-end="url(#arrow)"/>`,
    );
  }

  return parts.join("\n");
}

// ─── Canvas 오버레이 내부 함수 ───────────────────────────────────────

/** 근접성 그룹 경계를 점선 사각형으로 그린다 (내부 함수) */
function overlayProximityGroups(
  ctx: CanvasRenderingContext2D,
  groups: readonly ProximityGroup[],
  _viewport: { width: number; height: number },
): void {
  ctx.save();
  ctx.strokeStyle = "#FF6600";
  ctx.lineWidth = 1.5;
  ctx.setLineDash([4, 2]);
  ctx.globalAlpha = 0.7;
  ctx.font = "11px sans-serif";
  ctx.fillStyle = "#FF6600";

  groups.forEach((group, index) => {
    const r = group.boundingRect;
    ctx.strokeRect(r.x, r.y, r.width, r.height);
    ctx.fillText(String(index + 1), r.x + 4, r.y + 14);
  });

  ctx.restore();
}

/** 뷰포트 중앙 균형 축선을 그린다 (내부 함수) */
function overlayBalanceAxis(
  ctx: CanvasRenderingContext2D,
  viewport: { width: number; height: number },
): void {
  const cx = viewport.width / 2;
  const cy = viewport.height / 2;

  ctx.save();
  ctx.strokeStyle = "#0066FF";
  ctx.lineWidth = 1;
  ctx.setLineDash([6, 3]);
  ctx.globalAlpha = 0.4;

  ctx.beginPath();
  ctx.moveTo(cx, 0);
  ctx.lineTo(cx, viewport.height);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(0, cy);
  ctx.lineTo(viewport.width, cy);
  ctx.stroke();

  ctx.restore();
}

/** flow/adjacent-x/adjacent-y 관계를 화살표로 시각화한다 (내부 함수) */
function overlayFlowArrows(
  ctx: CanvasRenderingContext2D,
  relations: readonly RLSCRelation[],
  nodeMap: Map<string, RLSCNode>,
): void {
  ctx.save();
  ctx.strokeStyle = "#333333";
  ctx.lineWidth = 1.5;
  ctx.globalAlpha = 0.5;
  ctx.setLineDash([]);

  for (const rel of relations) {
    if (rel.type !== "flow" && rel.type !== "adjacent-x" && rel.type !== "adjacent-y") {
      continue;
    }
    const src = nodeMap.get(rel.source);
    const tgt = nodeMap.get(rel.target);
    if (!src || !tgt) continue;

    const x1 = src.rect.x + src.rect.width / 2;
    const y1 = src.rect.y + src.rect.height / 2;
    const x2 = tgt.rect.x + tgt.rect.width / 2;
    const y2 = tgt.rect.y + tgt.rect.height / 2;

    const angle = Math.atan2(y2 - y1, x2 - x1);
    const arrowLen = 8;

    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();

    // 화살표 머리
    ctx.beginPath();
    ctx.moveTo(x2, y2);
    ctx.lineTo(
      x2 - arrowLen * Math.cos(angle - Math.PI / 6),
      y2 - arrowLen * Math.sin(angle - Math.PI / 6),
    );
    ctx.moveTo(x2, y2);
    ctx.lineTo(
      x2 - arrowLen * Math.cos(angle + Math.PI / 6),
      y2 - arrowLen * Math.sin(angle + Math.PI / 6),
    );
    ctx.stroke();
  }

  ctx.restore();
}

// ─── renderToSVG ─────────────────────────────────────────────────────

/**
 * RLSCDocument를 SVG 문자열로 렌더링한다.
 * 서버/테스트 환경 호환 (DOM 참조 없음).
 */
export function renderToSVG(
  doc: RLSCDocument,
  options: CanvasRenderOptions = {},
): string {
  const { width, height } = doc.viewport;
  const opacity = options.opacity ?? 0.7;
  const cellSize = 16;

  const allNodes = flattenTree(doc.root);
  const visibleNodes = allNodes.filter((n) => n.visible);

  // z-index 오름차순 정렬
  const sorted = [...visibleNodes].sort((a, b) => a.zIndex - b.zIndex);

  const colorMap = assignColors(sorted, options);

  const parts: string[] = [];

  // 격자 오버레이
  if (options.showGrid) {
    const gridContent = svgGridLines(width, height, cellSize);
    parts.push(`<g class="overlay-grid">\n${gridContent}\n</g>`);
  }

  // 노드 rect 요소
  for (const node of sorted) {
    const color = colorMap.get(node.id) ?? "#999999";
    const { x, y, width: w, height: h } = node.rect;

    parts.push(
      `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${color}" opacity="${opacity}" stroke="#333333" stroke-width="1"/>`,
    );

    if (node.role) {
      const labelX = x + 4;
      const labelY = y + 14;
      parts.push(
        `<text x="${labelX}" y="${labelY}" font-size="10" fill="#333333" opacity="0.8">${node.role}</text>`,
      );
    }
  }

  // 근접성 그룹 오버레이
  if (options.showGroups && options.metrics) {
    const groupContent = svgProximityGroups(options.metrics.proximityGroups);
    if (groupContent) {
      parts.push(`<g class="overlay-groups">\n${groupContent}\n</g>`);
    }
  }

  // 균형 축선 오버레이
  if (options.showBalance) {
    const balanceContent = svgBalanceAxis(width, height);
    parts.push(`<g class="overlay-balance">\n${balanceContent}\n</g>`);
  }

  // flow 화살표 오버레이
  if (options.showFlow) {
    const nodeMap = new Map<string, RLSCNode>(allNodes.map((n) => [n.id, n]));
    const flowContent = svgFlowArrows(doc.relations, nodeMap);
    if (flowContent) {
      parts.push(`<g class="overlay-flow">\n${flowContent}\n</g>`);
    }
  }

  const body = parts.map((p) => `  ${p}`).join("\n");

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}">\n${body}\n</svg>`;
}

// ─── renderToCanvas ──────────────────────────────────────────────────

/**
 * RLSCDocument를 HTMLCanvasElement에 렌더링한다.
 * 브라우저 전용.
 */
export function renderToCanvas(
  doc: RLSCDocument,
  canvas: HTMLCanvasElement,
  options: CanvasRenderOptions = {},
): void {
  if (typeof window === "undefined") {
    throw new Error("renderToCanvas는 브라우저 환경에서만 실행 가능합니다");
  }

  const { width, height } = doc.viewport;
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Canvas 2D context를 가져올 수 없습니다");
  }

  const opacity = options.opacity ?? 0.7;
  const cellSize = 16;

  // 캔버스 초기화
  ctx.clearRect(0, 0, width, height);

  const allNodes = flattenTree(doc.root);
  const visibleNodes = allNodes.filter((n) => n.visible);

  // z-index 오름차순 정렬
  const sorted = [...visibleNodes].sort((a, b) => a.zIndex - b.zIndex);

  const colorMap = assignColors(sorted, options);

  // 격자 오버레이 (노드 아래)
  if (options.showGrid) {
    ctx.save();
    ctx.strokeStyle = "#999999";
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.5;

    for (let x = cellSize; x < width; x += cellSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let y = cellSize; y < height; y += cellSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    ctx.restore();
  }

  // 노드 렌더링
  for (const node of sorted) {
    const color = colorMap.get(node.id) ?? "#999999";
    const { x, y, width: w, height: h } = node.rect;

    ctx.save();
    ctx.globalAlpha = opacity;
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w, h);
    ctx.globalAlpha = 1;
    ctx.strokeStyle = "#333333";
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, w, h);
    ctx.restore();
  }

  // 오버레이 순서: grid → groups → balance → flow
  if (options.showGroups && options.metrics) {
    overlayProximityGroups(ctx, options.metrics.proximityGroups, { width, height });
  }

  if (options.showBalance) {
    overlayBalanceAxis(ctx, { width, height });
  }

  if (options.showFlow) {
    const nodeMap = new Map<string, RLSCNode>(allNodes.map((n) => [n.id, n]));
    overlayFlowArrows(ctx, doc.relations, nodeMap);
  }
}
