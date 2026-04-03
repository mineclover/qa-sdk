/**
 * 정적 계보 추적 — 시뮬레이션 없이 PipeFlow 구조에서 데이터 계보 파생.
 *
 * 핵심: "어떤 데이터가 어떤 데이터를 만드는 데 필요했는가"만 추적.
 * 원본 값은 다루지 않음 — 계보 그래프만.
 */

import type { PipeFlow, PipeStep, PipeSpec, PipeGraph, StepDataContract } from "../types/pipe-spec.js";
import { normalizeEndpointPipeIds, normalizePortRefs } from "./pipe-endpoint.js";
import type { FieldLineage, FieldRef, TransformKind } from "../types/data-schema.js";
import type { LineageChainValidation } from "../data-object/types.js";
import { BindingRegistry } from "../data-object/registry.js";
import { validateLineageChain } from "../data-object/validate.js";
import { getChildFlows } from "./pipe-flow-utils.js";
import { resolveStepSchemaId } from "./pipe-schema-id.js";

// ── 계보 경고 ───────────────────────────────────────

/** 정적 계보 파생 중 감지된 경고 */
export interface LineageWarning {
  /** 경고 위치 (flow path) */
  path: string;
  /** 경고 메시지 */
  message: string;
}

/** 정적 계보 + 경고 결과 */
export interface StaticLineageResult {
  lineages: FieldLineage[];
  warnings: LineageWarning[];
}

// ── 정적 계보 파생 ──────────────────────────────────

/**
 * PipeFlow 트리에서 시뮬레이션 없이 계보를 파생한다.
 *
 * 각 step의 dataContract.lineageHints → FieldLineage 생성.
 * hints 없으면 consumes/produces 이름 매칭 추론 (direct).
 */
export function deriveStaticLineage(flow: PipeFlow, pipeId = "pipe"): FieldLineage[] {
  const lineages: FieldLineage[] = [];
  walkLineage(flow, pipeId, "flow", lineages);
  return lineages;
}

/**
 * 정적 계보를 파생하고 경고도 함께 반환한다.
 * reduce step에 accumulator 패턴이 없으면 "계보 불완전" 경고 발행.
 */
export function deriveStaticLineageWithDiagnostics(flow: PipeFlow, pipeId = "pipe"): StaticLineageResult {
  const lineages: FieldLineage[] = [];
  const warnings: LineageWarning[] = [];
  walkLineage(flow, pipeId, "flow", lineages, warnings);
  return { lineages, warnings };
}

function walkLineage(
  flow: PipeFlow,
  pipeId: string,
  path: string,
  lineages: FieldLineage[],
  warnings?: LineageWarning[],
): void {
  if (flow.kind === "step") {
    extractStepLineage(flow, pipeId, path, lineages);
    return;
  }

  // sequence: step 간 체인 추적
  if (flow.kind === "sequence") {
    // 각 step 개별 계보
    for (let i = 0; i < flow.steps.length; i++) {
      walkLineage(flow.steps[i], pipeId, `${path}.steps[${i}]`, lineages, warnings);
    }
    // step[i].produces → step[i+1].consumes 체인
    chainSequenceLineage(flow.steps, pipeId, path, lineages);
    return;
  }

  // reduce: accumulator → step 본체의 계보를 집계 관점으로 연결
  if (flow.kind === "reduce") {
    walkLineage(flow.step, pipeId, `${path}.step`, lineages, warnings);
    // reduce의 step이 produces하는 필드는 accumulator를 통해 집계됨
    const stepProduces = getFlowProduces(flow.step, pipeId);
    const stepConsumes = getFlowConsumes(flow.step, pipeId);
    let accumulatorFound = false;
    if (stepProduces && stepConsumes) {
      for (const [field, prodRef] of stepProduces) {
        const consumeRef = stepConsumes.get(field);
        if (consumeRef) {
          accumulatorFound = true;
          // step 내부에서 같은 필드를 consume→produce = accumulator 패턴
          lineages.push({
            target: { schemaId: prodRef.schemaId, column: field },
            sources: [{ schemaId: consumeRef.schemaId, column: field }],
            transform: "aggregate",
            pipeId,
            stepPath: `${path}.accumulate`,
          });
        }
      }
    }
    // accumulator 패턴이 없으면 계보 불완전 경고
    if (!accumulatorFound && warnings) {
      warnings.push({
        path: `${path}.reduce`,
        message: `reduce step에 accumulator 패턴 없음 — consumes/produces에 동일 필드가 없어 계보가 불완전합니다`,
      });
    }
    return;
  }

  // 나머지: 자식 재귀
  const children = getChildFlows(flow);
  for (let i = 0; i < children.length; i++) {
    walkLineage(children[i], pipeId, `${path}.child[${i}]`, lineages, warnings);
  }
}

/** step 하나의 내부 계보 (consumes → produces) */
function extractStepLineage(
  step: PipeStep,
  pipeId: string,
  path: string,
  lineages: FieldLineage[],
): void {
  const dc = step.dataContract;
  if (!dc?.produces) return;

  const stepSchemaId = resolveStepSchemaId(step, pipeId);

  for (const [outputField, _outputDef] of Object.entries(dc.produces)) {
    const hint = dc.lineageHints?.[outputField];

    if (hint) {
      // 명시적 힌트 사용
      lineages.push({
        target: { schemaId: stepSchemaId, column: outputField },
        sources: hint.sources.map(s => ({ schemaId: stepSchemaId, column: s })),
        transform: hint.transform,
        pipeId,
        stepPath: path,
        facet: step.facet || undefined,
      });
    }
    // hints 없는 이름 매칭 pass-through는 chain lineage에서 처리 (step-internal에서 생성하면 self-reference BFS 문제)
    // produces에 있지만 consumes에도 hints에도 없음 → 새로 생성된 필드 (계보 없음)
  }
}

/** sequence 내 step[i].produces → step[i+1].consumes 체�� 계보 — 비-step 래퍼도 재귀 처리 */
function chainSequenceLineage(
  steps: PipeFlow[],
  pipeId: string,
  path: string,
  lineages: FieldLineage[],
): void {
  for (let i = 0; i < steps.length - 1; i++) {
    const prevProduces = getFlowProduces(steps[i], pipeId);
    const nextConsumes = getFlowConsumes(steps[i + 1], pipeId);

    if (!prevProduces || !nextConsumes) continue;

    for (const [field, nextRef] of nextConsumes) {
      const prevRef = prevProduces.get(field);
      if (prevRef) {
        lineages.push({
          target: { schemaId: nextRef.schemaId, column: field },
          sources: [{ schemaId: prevRef.schemaId, column: field }],
          transform: "direct",
          pipeId,
          stepPath: `${path}.chain[${i}→${i + 1}]`,
        });
      }
    }
  }
}

// ── Flow 레벨 계보 요약 ─────────────────────────────

/** flow의 마지막 produces 필드 + schemaId (비-step 래퍼 재귀) */
function getFlowProduces(flow: PipeFlow, pipeId: string): Map<string, { schemaId: string }> | null {
  if (flow.kind === "step" && flow.dataContract?.produces) {
    const sid = resolveStepSchemaId(flow, pipeId);
    return new Map(Object.keys(flow.dataContract.produces).map(f => [f, { schemaId: sid }]));
  }
  if (flow.kind === "sequence" && flow.steps.length > 0) {
    return getFlowProduces(flow.steps[flow.steps.length - 1], pipeId);
  }
  // branch/parallel 등: 자식들의 produces 합집합
  const children = getChildFlows(flow);
  if (children.length === 0) return null;
  const merged = new Map<string, { schemaId: string }>();
  for (const child of children) {
    const cp = getFlowProduces(child, pipeId);
    if (cp) for (const [f, ref] of cp) merged.set(f, ref);
  }
  return merged.size > 0 ? merged : null;
}

/** flow의 첫 consumes 필드 + schemaId (비-step 래퍼 재귀) */
function getFlowConsumes(flow: PipeFlow, pipeId: string): Map<string, { schemaId: string }> | null {
  if (flow.kind === "step" && flow.dataContract?.consumes) {
    const sid = resolveStepSchemaId(flow, pipeId);
    return new Map(Object.keys(flow.dataContract.consumes).map(f => [f, { schemaId: sid }]));
  }
  if (flow.kind === "sequence" && flow.steps.length > 0) {
    return getFlowConsumes(flow.steps[0], pipeId);
  }
  // branch/parallel 등: 자식들의 consumes 합집합
  const children = getChildFlows(flow);
  if (children.length === 0) return null;
  const merged = new Map<string, { schemaId: string }>();
  for (const child of children) {
    const cc = getFlowConsumes(child, pipeId);
    if (cc) for (const [f, ref] of cc) merged.set(f, ref);
  }
  return merged.size > 0 ? merged : null;
}

/** flow 전체의 입출력 계보 요약 */
export interface FlowLineageSummary {
  /** flow 전체 입력 필드 (외부에서 들어오는 것) */
  inputs: string[];
  /** flow 전체 출력 필드 (외부로 나가는 것) */
  outputs: string[];
  /** 출력 필드별 → 최종 기여 입력 필드 (압축된 계보) */
  outputLineage: Record<string, string[]>;
}

/**
 * PipeFlow 전체의 입출력 계보를 요약한다.
 *
 * sequence: 첫 step consumes = 입력, 마지막 step produces = 출력
 * 내부 체인을 역추적하여 "출력 c는 최종적으로 입력 a에서 왔다"를 압축.
 */
export function summarizeFlowLineage(flow: PipeFlow, pipeId = "pipe"): FlowLineageSummary {
  const lineages = deriveStaticLineage(flow, pipeId);

  // 전체 입력 수집: consumes에 있지만 어떤 produces에도 없는 필드
  const allConsumed = new Set<string>();
  const allProduced = new Set<string>();

  collectAllFields(flow, allConsumed, allProduced);

  const inputs = [...allConsumed].filter(f => !allProduced.has(f));
  const lastProduces = getLastProduces(flow);
  const outputs = [...allProduced].filter(f => lastProduces.has(f));

  // 출력별 기여 입력 역추적 — schemaId 포함 복합키 BFS
  const outputLineage: Record<string, string[]> = {};
  const lastStepSchemas = getLastProducesWithSchema(flow, pipeId);
  for (const output of outputs) {
    const startSchemaId = lastStepSchemas.get(output) ?? pipeId;
    const origins = traceOriginsStatic({ schemaId: startSchemaId, column: output }, lineages, inputs);
    outputLineage[output] = origins;
  }

  return { inputs, outputs, outputLineage };
}

/** 계보 체인을 역추적하여 최초 입력까지 도달 — schemaId 복합키 사용 */
function traceOriginsStatic(
  start: FieldRef,
  lineages: FieldLineage[],
  terminalInputs: string[],
): string[] {
  const terminalSet = new Set(terminalInputs);
  const result = new Set<string>();
  const queue: FieldRef[] = [start];
  const visited = new Set<string>();

  while (queue.length > 0) {
    const current = queue.shift()!;
    const key = `${current.schemaId}:${current.column}`;
    if (visited.has(key)) continue;
    visited.add(key);

    if (terminalSet.has(current.column)) {
      result.add(current.column);
      continue;
    }

    // schemaId + column 복합키로 매칭
    const matching = lineages.filter(
      l => l.target.schemaId === current.schemaId && l.target.column === current.column,
    );
    for (const m of matching) {
      for (const src of m.sources) {
        queue.push(src);
      }
    }
  }

  return [...result];
}

/** flow에서 모든 consumes/produces 필드 수집 */
function collectAllFields(flow: PipeFlow, consumed: Set<string>, produced: Set<string>): void {
  if (flow.kind === "step" && flow.dataContract) {
    if (flow.dataContract.consumes) {
      for (const f of Object.keys(flow.dataContract.consumes)) consumed.add(f);
    }
    if (flow.dataContract.produces) {
      for (const f of Object.keys(flow.dataContract.produces)) produced.add(f);
    }
    return;
  }
  for (const child of getChildFlows(flow)) {
    collectAllFields(child, consumed, produced);
  }
}

/** flow의 마지막 produces 필드 — sequence면 마지막 step, 아니면 전체 */
function getLastProduces(flow: PipeFlow): Set<string> {
  if (flow.kind === "sequence" && flow.steps.length > 0) {
    return getLastProduces(flow.steps[flow.steps.length - 1]);
  }
  if (flow.kind === "step" && flow.dataContract?.produces) {
    return new Set(Object.keys(flow.dataContract.produces));
  }
  const result = new Set<string>();
  for (const child of getChildFlows(flow)) {
    for (const f of getLastProduces(child)) result.add(f);
  }
  return result;
}

/** flow의 마지막 produces 필드 + schemaId 매핑 */
function getLastProducesWithSchema(flow: PipeFlow, pipeId: string): Map<string, string> {
  if (flow.kind === "sequence" && flow.steps.length > 0) {
    return getLastProducesWithSchema(flow.steps[flow.steps.length - 1], pipeId);
  }
  if (flow.kind === "step" && flow.dataContract?.produces) {
    const sid = resolveStepSchemaId(flow, pipeId);
    const map = new Map<string, string>();
    for (const f of Object.keys(flow.dataContract.produces)) map.set(f, sid);
    return map;
  }
  const map = new Map<string, string>();
  for (const child of getChildFlows(flow)) {
    for (const [f, sid] of getLastProducesWithSchema(child, pipeId)) map.set(f, sid);
  }
  return map;
}

// ── data-object 검증 브릿지 ─────────────────────────

export interface StaticLineageValidation {
  lineages: readonly FieldLineage[];
  summary: FlowLineageSummary;
  chain: LineageChainValidation;
}

/**
 * 정적 계보를 파생하고 data-object binding registry로 검증한다.
 * 시뮬레이션 없이 PipeSpec만으로 계보 추출 + 바인딩 정합성 체크.
 */
export function validateStaticLineage(
  pipe: PipeSpec,
  registry: BindingRegistry,
): StaticLineageValidation {
  const lineages = deriveStaticLineage(pipe.flow, pipe.pipeId);
  const summary = summarizeFlowLineage(pipe.flow, pipe.pipeId);
  const chain = validateLineageChain(lineages, registry);

  return { lineages, summary, chain };
}

// ── 단일 필드 계보 역추적 ───────────────────────────

/**
 * "이 필드가 어디서 왔는가?" — 단일 필드의 최종 입력까지 역추적.
 *
 * schemaId를 몰라도 됨 — flow의 마지막 produces에서 자동 해석.
 */
export function findFieldOrigin(
  flow: PipeFlow,
  fieldName: string,
  pipeId = "pipe",
): string[] {
  const lineages = deriveStaticLineage(flow, pipeId);
  const allConsumed = new Set<string>();
  const allProduced = new Set<string>();
  collectAllFields(flow, allConsumed, allProduced);
  const inputs = [...allConsumed].filter(f => !allProduced.has(f));

  const lastSchemas = getLastProducesWithSchema(flow, pipeId);
  const startSchemaId = lastSchemas.get(fieldName);
  if (!startSchemaId) return []; // 해당 필드가 flow의 출력에 없음

  return traceOriginsStatic({ schemaId: startSchemaId, column: fieldName }, lineages, inputs);
}

// ── graph-level 계보 ────────────────────────────────

/** graph 전체의 계보 요약 */
export interface GraphLineageSummary {
  /** pipe별 정적 계보 */
  pipeLineages: Map<string, FieldLineage[]>;
  /** pipe 간 connection 기반 cross-pipe chain */
  crossPipeChains: FieldLineage[];
  /** 전체 통합 lineage (pipe 내부 + cross-pipe) */
  allLineages: FieldLineage[];
}

/**
 * PipeGraph 전체에서 계보를 파생한다.
 *
 * 1. 각 pipe의 정적 계보를 파생
 * 2. PipeConnection을 따라 pipe 간 cross-pipe chain 생성
 */
export function deriveGraphLineage(graph: PipeGraph): GraphLineageSummary {
  const pipeLineages = new Map<string, FieldLineage[]>();
  const pipeMap = new Map(graph.pipes.map(p => [p.pipeId, p]));

  // 1. 각 pipe의 정적 계보
  for (const pipe of graph.pipes) {
    pipeLineages.set(pipe.pipeId, deriveStaticLineage(pipe.flow, pipe.pipeId));
  }

  // 2. connection 기반 cross-pipe chain
  const crossPipeChains: FieldLineage[] = [];

  for (const conn of graph.connections) {
    const fromRefs = normalizePortRefs(conn.from);
    const toRefs = normalizePortRefs(conn.to);

    for (const fromRef of fromRefs) {
      const fromPipe = pipeMap.get(fromRef.pipeId);
      if (!fromPipe) continue;
      const fromProduces = getFlowProduces(fromPipe.flow, fromRef.pipeId);
      if (!fromProduces) continue;

      // PortRef의 portId로 port의 facetType 조회
      const fromPortFacet = fromRef.portId
        ? fromPipe.ports?.find(p => p.portId === fromRef.portId)?.facetType
        : undefined;

      for (const toRefEntry of toRefs) {
        const toPipe = pipeMap.get(toRefEntry.pipeId);
        if (!toPipe) continue;
        const toConsumes = getFlowConsumes(toPipe.flow, toRefEntry.pipeId);
        if (!toConsumes) continue;

        const toPortFacet = toRefEntry.portId
          ? toPipe.ports?.find(p => p.portId === toRefEntry.portId)?.facetType
          : undefined;

        // facetType 우선순위: PortRef port facet > connection-level facetType
        const effectiveFacet = fromPortFacet ?? toPortFacet ?? conn.facetType;

        // facetType 기반 필터링 또는 이름 매칭
        for (const [field, toFieldRef] of toConsumes) {
          if (effectiveFacet && field !== effectiveFacet) continue;

          const fromFieldRef = fromProduces.get(field);
          if (fromFieldRef) {
            crossPipeChains.push({
              target: { schemaId: toFieldRef.schemaId, column: field },
              sources: [{ schemaId: fromFieldRef.schemaId, column: field }],
              transform: "direct",
              pipeId: `${fromRef.pipeId}→${toRefEntry.pipeId}`,
              stepPath: `connection.${conn.kind}`,
            });
          }
        }
      }
    }
  }

  // 3. 통합
  const allLineages = [...[...pipeLineages.values()].flat(), ...crossPipeChains];

  return { pipeLineages, crossPipeChains, allLineages };
}

/**
 * graph 전체의 입출력 계보 요약 — entry pipe 입력 → exit pipe 출력 압축.
 */
export function summarizeGraphLineage(graph: PipeGraph): FlowLineageSummary {
  const { allLineages } = deriveGraphLineage(graph);

  // graph 전체의 입력: entry pipe의 첫 consumes
  const entryPipe = graph.pipes.find(p => p.pipeId === graph.entryPipeId);
  const allConsumed = new Set<string>();
  const allProduced = new Set<string>();
  for (const pipe of graph.pipes) {
    collectAllFields(pipe.flow, allConsumed, allProduced);
  }
  const inputs = [...allConsumed].filter(f => !allProduced.has(f));

  // graph 전체의 출력: 나가는 연결 없는 pipe의 마지막 produces
  const hasOutgoing = new Set<string>();
  for (const conn of graph.connections) {
    for (const id of normalizeEndpointPipeIds(conn.from)) hasOutgoing.add(id);
  }
  const exitPipes = graph.pipes.filter(p => !hasOutgoing.has(p.pipeId));
  const outputSet = new Set<string>();
  const outputSchemas = new Map<string, string>();
  for (const pipe of exitPipes) {
    const lp = getLastProducesWithSchema(pipe.flow, pipe.pipeId);
    for (const [f, sid] of lp) { outputSet.add(f); outputSchemas.set(f, sid); }
  }
  const outputs = [...outputSet];

  // 출력별 기여 입력 역추적
  const outputLineage: Record<string, string[]> = {};
  for (const output of outputs) {
    const startSchemaId = outputSchemas.get(output) ?? "";
    outputLineage[output] = traceOriginsStatic({ schemaId: startSchemaId, column: output }, allLineages, inputs);
  }

  return { inputs, outputs, outputLineage };
}

/**
 * graph에서 특정 pipe의 특정 필드 origin을 cross-pipe로 역추적.
 */
export function findFieldOriginInGraph(
  graph: PipeGraph,
  pipeId: string,
  fieldName: string,
): string[] {
  const { allLineages } = deriveGraphLineage(graph);

  // 전체 입력 수집
  const allConsumed = new Set<string>();
  const allProduced = new Set<string>();
  for (const pipe of graph.pipes) {
    collectAllFields(pipe.flow, allConsumed, allProduced);
  }
  const inputs = [...allConsumed].filter(f => !allProduced.has(f));

  // 해당 pipe의 produces에서 시작 schemaId
  const pipe = graph.pipes.find(p => p.pipeId === pipeId);
  if (!pipe) return [];
  const lastSchemas = getLastProducesWithSchema(pipe.flow, pipeId);
  const startSchemaId = lastSchemas.get(fieldName);
  if (!startSchemaId) return [];

  return traceOriginsStatic({ schemaId: startSchemaId, column: fieldName }, allLineages, inputs);
}

// ── 계보 직렬화 ─────────────────────────────────────

/** FieldLineage의 안정 키 — target + sources + transform 기반 */
export function lineageId(lineage: FieldLineage): string {
  const srcKey = lineage.sources
    .map(s => `${s.schemaId}:${s.column}`)
    .sort()
    .join("+");
  return `${lineage.target.schemaId}:${lineage.target.column}←${srcKey}|${lineage.transform}`;
}

export function serializeLineage(lineages: readonly FieldLineage[]): string {
  return JSON.stringify(lineages);
}

export function deserializeLineage(json: string): FieldLineage[] {
  return JSON.parse(json) as FieldLineage[];
}

export interface LineageDiff {
  added: FieldLineage[];
  removed: FieldLineage[];
  unchanged: number;
}

/** 두 계보 버전 간 차이 비교 */
export function diffLineage(prev: readonly FieldLineage[], next: readonly FieldLineage[]): LineageDiff {
  const prevIds = new Map(prev.map(l => [lineageId(l), l]));
  const nextIds = new Map(next.map(l => [lineageId(l), l]));

  const added: FieldLineage[] = [];
  const removed: FieldLineage[] = [];
  let unchanged = 0;

  for (const [id, lineage] of nextIds) {
    if (prevIds.has(id)) unchanged++;
    else added.push(lineage);
  }
  for (const [id, lineage] of prevIds) {
    if (!nextIds.has(id)) removed.push(lineage);
  }

  return { added, removed, unchanged };
}
