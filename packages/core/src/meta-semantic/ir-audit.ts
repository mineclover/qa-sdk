// @def.boundary qa-sdk-core-system
// @def.doc qa-sdk-core-system

/**
 * IR 감사 — rule.md의 체크리스트와 분할 판별을 자동 실행.
 *
 * validateIRGraph (참조 무결성)과 별개로,
 * "올바르지만 개선이 필요한" 구조적 품질 이슈를 감지한다.
 */

import type { ModuleIR, DataIR, PipeIR } from "./ir-types.js";
import type { IRGraph } from "./ir-validate.js";
import { inferModuleLevel, computeSchemaHash, deriveCertainty } from "./ir-types.js";

// ── 감사 결과 타입 ────────────────────────────────────

export type AuditSeverity = "error" | "warning" | "info";

export type AuditRule =
  | "level-mismatch"
  | "certainty-mismatch"
  | "hash-mismatch"
  | "nonstandard-uid-scheme"
  | "too-many-inputs"
  | "too-many-outputs"
  | "too-many-children"
  | "mixed-certainty"
  | "shared-data";

export interface AuditIssue {
  readonly severity: AuditSeverity;
  readonly category: "consistency" | "split-signal" | "quality";
  readonly target: string;
  readonly rule: AuditRule;
  readonly message: string;
}

// ── 감사 함수 ─────────────────────────────────────────

/** rule.md §2 체크리스트 + §3 분할 판별을 실행 */
export function auditIRGraph(graph: IRGraph): AuditIssue[] {
  const issues: AuditIssue[] = [];

  auditModuleConsistency(graph.modules, issues);
  auditDataConsistency(graph.data, issues);
  auditSplitSignals(graph, issues);

  return issues;
}

// ── §2 패싯 정합성 ────────────────────────────────────

function auditModuleConsistency(modules: readonly ModuleIR[], issues: AuditIssue[]): void {
  for (const mod of modules) {
    // level 불일치
    const inferred = inferModuleLevel(mod.relations);
    if (mod.meta.level !== inferred) {
      issues.push({
        severity: "error",
        category: "consistency",
        target: mod.id,
        rule: "level-mismatch",
        message: `meta.level="${mod.meta.level}" ≠ inferModuleLevel="${inferred}"`,
      });
    }
  }
}

function auditDataConsistency(data: readonly DataIR[], issues: AuditIssue[]): void {
  for (const d of data) {
    // certainty 불일치
    const inferred = deriveCertainty(d.definition.fields);
    if (d.definition.certainty !== inferred) {
      issues.push({
        severity: "error",
        category: "consistency",
        target: d.definition.type,
        rule: "certainty-mismatch",
        message: `certainty="${d.definition.certainty}" ≠ deriveCertainty="${inferred}"`,
      });
    }

    // schemaHash 불일치
    const computed = computeSchemaHash(d.definition.fields);
    if (d.definition.schemaHash !== computed) {
      issues.push({
        severity: "error",
        category: "consistency",
        target: d.definition.type,
        rule: "hash-mismatch",
        message: `schemaHash="${d.definition.schemaHash}" ≠ computed="${computed}"`,
      });
    }

    // uidScheme 비표준
    if (d.storage.uid && !d.storage.uidScheme.startsWith("intent:")) {
      issues.push({
        severity: "warning",
        category: "quality",
        target: d.definition.type,
        rule: "nonstandard-uid-scheme",
        message: `uidScheme="${d.storage.uidScheme}" — 표준은 "intent:v1"`,
      });
    }
  }
}

// ── §3 분할 신호 ──────────────────────────────────────

function auditSplitSignals(graph: IRGraph, issues: AuditIssue[]): void {
  const moduleDataMap = buildModuleDataMap(graph);

  for (const mod of graph.modules) {
    // inputs > 5
    if (mod.interface.inputs.length > 5) {
      issues.push({
        severity: "info",
        category: "split-signal",
        target: mod.id,
        rule: "too-many-inputs",
        message: `interface.inputs=${mod.interface.inputs.length}개 (>5) — 하위 module로 분할 검토`,
      });
    }

    // outputs > 3
    if (mod.interface.outputs.length > 3) {
      issues.push({
        severity: "info",
        category: "split-signal",
        target: mod.id,
        rule: "too-many-outputs",
        message: `interface.outputs=${mod.interface.outputs.length}개 (>3) — 패싯별 leaf로 분할 검토`,
      });
    }

    // children > 7
    if (mod.relations.children.length > 7) {
      issues.push({
        severity: "info",
        category: "split-signal",
        target: mod.id,
        rule: "too-many-children",
        message: `relations.children=${mod.relations.children.length}개 (>7) — 중간 module 계층 삽입 검토`,
      });
    }

    // certainty 혼재
    const dataItems = moduleDataMap.get(mod.id);
    if (dataItems && dataItems.length > 1) {
      const certainties = new Set(dataItems.map(d => d.definition.certainty));
      if (certainties.size > 1) {
        issues.push({
          severity: "warning",
          category: "split-signal",
          target: mod.id,
          rule: "mixed-certainty",
          message: `strict + flexible 데이터 공존 — 경로 분리 검토`,
        });
      }
    }
  }

  // 공유 데이터 3+
  const managerCount = new Map<string, Set<string>>();
  for (const d of graph.data) {
    const consumers = [...d.lifecycle.producedBy, ...d.lifecycle.consumedBy, ...d.lifecycle.transformedBy];
    for (const ref of consumers) {
      let set = managerCount.get(d.definition.type);
      if (!set) { set = new Set(); managerCount.set(d.definition.type, set); }
      set.add(ref.moduleId);
    }
  }
  for (const [dataType, modules] of managerCount) {
    if (modules.size >= 3) {
      issues.push({
        severity: "info",
        category: "split-signal",
        target: dataType,
        rule: "shared-data",
        message: `${modules.size}개 모듈이 공유 — managedBy를 상위 계층으로 끌어올림 검토`,
      });
    }
  }
}

// ── 헬퍼 ──────────────────────────────────────────────

/** 모듈 → 관련 DataIR 매핑 (management + lifecycle 기준) */
function buildModuleDataMap(graph: IRGraph): Map<string, DataIR[]> {
  const map = new Map<string, DataIR[]>();
  for (const d of graph.data) {
    const relatedModules = new Set<string>();
    relatedModules.add(d.management.managedBy.moduleId);
    for (const ref of [...d.lifecycle.producedBy, ...d.lifecycle.consumedBy]) {
      relatedModules.add(ref.moduleId);
    }
    for (const modId of relatedModules) {
      let list = map.get(modId);
      if (!list) { list = []; map.set(modId, list); }
      list.push(d);
    }
  }
  return map;
}
