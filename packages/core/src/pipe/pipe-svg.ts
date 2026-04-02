/**
 * PipeGraph → SVG / D3 데이터 변환 (그래프 레벨 렌더러)
 *
 * pipe-svg-primitives + pipe-svg-shapes 위에서 동작.
 * ZoomView의 노드/엣지 배치 정보를 시각 도형으로 변환한다.
 */

import type { PipeGraph } from "../types/pipe-spec.js";
import type { ZoomView, ZoomNode, ZoomEdge } from "./pipe-zoom.js";
import { computeZoomView, computeLayout } from "./pipe-zoom.js";
import type { FoldLevel } from "./pipe-fold.js";
import type { PipeConcern } from "./pipe-interpret.js";
import { r, escapeAttr, svgSvg } from "./pipe-svg-primitives.js";
import {
  renderMarkerDefs,
  drawNodeShape, drawFoldedNode, drawEntryMarker,
  drawConcernBadges, drawNodeLabel, drawFoldedCount,
  drawEdgePath, drawConditionBadge,
} from "./pipe-svg-shapes.js";

// ── 공개 타입 ─────────────────────────────────────────

export interface SvgOptions {
  /** 여백 (기본: 48) */
  padding?: number;
  /** 최소 뷰폭 (기본: 400) */
  minWidth?: number;
  /** 최소 뷰높이 (기본: 200) */
  minHeight?: number;
}

export interface D3Node {
  id: string;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
  isFolded: boolean;
  certainty: "strict" | "flexible" | "mixed";
  shape: "polygon" | "cloud";
  role: string;
  concerns: readonly string[];
}

export interface D3Link {
  source: string;
  target: string;
  kind: string;
  condition?: string;
}

export interface D3GraphData {
  nodes: D3Node[];
  links: D3Link[];
  entryNodeId: string;
}

// ── 공개 함수 ─────────────────────────────────────────

export function pipeGraphToSvg(
  graph: PipeGraph,
  level: FoldLevel = "leaf",
  options?: SvgOptions,
): string {
  return zoomViewToSvg(computeLayout(computeZoomView(graph, level)), options);
}

export function zoomViewToSvg(view: ZoomView, options?: SvgOptions): string {
  const padding = options?.padding ?? 48;
  const minWidth = options?.minWidth ?? 400;
  const minHeight = options?.minHeight ?? 200;

  if (view.nodes.length === 0) {
    return svgSvg(minWidth, minHeight, []);
  }

  const { offsetX, offsetY, svgWidth, svgHeight } = computeViewBox(
    view.nodes, padding, minWidth, minHeight,
  );

  const edgeLines: string[] = [];
  for (const edge of view.edges) {
    const from = view.nodes.find(n => n.id === edge.from);
    const to = view.nodes.find(n => n.id === edge.to);
    if (from && to) edgeLines.push(renderEdge(edge, from, to, offsetX, offsetY));
  }

  const nodeLines: string[] = [];
  for (const node of view.nodes) {
    nodeLines.push(renderNode(node, view.entryNodeId, offsetX, offsetY));
  }

  return svgSvg(svgWidth, svgHeight, [
    renderMarkerDefs(),
    `<g class="edges">\n${edgeLines.join("\n")}\n</g>`,
    `<g class="nodes">\n${nodeLines.join("\n")}\n</g>`,
  ]);
}

export function pipeGraphToD3(graph: PipeGraph, level: FoldLevel = "leaf"): D3GraphData {
  return zoomViewToD3(computeLayout(computeZoomView(graph, level)));
}

export function zoomViewToD3(view: ZoomView): D3GraphData {
  return {
    nodes: view.nodes.map(n => ({
      id: n.id,
      label: n.label,
      x: n.position.x,
      y: n.position.y,
      width: n.size.width,
      height: n.size.height,
      isFolded: n.isFolded,
      certainty: n.style.certainty,
      shape: n.style.shape,
      role: n.role,
      concerns: n.concerns,
    })),
    links: view.edges.map(e => ({
      source: e.from,
      target: e.to,
      kind: e.kind,
      ...(e.condition ? { condition: e.condition } : {}),
    })),
    entryNodeId: view.entryNodeId,
  };
}

// ── 내부 렌더링 ───────────────────────────────────────

function computeViewBox(
  nodes: ZoomNode[],
  padding: number,
  minWidth: number,
  minHeight: number,
) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const n of nodes) {
    minX = Math.min(minX, n.position.x - n.size.width / 2);
    minY = Math.min(minY, n.position.y - n.size.height / 2);
    maxX = Math.max(maxX, n.position.x + n.size.width / 2);
    maxY = Math.max(maxY, n.position.y + n.size.height / 2);
  }
  return {
    offsetX: -minX + padding,
    offsetY: -minY + padding,
    svgWidth: Math.max(minWidth, maxX - minX + padding * 2),
    svgHeight: Math.max(minHeight, maxY - minY + padding * 2),
  };
}

function renderNode(node: ZoomNode, entryId: string, ox: number, oy: number): string {
  const cx = node.position.x + ox;
  const cy = node.position.y + oy;
  const w = node.size.width;
  const h = node.size.height;
  const x = cx - w / 2;
  const y = cy - h / 2;

  const parts: string[] = [];

  if (node.id === entryId) parts.push(drawEntryMarker(x, cy, h));

  if (node.isFolded) {
    parts.push(drawFoldedNode(x, y, w, h));
    if (node.foldedChildCount > 0) parts.push(drawFoldedCount(cx, y + h, node.foldedChildCount));
  } else {
    parts.push(drawNodeShape(x, y, w, h, { role: node.role, style: node.style }));
  }

  parts.push(drawNodeLabel(cx, cy, node.label));

  if (!node.isFolded && node.concerns.length > 0) {
    parts.push(drawConcernBadges(node.concerns as PipeConcern[], x + w, y, h));
  }

  return `  <g class="node" data-id="${escapeAttr(node.id)}" data-role="${node.role}">\n    ${parts.join("\n    ")}\n  </g>`;
}

function renderEdge(edge: ZoomEdge, from: ZoomNode, to: ZoomNode, ox: number, oy: number): string {
  const x1 = from.position.x + ox + from.size.width / 2;
  const y1 = from.position.y + oy;
  const x2 = to.position.x + ox - to.size.width / 2;
  const y2 = to.position.y + oy;
  const lift = Math.max(from.size.height, to.size.height) + 40;

  const parts: string[] = [drawEdgePath(x1, y1, x2, y2, { kind: edge.kind, feedbackLift: lift })];
  if (edge.condition) parts.push(drawConditionBadge(x1, y1, x2, y2, edge.condition));

  return `  <g class="edge" data-kind="${edge.kind}">\n    ${parts.join("\n    ")}\n  </g>`;
}
