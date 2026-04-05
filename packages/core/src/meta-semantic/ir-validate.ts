/**
 * IR 그래프 검증 — 참조 무결성, 순환 탐지, 고아 감지.
 *
 * 스펙: docs/specs/meta-semantic/meta-semantic-ir/
 */

import type { ModuleIR, DataIR, PipeIR } from "./ir-types.js";

export type IRIssueSeverity = "error" | "warning";

export type IRIssueType =
  | "dangling-ref"
  | "missing-manager"
  | "orphan-data"
  | "orphan-module"
  | "circular-pipe"
  | "circular-parent"
  | "schema-collision";

export interface IRIssue {
  readonly severity: IRIssueSeverity;
  readonly type: IRIssueType;
  readonly target: string;
  readonly message: string;
}

export interface IRGraph {
  readonly modules: readonly ModuleIR[];
  readonly data: readonly DataIR[];
  readonly pipes: readonly PipeIR[];
}

/** IR 그래프 전체 검증 */
export function validateIRGraph(graph: IRGraph): IRIssue[] {
  const issues: IRIssue[] = [];
  const moduleMap = new Map(graph.modules.map(m => [m.id, m]));
  const dataIds = new Set(graph.data.map(d => d.definition.type));
  const pipeIds = new Set(graph.pipes.map(p => p.transactionId));

  // 모듈 검증
  for (const mod of graph.modules) {
    // parent 순환 탐지
    if (mod.relations.parent && !moduleMap.has(mod.relations.parent.moduleId)) {
      issues.push({
        severity: "error",
        type: "dangling-ref",
        target: mod.id,
        message: `parent "${mod.relations.parent.moduleId}" 미존재`,
      });
    }

    for (const child of mod.relations.children) {
      if (!moduleMap.has(child.moduleId)) {
        issues.push({
          severity: "error",
          type: "dangling-ref",
          target: mod.id,
          message: `child "${child.moduleId}" 미존재`,
        });
      }
    }

    // interface의 DataRef 검증
    for (const input of mod.interface.inputs) {
      if (!dataIds.has(input.dataId)) {
        issues.push({
          severity: "error",
          type: "dangling-ref",
          target: mod.id,
          message: `input data "${input.dataId}" 미존재`,
        });
      }
    }

    for (const output of mod.interface.outputs) {
      if (!dataIds.has(output.dataId)) {
        issues.push({
          severity: "error",
          type: "dangling-ref",
          target: mod.id,
          message: `output data "${output.dataId}" 미존재`,
        });
      }
    }
  }

  // 데이터 검증
  for (const data of graph.data) {
    if (!moduleMap.has(data.management.managedBy.moduleId)) {
      issues.push({
        severity: "error",
        type: "missing-manager",
        target: data.definition.type,
        message: `managedBy "${data.management.managedBy.moduleId}" 미존재`,
      });
    }

    const hasProducer = data.lifecycle.producedBy.length > 0;
    const hasConsumer = data.lifecycle.consumedBy.length > 0;
    if (!hasProducer && !hasConsumer) {
      issues.push({
        severity: "warning",
        type: "orphan-data",
        target: data.definition.type,
        message: "producedBy/consumedBy 모두 비어 있음",
      });
    }
  }

  // 파이프 검증 — triggers 순환 탐지
  for (const pipe of graph.pipes) {
    if (!moduleMap.has(pipe.targetModule.moduleId)) {
      issues.push({
        severity: "error",
        type: "dangling-ref",
        target: pipe.transactionId,
        message: `targetModule "${pipe.targetModule.moduleId}" 미존재`,
      });
    }

    if (!dataIds.has(pipe.payload.dataId)) {
      issues.push({
        severity: "error",
        type: "dangling-ref",
        target: pipe.transactionId,
        message: `payload "${pipe.payload.dataId}" 미존재`,
      });
    }
  }

  // triggers 순환 탐지 (DFS)
  const triggerMap = new Map(graph.pipes.map(p => [p.transactionId, p.triggers.map(t => t.pipeId)]));
  for (const pipe of graph.pipes) {
    const visited = new Set<string>();
    const stack = [pipe.transactionId];
    while (stack.length > 0) {
      const current = stack.pop()!;
      if (visited.has(current)) {
        issues.push({
          severity: "error",
          type: "circular-pipe",
          target: pipe.transactionId,
          message: `triggers 순환: ${pipe.transactionId} → ... → ${current}`,
        });
        break;
      }
      visited.add(current);
      const nexts = triggerMap.get(current) ?? [];
      stack.push(...nexts);
    }
  }

  // parent 순환 탐지 (전체)
  for (const mod of graph.modules) {
    const visited = new Set<string>();
    let current: string | null = mod.id;
    while (current) {
      if (visited.has(current)) {
        issues.push({
          severity: "error",
          type: "circular-parent",
          target: mod.id,
          message: `parent 순환: ${mod.id} → ... → ${current}`,
        });
        break;
      }
      visited.add(current);
      const m = moduleMap.get(current);
      current = m?.relations.parent?.moduleId ?? null;
    }
  }

  // schemaHash 충돌 (다른 type인데 같은 hash)
  const hashToType = new Map<string, string>();
  for (const data of graph.data) {
    const existing = hashToType.get(data.definition.schemaHash);
    if (existing && existing !== data.definition.type) {
      issues.push({
        severity: "warning",
        type: "schema-collision",
        target: data.definition.type,
        message: `schemaHash "${data.definition.schemaHash}" 충돌: "${existing}" vs "${data.definition.type}"`,
      });
    }
    hashToType.set(data.definition.schemaHash, data.definition.type);
  }

  // 고아 모듈 (비루트인데 어떤 parent에도 속하지 않음)
  const childrenOf = new Set(graph.modules.flatMap(m => m.relations.children.map(c => c.moduleId)));
  for (const mod of graph.modules) {
    if (mod.relations.parent === null && !childrenOf.has(mod.id) && mod.relations.children.length === 0 && graph.modules.length > 1) {
      issues.push({
        severity: "warning",
        type: "orphan-module",
        target: mod.id,
        message: "어떤 parent에도 속하지 않는 비루트 leaf 모듈",
      });
    }
  }

  return issues;
}
