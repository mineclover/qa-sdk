// @def.boundary viz-system-root
// @def.doc viz-system-root

/**
 * PipeGraph → SVG / D3 데이터 변환 (그래프 레벨 렌더러)
 *
 * primitives + shapes 위에서 동작.
 * ZoomView의 노드/엣지 배치 정보를 시각 도형으로 변환한다.
 */

import type {
  PipeGraph,
  PipeFlow,
  ZoomView,
  ZoomNode,
  ZoomEdge,
  FoldLevel,
  PipeConcern,
} from '@qa-sdk/core';
import { computeZoomView, computeLayout, summarizeFlowLineage } from '@qa-sdk/core';
import { escapeAttr, svgSvg } from './primitives.js';
import {
  renderMarkerDefs,
  drawNodeShape,
  drawFoldedNode,
  drawEntryMarker,
  drawConcernBadges,
  drawNodeLabel,
  drawFoldedCount,
  drawPortDots,
  drawEdgePath,
  drawConditionBadge,
} from './shapes.js';

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
  certainty: 'strict' | 'flexible' | 'mixed';
  shape: 'polygon' | 'cloud';
  role: string;
  concerns: readonly string[];
  /** transition-scope의 transitionId (해당 파이프에 있을 때만) */
  transitionId?: string;
}

export interface D3Link {
  source: string;
  target: string;
  kind: string;
  sourcePorts?: string[];
  targetPorts?: string[];
  facetType?: string;
  condition?: string;
}

/** 파이프별 계보 요약 — D3 시각화에서 노드 tooltip/상세 표시용 */
export interface D3LineageSummary {
  pipeId: string;
  inputs: string[];
  outputs: string[];
  outputLineage: Record<string, string[]>;
}

export interface D3GraphData {
  nodes: D3Node[];
  links: D3Link[];
  entryNodeId: string;
  /** 파이프별 정적 계보 요약 (lineageHints 기반) */
  lineageSummaries?: D3LineageSummary[];
}

// ── 공개 함수 ─────────────────────────────────────────

export function pipeGraphToSvg(
  graph: PipeGraph,
  level: FoldLevel = 'leaf',
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
    view.nodes,
    padding,
    minWidth,
    minHeight,
  );

  const edgeLines: string[] = [];
  for (const edge of view.edges) {
    const from = view.nodes.find((n) => n.id === edge.from);
    const to = view.nodes.find((n) => n.id === edge.to);
    if (from && to) edgeLines.push(renderEdge(edge, from, to, offsetX, offsetY));
  }

  const nodeLines: string[] = [];
  for (const node of view.nodes) {
    nodeLines.push(renderNode(node, view.entryNodeId, offsetX, offsetY));
  }

  return svgSvg(svgWidth, svgHeight, [
    renderMarkerDefs(),
    `<g class="edges">\n${edgeLines.join('\n')}\n</g>`,
    `<g class="nodes">\n${nodeLines.join('\n')}\n</g>`,
  ]);
}

export function pipeGraphToD3(graph: PipeGraph, level: FoldLevel = 'leaf'): D3GraphData {
  const d3 = zoomViewToD3(computeLayout(computeZoomView(graph, level)));

  // transitionId 주입
  const transitionMap = new Map<string, string>();
  for (const pipe of graph.pipes) {
    const tid = findTransitionId(pipe.flow);
    if (tid) transitionMap.set(pipe.pipeId, tid);
  }
  for (const node of d3.nodes) {
    const tid = transitionMap.get(node.id);
    if (tid) node.transitionId = tid;
  }

  // lineageSummaries 주입
  const summaries: D3LineageSummary[] = [];
  for (const pipe of graph.pipes) {
    const summary = summarizeFlowLineage(pipe.flow, pipe.pipeId);
    if (summary.inputs.length > 0 || summary.outputs.length > 0) {
      summaries.push({ pipeId: pipe.pipeId, ...summary });
    }
  }
  if (summaries.length > 0) d3.lineageSummaries = summaries;

  return d3;
}

/** PipeFlow 트리에서 최상위 transition-scope의 transitionId 탐색 */
function findTransitionId(flow: PipeFlow): string | undefined {
  if (flow.kind === 'transition-scope') return flow.transitionId;
  return undefined;
}

export function zoomViewToD3(view: ZoomView): D3GraphData {
  return {
    nodes: view.nodes.map((n) => ({
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
    links: view.edges.map((e) => ({
      source: e.from,
      target: e.to,
      kind: e.kind,
      ...(e.sourcePorts ? { sourcePorts: e.sourcePorts } : {}),
      ...(e.targetPorts ? { targetPorts: e.targetPorts } : {}),
      ...((e as { facetType?: string }).facetType
        ? { facetType: (e as { facetType?: string }).facetType }
        : {}),
      ...(e.condition ? { condition: e.condition } : {}),
    })),
    entryNodeId: view.entryNodeId,
  };
}

// ── 내부 렌더링 ───────────────────────────────────────

function computeViewBox(nodes: ZoomNode[], padding: number, minWidth: number, minHeight: number) {
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
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
    if (node.ports.length > 0) {
      parts.push(drawPortDots(x, y, w, h, [...node.ports]));
    }
  }

  parts.push(drawNodeLabel(cx, cy, node.label));

  if (!node.isFolded && node.concerns.length > 0) {
    const badgeOffset = node.ports.some((port) => port.direction === 'out') ? 12 : 0;
    parts.push(drawConcernBadges(node.concerns as PipeConcern[], x + w + badgeOffset, y, h));
  }

  return `  <g class="node" data-id="${escapeAttr(node.id)}" data-role="${node.role}">\n    ${parts.join('\n    ')}\n  </g>`;
}

function renderEdge(edge: ZoomEdge, from: ZoomNode, to: ZoomNode, ox: number, oy: number): string {
  const start = resolveEdgeAnchor(from, edge.sourcePorts, 'out', ox, oy);
  const end = resolveEdgeAnchor(to, edge.targetPorts, 'in', ox, oy);
  const x1 = start.x;
  const y1 = start.y;
  const x2 = end.x;
  const y2 = end.y;
  const lift = Math.max(from.size.height, to.size.height) + 40;

  const parts: string[] = [
    drawEdgePath(x1, y1, x2, y2, {
      kind: edge.kind,
      feedbackLift: lift,
      facetType: edge.facetType,
    }),
  ];
  if (edge.condition) parts.push(drawConditionBadge(x1, y1, x2, y2, edge.condition));

  return `  <g class="edge" data-kind="${edge.kind}">\n    ${parts.join('\n    ')}\n  </g>`;
}

function resolveEdgeAnchor(
  node: ZoomNode,
  portIds: string[] | undefined,
  direction: 'in' | 'out',
  ox: number,
  oy: number,
): { x: number; y: number } {
  const cx = node.position.x + ox;
  const cy = node.position.y + oy;
  const w = node.size.width;
  const h = node.size.height;
  const fallback = {
    x: direction === 'out' ? cx + w / 2 : cx - w / 2,
    y: cy,
  };

  if (!portIds || portIds.length === 0) {
    return fallback;
  }

  const directionPorts = node.ports.filter((port) => port.direction === direction);
  if (directionPorts.length === 0) {
    return fallback;
  }

  const portId = portIds.find((candidate) =>
    directionPorts.some((port) => port.portId === candidate),
  );
  if (portId == null) {
    return fallback;
  }

  const portIndex = directionPorts.findIndex((port) => port.portId === portId);
  if (portIndex < 0) {
    return fallback;
  }

  const top = cy - h / 2;
  const step = h / (directionPorts.length + 1);
  return {
    x: fallback.x,
    y: top + step * (portIndex + 1),
  };
}
