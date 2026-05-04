// @def.boundary qa-sdk-core-system
// @def.doc qa-sdk-core-system

/**
 * PipeGraph Semantic Folding — 서브그래프 접기/펼치기 + 경계 계약 도출
 *
 * 접기(fold) = 연결된 파이프 그룹을 단일 요약 노드로 축소
 * 펼치기(unfold) = 요약 노드를 원래 파이프들로 복원
 */

import type {
  PipeSpec, PipeGraph, PipeConnection, ConnectionKind,
  PipeFlow, PipeStep, StepDataContract,
} from "../types/pipe-spec.js";
import { countGraphPaths } from "./pipe-path.js";
import { getChildFlows } from "./pipe-flow-utils.js";
import { endpointIdentity, isPortRef, normalizeEndpointPipeIds, toEndpointArray } from "./pipe-endpoint.js";
import type { FlowLineageSummary } from "./pipe-lineage.js";
import { summarizeFlowLineage, deriveStaticLineage } from "./pipe-lineage.js";
import type { FieldLineage } from "../types/data-schema.js";

// ── 타입 정의 ─────────────────────────────────────────

/** 3단계 접기 레벨 (L0=group, L1=module, L2=leaf) */
export type FoldLevel = "group" | "module" | "leaf";

/** 접힌 경계에서 노출되는 데이터 참조 */
export interface FoldDataRef {
  /** 필드명 */
  field: string;
  /** 타입 */
  type: string;
  /** 필수 여부 */
  required: boolean;
  /** 원본 pipeId */
  sourcePipeId: string;
}

/** 접힌 서브그래프의 경계 인터페이스 계약 */
export interface FoldedContract {
  /** 접힌 그룹 ID */
  foldId: string;
  /** 접기 레벨 */
  level: FoldLevel;

  /** 경계 인터페이스 */
  interface: {
    /** 그룹이 외부에서 소비하는 입력 */
    inputs: FoldDataRef[];
    /** 그룹이 외부로 생산하는 출력 */
    outputs: FoldDataRef[];
    /** 부수효과: DB 접근 등 */
    sideEffects: Array<{ schemaId: string; columns: string[]; mode: string }>;
  };

  /** 내부 복잡도 요약 */
  summary: {
    /** 접힌 파이프 수 */
    pipeCount: number;
    /** 총 내부 도달 가능 경로 수 */
    totalPaths: number;
    /** 사용된 패싯 종류 */
    facets: string[];
    /** 사용된 흐름 제어 종류 */
    flowKinds: string[];
    /** 부수효과 수 */
    sideEffectCount: number;
  };

  /** 횡단 관심사 (scope/aspect에서 수집) */
  concerns: string[];

  /** 접힌 구간의 계보 요약 (입력→출력 압축) */
  lineageSummary?: FlowLineageSummary;

  /** 접힌 파이프 ID 목록 */
  foldedPipeIds: string[];
}

/** 접기 결과 */
export interface FoldedGraph {
  /** 접힌 후의 PipeGraph */
  graph: PipeGraph;
  /** 접힌 노드 → 원본 서브그래프 매핑 (unfold 복원용) */
  foldMap: Map<string, {
    contract: FoldedContract;
    originalPipes: PipeSpec[];
    originalConnections: PipeConnection[];
    entryPipeIds: string[];
    exitPipeIds: string[];
    /** 원본 pipe별 정적 계보 (unfold 시 복원용) */
    originalLineages: Map<string, FieldLineage[]>;
  }>;
}

/** 자동 감지된 접기 후보 영역 */
export interface FoldRegion {
  /** 영역 ID */
  regionId: string;
  /** 포함된 파이프 ID들 */
  pipeIds: string[];
  /** 감지 근거 */
  reason: "scope-cluster" | "aspect-cluster" | "linear-chain" | "strongly-connected";
  /** 경계 진입 파이프 */
  entryPipeIds: string[];
  /** 경계 출구 파이프 */
  exitPipeIds: string[];
  /** 제안 접기 레벨 */
  suggestedLevel: FoldLevel;
}

// ── 내부 헬퍼 ─────────────────────────────────────────

/** from/to 정규화 (pipe-level 비교용: PortRef → pipeId) */
export function normalize(endpoint: PipeConnection["from"]): string[] {
  return normalizeEndpointPipeIds(endpoint);
}

function rebuildEndpoint(
  source: PipeConnection["from"],
  values: Array<string | { pipeId: string; portId?: string }>,
): PipeConnection["from"] {
  if (Array.isArray(source)) {
    if (source.every(value => isPortRef(value))) {
      return values.map(value => isPortRef(value) ? value : { pipeId: value });
    }
    return values.map(value => isPortRef(value) ? value.pipeId : value);
  }

  const [first] = values;
  if (isPortRef(source)) {
    return isPortRef(first) ? first : { pipeId: first };
  }
  return isPortRef(first) ? first.pipeId : first;
}

function dedupeEndpointValues(values: Array<string | { pipeId: string; portId?: string }>): Array<string | { pipeId: string; portId?: string }> {
  const seen = new Set<string>();
  return values.filter(value => {
    const key = endpointIdentity(value);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** PipeFlow 트리에서 모든 PipeStep 수집 */
export function collectFlowSteps(flow: PipeFlow): PipeStep[] {
  if (flow.kind === "step") return [flow];
  return getChildFlows(flow).flatMap(collectFlowSteps);
}

/** 패싯 유니온 수집 */
function collectFlowFacets(flow: PipeFlow): string[] {
  return [...new Set(collectFlowSteps(flow).map(s => s.facet).filter(Boolean))];
}

/** 흐름 종류 유니온 수집 */
function collectFlowKinds(flow: PipeFlow): string[] {
  const kinds = new Set<string>();
  function walk(f: PipeFlow): void {
    kinds.add(f.kind);
    for (const child of getChildFlows(f)) walk(child);
  }
  walk(flow);
  return [...kinds];
}

/** 경계 파이프 식별 */
function identifyBoundary(
  graph: PipeGraph,
  pipeSet: Set<string>,
): { entry: string[]; exit: string[] } {
  const entrySet = new Set<string>();
  const exitSet = new Set<string>();

  // 내부 파이프 중 내부에서 들어오는 연결이 있는지 추적
  const hasInternalIncoming = new Set<string>();

  for (const conn of graph.connections) {
    const froms = normalize(conn.from);
    const tos = normalize(conn.to);
    const anyFromInside = froms.some(f => pipeSet.has(f));
    const anyFromOutside = froms.some(f => !pipeSet.has(f));
    const anyToInside = tos.some(t => pipeSet.has(t));
    const anyToOutside = tos.some(t => !pipeSet.has(t));

    // 외부→내부: to가 entry
    if (anyFromOutside && anyToInside) {
      for (const t of tos) if (pipeSet.has(t)) entrySet.add(t);
    }
    // 내부→외부: from이 exit
    if (anyFromInside && anyToOutside) {
      for (const f of froms) if (pipeSet.has(f)) exitSet.add(f);
    }
    // 내부→내부: incoming 추적
    if (anyFromInside && anyToInside) {
      for (const t of tos) if (pipeSet.has(t)) hasInternalIncoming.add(t);
    }
  }

  // 그래프 entryPipeId가 접힌 영역 안이면 entry
  if (pipeSet.has(graph.entryPipeId)) entrySet.add(graph.entryPipeId);

  // 외부 연결도 없고 내부 incoming도 없는 파이프 = 진입점
  for (const id of pipeSet) {
    if (!hasInternalIncoming.has(id) && !entrySet.has(id)) {
      entrySet.add(id);
    }
  }

  // exit이 비어있으면: 내부에서 outgoing 연결이 없는 파이프 = 출구
  if (exitSet.size === 0) {
    const hasInternalOutgoing = new Set<string>();
    for (const conn of graph.connections) {
      const froms = normalize(conn.from);
      const tos = normalize(conn.to);
      if (froms.some(f => pipeSet.has(f)) && tos.some(t => pipeSet.has(t))) {
        for (const f of froms) if (pipeSet.has(f)) hasInternalOutgoing.add(f);
      }
    }
    for (const id of pipeSet) {
      if (!hasInternalOutgoing.has(id)) exitSet.add(id);
    }
  }

  return { entry: [...entrySet], exit: [...exitSet] };
}

/** 서브그래프 구축 (내부 연결만) */
function buildSubgraph(graph: PipeGraph, pipeIds: string[], entryPipeId: string): PipeGraph {
  const pipeSet = new Set(pipeIds);
  const pipes = graph.pipes.filter(p => pipeSet.has(p.pipeId));
  const connections = graph.connections.filter(c => {
    const froms = normalize(c.from);
    const tos = normalize(c.to);
    return froms.every(f => pipeSet.has(f)) && tos.every(t => pipeSet.has(t));
  });

  return {
    graphId: graph.graphId + "__sub",
    version: graph.version,
    description: undefined,
    pipes,
    connections,
    entryPipeId,
  };
}

/** 연결의 endpoint를 교체 */
function rewireEndpoint(
  endpoint: PipeConnection["from"],
  pipeSet: Set<string>,
  replacementId: string,
): PipeConnection["from"] {
  const rewired = toEndpointArray(endpoint).map(value => {
    const pipeId = isPortRef(value) ? value.pipeId : value;
    return pipeSet.has(pipeId) ? replacementId : value;
  });
  return rebuildEndpoint(endpoint, dedupeEndpointValues(rewired));
}

// ── 핵심 함수 ─────────────────────────────────────────

/**
 * 서브그래프의 경계 인터페이스 계약을 도출한다.
 */
export function computeFoldedContract(
  graph: PipeGraph,
  pipeIds: string[],
  level: FoldLevel = "module",
): FoldedContract {
  if (pipeIds.length === 0) {
    throw new Error("접기 대상 pipeIds가 비어있음");
  }

  const pipeSet = new Set(pipeIds);
  const pipeMap = new Map(graph.pipes.map(p => [p.pipeId, p]));

  // 유효성 검증
  for (const id of pipeIds) {
    if (!pipeMap.has(id)) {
      throw new Error(`파이프 '${id}'가 그래프에 존재하지 않음`);
    }
  }

  const { entry, exit } = identifyBoundary(graph, pipeSet);
  const foldId = "fold_" + pipeIds.slice().toSorted().join("_");

  // inputs 수집: entryPipe의 trigger + consumes
  const inputs: FoldDataRef[] = [];
  for (const entryId of entry) {
    const pipe = pipeMap.get(entryId)!;
    // trigger eventKey를 입력으로 기록
    inputs.push({
      field: pipe.trigger.eventKey,
      type: "event",
      required: true,
      sourcePipeId: entryId,
    });
    // dataContract.consumes 수집
    for (const step of collectFlowSteps(pipe.flow)) {
      if (step.dataContract?.consumes) {
        for (const [field, spec] of Object.entries(step.dataContract.consumes)) {
          inputs.push({
            field,
            type: spec.type,
            required: spec.required,
            sourcePipeId: entryId,
          });
        }
      }
    }
  }

  // outputs 수집: exitPipe의 produces + produces 필드
  const outputs: FoldDataRef[] = [];
  for (const exitId of exit) {
    const pipe = pipeMap.get(exitId)!;
    // produces 이벤트
    if (pipe.produces) {
      for (const eventKey of pipe.produces) {
        outputs.push({
          field: eventKey,
          type: "event",
          required: true,
          sourcePipeId: exitId,
        });
      }
    }
    // dataContract.produces 수집
    for (const step of collectFlowSteps(pipe.flow)) {
      if (step.dataContract?.produces) {
        for (const [field, spec] of Object.entries(step.dataContract.produces)) {
          outputs.push({
            field,
            type: spec.type,
            required: spec.required,
            sourcePipeId: exitId,
          });
        }
      }
    }
  }

  // sideEffects 수집
  const sideEffectMap = new Map<string, { schemaId: string; columns: Set<string>; mode: string }>();
  for (const id of pipeIds) {
    const pipe = pipeMap.get(id)!;
    for (const step of collectFlowSteps(pipe.flow)) {
      if (step.dataContract?.accesses) {
        for (const access of step.dataContract.accesses) {
          const key = `${access.schemaId}:${access.mode}`;
          const existing = sideEffectMap.get(key);
          if (existing) {
            for (const col of access.columns) existing.columns.add(col);
          } else {
            sideEffectMap.set(key, {
              schemaId: access.schemaId,
              columns: new Set(access.columns),
              mode: access.mode,
            });
          }
        }
      }
    }
  }
  const sideEffects = [...sideEffectMap.values()].map(s => ({
    schemaId: s.schemaId,
    columns: [...s.columns],
    mode: s.mode,
  }));

  // summary 계산
  const allFacets = new Set<string>();
  const allFlowKinds = new Set<string>();
  for (const id of pipeIds) {
    const pipe = pipeMap.get(id)!;
    for (const f of collectFlowFacets(pipe.flow)) allFacets.add(f);
    for (const k of collectFlowKinds(pipe.flow)) allFlowKinds.add(k);
  }

  const subgraph = buildSubgraph(graph, pipeIds, entry[0] ?? pipeIds[0]);
  const totalPaths = countGraphPaths(subgraph);

  // concerns 수집 (scope/aspect에서)
  const concerns = new Set<string>();
  for (const id of pipeIds) {
    const pipe = pipeMap.get(id)!;
    if (pipe.scope) concerns.add(pipe.scope);
    if (pipe.aspect) concerns.add(pipe.aspect);
  }

  return {
    foldId,
    level,
    interface: { inputs, outputs, sideEffects },
    summary: {
      pipeCount: pipeIds.length,
      totalPaths,
      facets: [...allFacets],
      flowKinds: [...allFlowKinds],
      sideEffectCount: sideEffects.length,
    },
    concerns: [...concerns],
    // 접힌 구간의 계보 요약 — 각 pipe flow에서 계보를 파생하고 합산
    lineageSummary: computeFoldLineageSummary(pipeIds, pipeMap),
    foldedPipeIds: [...pipeIds],
  };
}

function computeFoldLineageSummary(
  pipeIds: string[],
  pipeMap: Map<string, PipeSpec>,
): FlowLineageSummary {
  const allInputs = new Set<string>();
  const allOutputs = new Set<string>();
  const outputLineage: Record<string, string[]> = {};

  for (const id of pipeIds) {
    const pipe = pipeMap.get(id);
    if (!pipe) continue;
    const summary = summarizeFlowLineage(pipe.flow, id);
    for (const i of summary.inputs) allInputs.add(i);
    for (const o of summary.outputs) allOutputs.add(o);
    for (const [k, v] of Object.entries(summary.outputLineage)) {
      outputLineage[k] = [...new Set([...(outputLineage[k] ?? []), ...v])];
    }
  }

  return {
    inputs: [...allInputs],
    outputs: [...allOutputs],
    outputLineage,
  };
}

/**
 * 파이프들을 접어서 단일 노드로 대체한 새 그래프를 반환한다.
 */
export function foldSubgraph(
  graph: PipeGraph,
  pipeIds: string[],
  foldId?: string,
  level?: FoldLevel,
): FoldedGraph {
  const contract = computeFoldedContract(graph, pipeIds, level);
  const pipeSet = new Set(pipeIds);
  const pipeMap = new Map(graph.pipes.map(p => [p.pipeId, p]));
  const resolvedFoldId = foldId ?? contract.foldId;
  contract.foldId = resolvedFoldId;

  const { entry, exit } = identifyBoundary(graph, pipeSet);

  // 연결 분류
  const internalConnections: PipeConnection[] = [];
  const rewiredConnections: PipeConnection[] = [];

  for (const conn of graph.connections) {
    const froms = normalize(conn.from);
    const tos = normalize(conn.to);
    const allFromInside = froms.every(f => pipeSet.has(f));
    const allToInside = tos.every(t => pipeSet.has(t));
    const anyFromInside = froms.some(f => pipeSet.has(f));
    const anyToInside = tos.some(t => pipeSet.has(t));

    if (allFromInside && allToInside) {
      // 내부 연결 → 보관
      internalConnections.push(conn);
    } else if (anyFromInside || anyToInside) {
      // 경계 연결 → 재배선
      rewiredConnections.push({
        from: rewireEndpoint(conn.from, pipeSet, resolvedFoldId),
        to: rewireEndpoint(conn.to, pipeSet, resolvedFoldId),
        kind: conn.kind,
        ...(conn.facetType ? { facetType: conn.facetType } : {}),
        ...(conn.condition ? { condition: conn.condition } : {}),
      });
    } else {
      // 외부 연결 → 그대로 유지
      rewiredConnections.push(conn);
    }
  }

  // 재배선 중복 제거 (같은 from+to+kind)
  const connKey = (c: PipeConnection) =>
    `${JSON.stringify(toEndpointArray(c.from).map(endpointIdentity).toSorted())}→${JSON.stringify(toEndpointArray(c.to).map(endpointIdentity).toSorted())}:${c.kind}`;
  const seen = new Set<string>();
  const dedupedConnections = rewiredConnections.filter(c => {
    const key = connKey(c);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // 접힌 PipeSpec 생성
  const firstEntry = pipeMap.get(entry[0] ?? pipeIds[0])!;
  const allProduces = new Set<string>();
  for (const exitId of exit) {
    const pipe = pipeMap.get(exitId)!;
    if (pipe.produces) {
      for (const p of pipe.produces) allProduces.add(p);
    }
  }

  // 대표 scope/aspect (다수결)
  const scopeVotes = new Map<string, number>();
  const aspectVotes = new Map<string, number>();
  for (const id of pipeIds) {
    const pipe = pipeMap.get(id)!;
    if (pipe.scope) scopeVotes.set(pipe.scope, (scopeVotes.get(pipe.scope) ?? 0) + 1);
    if (pipe.aspect) aspectVotes.set(pipe.aspect, (aspectVotes.get(pipe.aspect) ?? 0) + 1);
  }
  const topScope = [...scopeVotes.entries()].toSorted((a, b) => b[1] - a[1])[0]?.[0];
  const topAspect = [...aspectVotes.entries()].toSorted((a, b) => b[1] - a[1])[0]?.[0];

  const foldedPipe: PipeSpec = {
    pipeId: resolvedFoldId,
    version: graph.version,
    description: `접힌 노드: ${pipeIds.join(", ")}`,
    trigger: { ...firstEntry.trigger },
    flow: { kind: "step", facet: "접힌" },
    produces: allProduces.size > 0 ? [...allProduces] : undefined,
    scope: topScope,
    aspect: topAspect,
  };

  // 새 그래프 구성
  const newPipes = [
    ...graph.pipes.filter(p => !pipeSet.has(p.pipeId)),
    foldedPipe,
  ];

  const newGraph: PipeGraph = {
    graphId: graph.graphId,
    version: graph.version,
    description: graph.description,
    pipes: newPipes,
    connections: dedupedConnections,
    entryPipeId: pipeSet.has(graph.entryPipeId) ? resolvedFoldId : graph.entryPipeId,
  };

  // 원본 pipe별 정적 계보 저장
  const originalLineages = new Map<string, FieldLineage[]>();
  for (const id of pipeIds) {
    const pipe = pipeMap.get(id)!;
    originalLineages.set(id, deriveStaticLineage(pipe.flow, id));
  }

  const foldMap = new Map<string, {
    contract: FoldedContract;
    originalPipes: PipeSpec[];
    originalConnections: PipeConnection[];
    entryPipeIds: string[];
    exitPipeIds: string[];
    originalLineages: Map<string, FieldLineage[]>;
  }>();

  foldMap.set(resolvedFoldId, {
    contract,
    originalPipes: graph.pipes.filter(p => pipeSet.has(p.pipeId)),
    originalConnections: internalConnections,
    entryPipeIds: entry,
    exitPipeIds: exit,
    originalLineages,
  });

  return { graph: newGraph, foldMap };
}

/**
 * 접힌 노드를 원래 파이프들로 복원한다.
 */
export function unfoldNode(
  foldedGraph: FoldedGraph,
  foldedNodeId: string,
): PipeGraph {
  const foldEntry = foldedGraph.foldMap.get(foldedNodeId);
  if (!foldEntry) {
    throw new Error(`접힌 노드 '${foldedNodeId}'를 찾을 수 없음`);
  }

  const { originalPipes, originalConnections, entryPipeIds, exitPipeIds } = foldEntry;
  const graph = foldedGraph.graph;

  // 접힌 노드 제거, 원본 파이프 복원
  const newPipes = [
    ...graph.pipes.filter(p => p.pipeId !== foldedNodeId),
    ...originalPipes,
  ];

  // 연결 재배선: foldedNodeId → 원래 entry/exit 파이프
  const newConnections: PipeConnection[] = [];

  for (const conn of graph.connections) {
    const froms = normalize(conn.from);
    const tos = normalize(conn.to);
    const fromHasFold = froms.includes(foldedNodeId);
    const toHasFold = tos.includes(foldedNodeId);

    if (fromHasFold && toHasFold) {
      // 자기 참조 (접힌 노드 → 접힌 노드) — 내부 연결로 대체됨
      continue;
    } else if (toHasFold) {
      // 외부→접힌노드 → 외부→entry 파이프들
      for (const entryId of entryPipeIds) {
        newConnections.push({
          from: conn.from,
          to: replaceInEndpoint(conn.to, foldedNodeId, entryId),
          kind: conn.kind,
          ...(conn.facetType ? { facetType: conn.facetType } : {}),
          ...(conn.condition ? { condition: conn.condition } : {}),
        });
      }
    } else if (fromHasFold) {
      // 접힌노드→외부 → exit 파이프들→외부
      for (const exitId of exitPipeIds) {
        newConnections.push({
          from: replaceInEndpoint(conn.from, foldedNodeId, exitId),
          to: conn.to,
          kind: conn.kind,
          ...(conn.facetType ? { facetType: conn.facetType } : {}),
          ...(conn.condition ? { condition: conn.condition } : {}),
        });
      }
    } else {
      newConnections.push(conn);
    }
  }

  // 내부 연결 복원
  newConnections.push(...originalConnections);

  // entryPipeId 복원
  const entryPipeId = graph.entryPipeId === foldedNodeId
    ? entryPipeIds[0]
    : graph.entryPipeId;

  return {
    graphId: graph.graphId,
    version: graph.version,
    description: graph.description,
    pipes: newPipes,
    connections: newConnections,
    entryPipeId,
  };
}

/**
 * 접힌 노드에서 원본 pipe별 계보를 복원한다.
 * unfold 후 각 pipe의 정적 계보가 필요할 때 사용.
 */
export function restoreLineageFromFold(
  foldedGraph: FoldedGraph,
  foldedNodeId: string,
): Map<string, FieldLineage[]> {
  const foldEntry = foldedGraph.foldMap.get(foldedNodeId);
  if (!foldEntry) {
    throw new Error(`접힌 노드 '${foldedNodeId}'를 찾을 수 없음`);
  }
  return foldEntry.originalLineages;
}

/** fold 체크포인트 검증 결과 */
export interface FoldCheckpointResult {
  /** 검증 통과 여부 */
  valid: boolean;
  /** 입력 필드 (entry pipe의 consumes) */
  inputFields: string[];
  /** 출력 필드 (exit pipe의 produces) */
  outputFields: string[];
  /** 입력→출력 연결이 끊긴 필드 (입력이 출력에 기여하지 않음) */
  disconnectedInputs: string[];
  /** 출처 불명 출력 (어떤 입력에서도 기여받지 못한 출력) */
  orphanOutputs: string[];
}

/**
 * fold 경계 = 체크포인트: 입력 형태 → 출력 형태 검증.
 *
 * FoldedContract의 lineageSummary를 사용하여:
 * 1. 모든 입력이 최소 하나의 출력에 기여하는지 확인
 * 2. 모든 출력이 최소 하나의 입력에서 기여받는지 확인
 */
export function validateFoldCheckpoint(contract: FoldedContract): FoldCheckpointResult {
  const summary = contract.lineageSummary;
  if (!summary) {
    return {
      valid: true,
      inputFields: [],
      outputFields: [],
      disconnectedInputs: [],
      orphanOutputs: [],
    };
  }

  const { inputs, outputs, outputLineage } = summary;

  // 출력에 기여하는 입력 집합
  const contributingInputs = new Set<string>();
  for (const sources of Object.values(outputLineage)) {
    for (const src of sources) contributingInputs.add(src);
  }

  // 입력 중 어떤 출력에도 기여하지 않는 것
  const disconnectedInputs = inputs.filter(i => !contributingInputs.has(i));

  // 출력 중 기여 입력이 없는 것
  const orphanOutputs = outputs.filter(o =>
    !outputLineage[o] || outputLineage[o].length === 0,
  );

  return {
    valid: disconnectedInputs.length === 0 && orphanOutputs.length === 0,
    inputFields: inputs,
    outputFields: outputs,
    disconnectedInputs,
    orphanOutputs,
  };
}

/** endpoint 내 특정 ID를 교체 */
function replaceInEndpoint(
  endpoint: PipeConnection["from"],
  oldId: string,
  newId: string,
): PipeConnection["from"] {
  const replaced = toEndpointArray(endpoint).map(value => {
    if (isPortRef(value)) {
      return value.pipeId === oldId ? { ...value, pipeId: newId } : value;
    }
    return value === oldId ? newId : value;
  });
  return rebuildEndpoint(endpoint, replaced);
}

/**
 * 자동으로 접기 후보 영역을 탐지한다.
 */
export function detectFoldRegions(graph: PipeGraph): FoldRegion[] {
  const regions: FoldRegion[] = [];

  // 인접 리스트 구축
  const outAdj = new Map<string, Set<string>>();
  const inAdj = new Map<string, Set<string>>();
  const connKindMap = new Map<string, ConnectionKind>();

  for (const pipe of graph.pipes) {
    outAdj.set(pipe.pipeId, new Set());
    inAdj.set(pipe.pipeId, new Set());
  }

  for (const conn of graph.connections) {
    const froms = normalize(conn.from);
    const tos = normalize(conn.to);
    for (const f of froms) {
      for (const t of tos) {
        outAdj.get(f)?.add(t);
        inAdj.get(t)?.add(f);
        connKindMap.set(`${f}→${t}`, conn.kind);
      }
    }
  }

  // 전략 A: Scope 클러스터
  const scopeGroups = new Map<string, string[]>();
  for (const pipe of graph.pipes) {
    if (pipe.scope) {
      const group = scopeGroups.get(pipe.scope) ?? [];
      group.push(pipe.pipeId);
      scopeGroups.set(pipe.scope, group);
    }
  }

  for (const [scope, pipeIds] of scopeGroups) {
    if (pipeIds.length < 2) continue;
    // 연결된 서브그래프인지 확인 (BFS)
    const pipeSet = new Set(pipeIds);
    const connected = bfsConnected(pipeIds[0], pipeSet, outAdj, inAdj);
    if (connected.size === pipeSet.size) {
      const { entry, exit } = identifyBoundary(graph, pipeSet);
      regions.push({
        regionId: `scope_${scope}`,
        pipeIds,
        reason: "scope-cluster",
        entryPipeIds: entry,
        exitPipeIds: exit,
        suggestedLevel: "module",
      });
    }
  }

  // 전략 B: 선형 체인 (연속 "next" 연결 ≥ 3)
  const visited = new Set<string>();
  for (const pipe of graph.pipes) {
    if (visited.has(pipe.pipeId)) continue;

    const chain = [pipe.pipeId];
    visited.add(pipe.pipeId);

    // 앞으로 탐색
    let current = pipe.pipeId;
    while (true) {
      const outs = outAdj.get(current);
      if (!outs || outs.size !== 1) break;
      const next = [...outs][0];
      if (visited.has(next)) break;
      if (connKindMap.get(`${current}→${next}`) !== "next") break;
      // next의 incoming이 1개인지 확인
      const ins = inAdj.get(next);
      if (!ins || ins.size !== 1) break;
      chain.push(next);
      visited.add(next);
      current = next;
    }

    if (chain.length >= 3) {
      const pipeSet = new Set(chain);
      const { entry, exit } = identifyBoundary(graph, pipeSet);
      regions.push({
        regionId: `chain_${chain[0]}`,
        pipeIds: chain,
        reason: "linear-chain",
        entryPipeIds: entry,
        exitPipeIds: exit,
        suggestedLevel: "module",
      });
    }
  }

  // 전략 C: 강결합 컴포넌트 (Tarjan's SCC)
  const sccs = tarjanSCC(graph.pipes.map(p => p.pipeId), outAdj);
  for (const scc of sccs) {
    if (scc.length < 2) continue;
    const pipeSet = new Set(scc);
    const { entry, exit } = identifyBoundary(graph, pipeSet);
    regions.push({
      regionId: `scc_${scc[0]}`,
      pipeIds: scc,
      reason: "strongly-connected",
      entryPipeIds: entry,
      exitPipeIds: exit,
      suggestedLevel: "group",
    });
  }

  // 크기 내림차순 정렬
  regions.sort((a, b) => b.pipeIds.length - a.pipeIds.length);
  return regions;
}

// ── 그래프 알고리즘 헬퍼 ──────────────────────────────

/** BFS로 연결된 노드 집합 반환 (양방향) */
function bfsConnected(
  start: string,
  pipeSet: Set<string>,
  outAdj: Map<string, Set<string>>,
  inAdj: Map<string, Set<string>>,
): Set<string> {
  const visited = new Set<string>();
  const queue = [start];
  visited.add(start);

  while (queue.length > 0) {
    const current = queue.shift()!;
    // 양방향 탐색 (무방향 연결성)
    for (const adj of [outAdj.get(current), inAdj.get(current)]) {
      if (!adj) continue;
      for (const neighbor of adj) {
        if (pipeSet.has(neighbor) && !visited.has(neighbor)) {
          visited.add(neighbor);
          queue.push(neighbor);
        }
      }
    }
  }

  return visited;
}

/** Tarjan's SCC 알고리즘 */
function tarjanSCC(
  nodes: string[],
  outAdj: Map<string, Set<string>>,
): string[][] {
  let index = 0;
  const indices = new Map<string, number>();
  const lowlinks = new Map<string, number>();
  const onStack = new Set<string>();
  const stack: string[] = [];
  const sccs: string[][] = [];

  function strongConnect(v: string): void {
    indices.set(v, index);
    lowlinks.set(v, index);
    index++;
    stack.push(v);
    onStack.add(v);

    const neighbors = outAdj.get(v) ?? new Set();
    for (const w of neighbors) {
      if (!indices.has(w)) {
        strongConnect(w);
        lowlinks.set(v, Math.min(lowlinks.get(v)!, lowlinks.get(w)!));
      } else if (onStack.has(w)) {
        lowlinks.set(v, Math.min(lowlinks.get(v)!, indices.get(w)!));
      }
    }

    if (lowlinks.get(v) === indices.get(v)) {
      const scc: string[] = [];
      let w: string;
      do {
        w = stack.pop()!;
        onStack.delete(w);
        scc.push(w);
      } while (w !== v);
      sccs.push(scc);
    }
  }

  for (const node of nodes) {
    if (!indices.has(node)) strongConnect(node);
  }

  return sccs;
}
