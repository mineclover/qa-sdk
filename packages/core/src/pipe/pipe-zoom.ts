/**
 * PipeGraph 줌 레벨 시각화 — 접기/펼치기의 다중 해상도 뷰 계산
 *
 * 3단계 줌 레벨(group/module/leaf)에서 PipeGraph의 시각화 데이터를 생성한다.
 * 실제 렌더링은 소비자(Mermaid, D3, Canvas 등)가 담당하고,
 * 이 모듈은 노드/엣지/레이아웃/스타일 데이터만 제공한다.
 */

import type {
  PipeSpec, PipeGraph, ConnectionKind, PipePort,
} from "../types/pipe-spec.js";
import type { FoldLevel, FoldedContract, FoldRegion } from "./pipe-fold.js";
import {
  foldSubgraph, detectFoldRegions,
  collectFlowSteps,
} from "./pipe-fold.js";
import { countPipePaths, countGraphPaths } from "./pipe-path.js";
import { extractPipeConcerns, propagatePipeConcerns, classifyPipeRole } from "./pipe-interpret.js";
import type { PipeConcern, PipeRole } from "./pipe-interpret.js";
import { normalizePortRefs } from "./pipe-endpoint.js";
import { resolvePorts } from "./pipe-port.js";

// ── 타입 정의 ─────────────────────────────────────────

/** 줌 노드의 시각 스타일 */
export interface ZoomNodeStyle {
  /** 타입 확실성 */
  certainty: "strict" | "flexible" | "mixed";
  /** 형태: strict→다각형, flexible→구름 */
  shape: "polygon" | "cloud";
  /** 경계선: strict→실선, flexible→점선 */
  borderStyle: "solid" | "dashed";
}

/** 줌 뷰의 노드 */
export interface ZoomNode {
  /** 노드 ID */
  id: string;
  /** 표시 라벨 */
  label: string;
  /** 줌 레벨 */
  level: FoldLevel;
  /** 레이아웃 위치 (computeLayout 호출 후 설정) */
  position: { x: number; y: number };
  /** 크기 (내부 복잡도에 비례) */
  size: { width: number; height: number };
  /** 시각 스타일 */
  style: ZoomNodeStyle;
  /** 역할 분류 */
  role: PipeRole;
  /** 횡단 관심사 */
  concerns: readonly PipeConcern[];
  /** 접힌 상태 여부 */
  isFolded: boolean;
  /** 접힌 계약 (isFolded=true일 때) */
  contract?: FoldedContract;
  /** 내부 파이프 수 */
  foldedChildCount: number;
  /** 노드 경계 포트 */
  ports: readonly PipePort[];
  /** 총 경로 수 */
  totalPaths: number;
  /** scope */
  scope?: string;
  /** aspect */
  aspect?: string;
}

/** 줌 뷰의 엣지 */
export interface ZoomEdge {
  /** 출발 노드 */
  from: string;
  /** 도착 노드 */
  to: string;
  /** 연결 종류 */
  kind: ConnectionKind;
  /** 흐르는 데이터 facet 타입 */
  facetType?: string;
  /** source PortRef 메타데이터 */
  sourcePorts?: string[];
  /** target PortRef 메타데이터 */
  targetPorts?: string[];
  /** 조건 (conditional일 때) */
  condition?: string;
}

/** 줌 뷰 요약 */
export interface ZoomSummary {
  /** 노드 수 */
  nodeCount: number;
  /** 엣지 수 */
  edgeCount: number;
  /** 총 경로 수 */
  totalPaths: number;
  /** 접힌 노드 수 */
  foldedNodeCount: number;
  /** 전체 원본 파이프 수 */
  originalPipeCount: number;
  /** 관심사 분포 */
  concernCounts: Partial<Record<PipeConcern, number>>;
}

/** 특정 줌 레벨의 뷰 */
export interface ZoomView {
  /** 줌 레벨 */
  level: FoldLevel;
  /** 노드 목록 */
  nodes: ZoomNode[];
  /** 엣지 목록 */
  edges: ZoomEdge[];
  /** 요약 */
  summary: ZoomSummary;
  /** 진입 노드 ID */
  entryNodeId: string;
}

/** 3단계 줌 레벨 맵 */
export interface ZoomLevelMap {
  /** L0: 시스템 수준 — 큰 그룹만 */
  group: ZoomView;
  /** L1: 모듈 수준 — 모듈 계약만 */
  module: ZoomView;
  /** L2: 리프 수준 — 전체 파이프 */
  leaf: ZoomView;
}

// ── 레이아웃 상수 ──────────────────────────────────────

const LAYER_GAP = 200;
const NODE_GAP = 100;
const BASE_NODE_WIDTH = 120;
const BASE_NODE_HEIGHT = 60;
const SIZE_SCALE_FACTOR = 0.5;

// ── 공개 함수 ─────────────────────────────────────────

/**
 * PipeGraph에서 모든 줌 레벨의 뷰를 계산한다.
 *
 * L0(group): 모든 감지 영역을 접어 최대 축소
 * L1(module): 선형 체인과 SCC만 접어 중간 상세
 * L2(leaf): 접기 없이 전체 파이프 노출
 */
export function computeZoomLevels(graph: PipeGraph): ZoomLevelMap {
  return {
    group: computeZoomView(graph, "group"),
    module: computeZoomView(graph, "module"),
    leaf: computeZoomView(graph, "leaf"),
  };
}

/**
 * 특정 줌 레벨의 뷰를 계산한다.
 */
export function computeZoomView(graph: PipeGraph, level: FoldLevel): ZoomView {
  if (level === "leaf") {
    return buildLeafView(graph);
  }

  const regions = detectFoldRegions(graph);

  // 레벨에 따라 접을 영역 필터링
  const targetReasons = getTargetReasons(level);
  const filteredRegions = regions.filter(r => targetReasons.has(r.reason));

  // 겹치는 영역 제외하면서 순차 접기
  let currentGraph = graph;
  const foldedContracts = new Map<string, FoldedContract>();
  const consumedPipeIds = new Set<string>();

  for (const region of filteredRegions) {
    if (region.pipeIds.some(id => consumedPipeIds.has(id))) continue;

    const foldId = `fold_${level}_${region.regionId}`;
    const folded = foldSubgraph(currentGraph, region.pipeIds, foldId, level);
    currentGraph = folded.graph;

    for (const [id, entry] of folded.foldMap) {
      foldedContracts.set(id, entry.contract);
    }
    for (const id of region.pipeIds) {
      consumedPipeIds.add(id);
    }
  }

  return buildView(currentGraph, level, foldedContracts, graph.pipes.length);
}

/**
 * ZoomView에 레이아웃(노드 위치)을 계산하여 반환한다.
 * 위상 정렬 기반 계층 배치 — x축=데이터 흐름 방향, y축=계층 내 분산.
 */
export function computeLayout(view: ZoomView): ZoomView {
  if (view.nodes.length === 0) return view;

  // 인접 리스트
  const outAdj = new Map<string, string[]>();
  const inAdj = new Map<string, string[]>();
  for (const node of view.nodes) {
    outAdj.set(node.id, []);
    inAdj.set(node.id, []);
  }
  for (const edge of view.edges) {
    outAdj.get(edge.from)?.push(edge.to);
    inAdj.get(edge.to)?.push(edge.from);
  }

  // 레이어 할당 (최장 경로)
  const layerMap = new Map<string, number>();

  function assignLayer(id: string, visited: Set<string>): number {
    const existingLayer = layerMap.get(id);
    if (existingLayer !== undefined) return existingLayer;
    if (visited.has(id)) return 0; // 순환 방지
    visited.add(id);

    const incoming = inAdj.get(id) ?? [];
    const maxParent = incoming.length === 0
      ? -1
      : Math.max(...incoming.map(p => assignLayer(p, visited)));
    const layer = maxParent + 1;
    layerMap.set(id, layer);
    return layer;
  }

  for (const node of view.nodes) {
    assignLayer(node.id, new Set());
  }

  // 레이어별 그룹
  const layers = new Map<number, string[]>();
  for (const [id, layer] of layerMap) {
    const arr = layers.get(layer) ?? [];
    arr.push(id);
    layers.set(layer, arr);
  }

  // 레이어 내 정렬 (barycenter 휴리스틱)
  const sortedLayerKeys = [...layers.keys()].toSorted((a, b) => a - b);
  const positionIndex = new Map<string, number>();

  for (const layerKey of sortedLayerKeys) {
    const ids = layers.get(layerKey);
    if (!ids) continue;

    if (layerKey === 0) {
      // 첫 레이어: 원래 순서 유지
      ids.forEach((id, i) => positionIndex.set(id, i));
    } else {
      // 이전 레이어 이웃의 평균 위치(barycenter)로 정렬
      const barycenters = ids.map(id => {
        const parents = inAdj.get(id) ?? [];
        if (parents.length === 0) return { id, bc: 0 };
        const sum = parents.reduce((s, p) => s + (positionIndex.get(p) ?? 0), 0);
        return { id, bc: sum / parents.length };
      }).toSorted((a, b) => a.bc - b.bc);
      barycenters.forEach(({ id }, i) => positionIndex.set(id, i));
      layers.set(layerKey, barycenters.map(b => b.id));
    }
  }

  // 좌표 할당
  const nodeMap = new Map(view.nodes.map(n => [n.id, n]));

  for (const layerKey of sortedLayerKeys) {
    const ids = layers.get(layerKey);
    if (!ids) continue;
    const totalHeight = ids.length * NODE_GAP;

    for (let i = 0; i < ids.length; i++) {
      const node = nodeMap.get(ids[i]);
      if (!node) continue;
      node.position = {
        x: layerKey * LAYER_GAP,
        y: i * NODE_GAP - totalHeight / 2,
      };
    }
  }

  return { ...view, nodes: [...view.nodes] };
}

// ── 내부 함수 ─────────────────────────────────────────

/** 줌 레벨에 따라 접을 영역의 reason 필터 */
function getTargetReasons(level: FoldLevel): Set<FoldRegion["reason"]> {
  if (level === "group") {
    // L0: 모든 영역을 접어 최대 축소
    return new Set(["scope-cluster", "aspect-cluster", "linear-chain", "strongly-connected"]);
  }
  // L1 (module): 선형 체인 + SCC만 접기 (scope-cluster는 유지)
  return new Set(["linear-chain", "strongly-connected"]);
}

/** 접기 없는 L2 뷰 구축 */
function buildLeafView(graph: PipeGraph): ZoomView {
  return buildView(graph, "leaf", new Map(), graph.pipes.length);
}

/** 공통 뷰 구축 */
function buildView(
  graph: PipeGraph,
  level: FoldLevel,
  foldedContracts: Map<string, FoldedContract>,
  originalPipeCount: number,
): ZoomView {
  // 관심사 맵 (leaf 레벨에서만 전파 포함, 그 외는 개별 추출)
  const concernMap = level === "leaf" ? propagatePipeConcerns(graph) : null;

  // 노드 생성
  const nodes: ZoomNode[] = graph.pipes.map(pipe => {
    const contract = foldedContracts.get(pipe.pipeId);
    const isFolded = contract !== undefined;
    const concerns: readonly PipeConcern[] = isFolded
      ? contract.concerns as PipeConcern[]
      : concernMap
        ? (concernMap.get(pipe.pipeId)?.all ?? [])
        : extractPipeConcerns(pipe);

    return {
      id: pipe.pipeId,
      label: pipe.description ?? pipe.pipeId,
      level,
      position: { x: 0, y: 0 },
      size: computeNodeSize(pipe, contract),
      style: isFolded ? computeContractStyle(contract) : computePipeStyle(pipe),
      role: isFolded ? "transformer" as PipeRole : classifyPipeRole(pipe),
      concerns,
      isFolded,
      contract,
      foldedChildCount: contract?.summary.pipeCount ?? 1,
      ports: isFolded ? [] : resolvePorts(pipe),
      totalPaths: contract?.summary.totalPaths ?? countPipePaths(pipe.flow),
      scope: pipe.scope,
      aspect: pipe.aspect,
    };
  });

  // 엣지 생성
  const pipeIds = new Set(graph.pipes.map(p => p.pipeId));
  const edges: ZoomEdge[] = [];

  for (const conn of graph.connections) {
    const froms = normalizePortRefs(conn.from);
    const tos = normalizePortRefs(conn.to);
    for (const from of froms) {
      for (const to of tos) {
        if (pipeIds.has(from.pipeId) && pipeIds.has(to.pipeId)) {
          edges.push({
            from: from.pipeId,
            to: to.pipeId,
            kind: conn.kind,
            ...(conn.facetType ? { facetType: conn.facetType } : {}),
            ...(from.portId ? { sourcePorts: [from.portId] } : {}),
            ...(to.portId ? { targetPorts: [to.portId] } : {}),
            ...(conn.condition ? { condition: conn.condition } : {}),
          });
        }
      }
    }
  }

  // 관심사 분포 집계
  const concernCounts: Partial<Record<PipeConcern, number>> = {};
  for (const node of nodes) {
    for (const c of node.concerns) {
      concernCounts[c] = (concernCounts[c] ?? 0) + 1;
    }
  }

  const summary: ZoomSummary = {
    nodeCount: nodes.length,
    edgeCount: edges.length,
    totalPaths: countGraphPaths(graph),
    foldedNodeCount: nodes.filter(n => n.isFolded).length,
    originalPipeCount,
    concernCounts,
  };

  return {
    level,
    nodes,
    edges,
    summary,
    entryNodeId: graph.entryPipeId,
  };
}

/** 노드 크기 계산 (경로 수에 비례) */
function computeNodeSize(
  pipe: PipeSpec,
  contract?: FoldedContract,
): { width: number; height: number } {
  const paths = contract?.summary.totalPaths ?? countPipePaths(pipe.flow);
  const scale = 1 + Math.log2(Math.max(paths, 1)) * SIZE_SCALE_FACTOR;
  return {
    width: Math.round(BASE_NODE_WIDTH * scale),
    height: Math.round(BASE_NODE_HEIGHT * scale),
  };
}

/** 개별 파이프의 스타일 계산 */
function computePipeStyle(pipe: PipeSpec): ZoomNodeStyle {
  const steps = collectFlowSteps(pipe.flow);
  let hasFlexible = false;
  let hasStrict = false;

  for (const step of steps) {
    if (!step.dataContract) continue;
    const fields = {
      ...step.dataContract.consumes,
      ...step.dataContract.produces,
    };
    for (const field of Object.values(fields)) {
      if (isFlexibleType(field.type)) {
        hasFlexible = true;
      } else {
        hasStrict = true;
      }
    }
  }

  return resolveStyle(hasStrict, hasFlexible);
}

/** 접힌 계약의 스타일 계산 */
function computeContractStyle(contract: FoldedContract): ZoomNodeStyle {
  let hasFlexible = false;
  let hasStrict = false;

  for (const ref of [...contract.interface.inputs, ...contract.interface.outputs]) {
    if (isFlexibleType(ref.type)) {
      hasFlexible = true;
    } else {
      hasStrict = true;
    }
  }

  return resolveStyle(hasStrict, hasFlexible);
}

/** strict/flexible 상태 → 스타일 결정 */
function resolveStyle(hasStrict: boolean, hasFlexible: boolean): ZoomNodeStyle {
  if (!hasStrict && !hasFlexible) {
    // 데이터 계약 없음 — 판단 불가
    return { certainty: "mixed", shape: "cloud", borderStyle: "dashed" };
  }
  if (hasFlexible && hasStrict) {
    return { certainty: "mixed", shape: "cloud", borderStyle: "dashed" };
  }
  if (hasFlexible) {
    return { certainty: "flexible", shape: "cloud", borderStyle: "dashed" };
  }
  return { certainty: "strict", shape: "polygon", borderStyle: "solid" };
}

/** 타입 문자열이 런타임 결정 타입(flexible)인지 판별 */
function isFlexibleType(typeStr: string): boolean {
  const flexible = ["any", "unknown", "Record<string, any>", "object"];
  return flexible.some(f => typeStr.includes(f)) || /\bT\b/.test(typeStr);
}
