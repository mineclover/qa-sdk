/**
 * IR ↔ PipeSpec 브릿지 — 기존 파이프 모델과 IR 3종 간 변환.
 *
 * PipeSpec/PipeGraph(런타임 구조)에서 IR(의미 구조)를 파생한다.
 * IR은 관측/분석용이고 PipeSpec은 실행용이므로, 방향은 PipeSpec → IR.
 */

import type { PipeSpec, PipeGraph, PipeConnection } from "../types/pipe-spec.js";
import type { StepDataContract } from "../types/pipe-spec.js";
import type { ModuleIR, DataIR, PipeIR, ModuleRef, DataRef, PipeRef, FieldDescriptor } from "./ir-types.js";
import { computeSchemaHash, deriveCertainty, inferModuleLevel } from "./ir-types.js";

// ── PipeSpec → PipeIR ─────────────────────────────────

/** PipeSpec 하나를 PipeIR로 변환 */
export function pipeSpecToIR(spec: PipeSpec, txSeqBase: number = 0): PipeIR {
  return {
    transactionId: `${spec.pipeId}:tx:${txSeqBase}`,
    targetModule: { moduleId: spec.pipeId },
    payload: {
      dataId: spec.trigger.eventKey,
      schemaHash: computeSchemaHash([{ name: "eventKey", type: "string", optional: false, hasDefault: false }]),
    },
    state: "pending",
    triggers: (spec.produces ?? []).map(eventKey => ({
      pipeId: eventKey,
      targetModule: { moduleId: eventKey },
    })),
    source: {
      filePath: "",
      line: 0,
      kind: "event-emit",
    },
  };
}

// ── PipeGraph → ModuleIR ──────────────────────────────

/** PipeGraph를 루트 ModuleIR + 자식 모듈로 분해 */
export function pipeGraphToModuleIR(graph: PipeGraph): ModuleIR[] {
  const childRefs: ModuleRef[] = graph.pipes.map(p => ({ moduleId: p.pipeId }));
  const rootRef: ModuleRef = { moduleId: graph.graphId };

  // 루트 모듈 (그래프 전체)
  const root: ModuleIR = {
    id: graph.graphId,
    source: { filePath: "", line: 0, kind: "module" },
    interface: {
      inputs: collectGraphInputs(graph),
      outputs: collectGraphOutputs(graph),
      sideEffects: [],
    },
    relations: {
      parent: null,
      children: childRefs,
      internal: [],
      external: [],
    },
    meta: { level: inferModuleLevel({ parent: null, children: childRefs, internal: [], external: [] }) },
  };

  // 각 파이프 = leaf 모듈
  const children: ModuleIR[] = graph.pipes.map(spec => {
    const outgoing = graph.connections
      .filter(c => connectionIncludes(c.from, spec.pipeId))
      .map(c => resolveConnectionTarget(c));
    const incoming = graph.connections
      .filter(c => connectionIncludes(c.to, spec.pipeId))
      .map(c => resolveConnectionSource(c));

    return {
      id: spec.pipeId,
      source: { filePath: "", line: 0, kind: "function" as const },
      interface: {
        inputs: [{ dataId: spec.trigger.eventKey, schemaHash: "" }],
        outputs: (spec.produces ?? []).map(e => ({ dataId: e, schemaHash: "" })),
        sideEffects: [],
      },
      relations: {
        parent: rootRef,
        children: [],
        internal: [],
        external: outgoing.map(id => ({ moduleId: id })),
      },
      meta: { level: "leaf" as const },
    };
  });

  return [root, ...children];
}

// ── StepDataContract → DataIR ─────────────────────────

/** StepDataContract에서 DataIR를 파생 */
export function stepContractToDataIR(
  contract: StepDataContract,
  managedBy: ModuleRef,
): DataIR {
  const fields: FieldDescriptor[] = [
    ...Object.entries(contract.consumes ?? {}).map(([name, spec]) => ({
      name,
      type: spec.type,
      optional: !spec.required,
      hasDefault: false,
    })),
    ...Object.entries(contract.produces ?? {}).map(([name, spec]) => ({
      name,
      type: spec.type,
      optional: !spec.required,
      hasDefault: false,
    })),
  ];

  const schemaHash = computeSchemaHash(fields);

  return {
    definition: {
      type: "step",
      schemaHash,
      fields,
      certainty: deriveCertainty(fields),
    },
    management: {
      managedBy,
      validationRules: [],
      transactionScope: "local",
    },
    lifecycle: {
      producedBy: [managedBy],
      consumedBy: [],
      transformedBy: [],
    },
    storage: {
      uid: "",
      uidScheme: "intent:v1",
      storageType: "memory",
      retention: "ephemeral",
    },
  };
}

// ── 헬퍼 ──────────────────────────────────────────────

function collectGraphInputs(graph: PipeGraph): DataRef[] {
  const entry = graph.pipes.find(p => p.pipeId === graph.entryPipeId);
  if (!entry) return [];
  return [{ dataId: entry.trigger.eventKey, schemaHash: "" }];
}

function collectGraphOutputs(graph: PipeGraph): DataRef[] {
  // produces가 있는 파이프 중 다른 파이프의 trigger가 아닌 것 = 그래프 출력
  const triggerKeys = new Set(graph.pipes.map(p => p.trigger.eventKey));
  const outputs: DataRef[] = [];
  for (const pipe of graph.pipes) {
    for (const eventKey of pipe.produces ?? []) {
      if (!triggerKeys.has(eventKey)) {
        outputs.push({ dataId: eventKey, schemaHash: "" });
      }
    }
  }
  return outputs;
}

function connectionIncludes(endpoint: PipeConnection["from"], pipeId: string): boolean {
  if (typeof endpoint === "string") return endpoint === pipeId;
  if (Array.isArray(endpoint)) {
    return endpoint.some(e => typeof e === "string" ? e === pipeId : e.pipeId === pipeId);
  }
  return (endpoint as { pipeId: string }).pipeId === pipeId;
}

function resolveConnectionTarget(conn: PipeConnection): string {
  const to = conn.to;
  if (typeof to === "string") return to;
  if (Array.isArray(to)) {
    const first = to[0];
    return typeof first === "string" ? first : first.pipeId;
  }
  return (to as { pipeId: string }).pipeId;
}

function resolveConnectionSource(conn: PipeConnection): string {
  const from = conn.from;
  if (typeof from === "string") return from;
  if (Array.isArray(from)) {
    const first = from[0];
    return typeof first === "string" ? first : first.pipeId;
  }
  return (from as { pipeId: string }).pipeId;
}
