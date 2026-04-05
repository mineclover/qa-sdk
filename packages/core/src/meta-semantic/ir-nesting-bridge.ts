/**
 * Nesting ↔ IR 정합성 브릿지.
 *
 * ScopeNesting의 provides/consumes 계약과
 * IRGraph의 Module→Data 참조가 일관적인지 교차 검증한다.
 *
 * rule.md §3: "nesting missing-provider와 IR dangling-ref가 같은 문제의 다른 관점"
 */

import type { ScopeNesting, ScopeContract } from "../scope-nesting.js";
import { validateScopeNesting } from "../scope-nesting.js";
import type { IRGraph, IRIssue } from "./ir-validate.js";
import { validateIRGraph } from "./ir-validate.js";
import type { ModuleIR, DataRef } from "./ir-types.js";

// ── 교차 검증 결과 ────────────────────────────────────

export interface CrossValidationIssue {
  readonly severity: "error" | "warning";
  readonly source: "nesting" | "ir" | "cross";
  readonly rule: string;
  readonly target: string;
  readonly message: string;
}

export interface CrossValidationResult {
  readonly nestingValid: boolean;
  readonly irValid: boolean;
  readonly issues: readonly CrossValidationIssue[];
}

// ── 교차 검증 ─────────────────────────────────────────

/** ScopeNesting + IRGraph를 동시에 검증하고 교차 이슈를 탐지 */
/** 이미 실행된 검증 결과를 넘기면 중복 호출을 건너뛴다 */
export interface PrecomputedValidation {
  readonly nestingResult?: ReturnType<typeof validateScopeNesting>;
  readonly irIssues?: readonly IRIssue[];
}

export function crossValidate(
  nesting: ScopeNesting,
  graph: IRGraph,
  precomputed?: PrecomputedValidation,
): CrossValidationResult {
  const issues: CrossValidationIssue[] = [];

  // step 1: nesting 자체 검증 (precomputed 있으면 재사용)
  const nestingResult = precomputed?.nestingResult ?? validateScopeNesting(nesting);
  for (const ni of nestingResult.issues) {
    issues.push({
      severity: ni.severity,
      source: "nesting",
      rule: ni.code,
      target: `${ni.scopeId}/${ni.contractId}`,
      message: ni.message,
    });
  }

  // step 2: IR 자체 검증 (precomputed 있으면 재사용)
  const irIssues = precomputed?.irIssues ?? validateIRGraph(graph);
  for (const ii of irIssues) {
    issues.push({
      severity: ii.severity,
      source: "ir",
      rule: ii.type,
      target: ii.target,
      message: ii.message,
    });
  }

  // step 3: 교차 검증 — nesting scope ↔ IR module 매핑
  const moduleMap = new Map(graph.modules.map(m => [m.id, m]));
  const scopeMap = new Map(nesting.scopes.map(s => [s.scopeId, s]));

  // nesting scope에 대응하는 IR module이 있는가
  for (const scope of nesting.scopes) {
    if (!moduleMap.has(scope.scopeId)) {
      issues.push({
        severity: "warning",
        source: "cross",
        rule: "scope-without-module",
        target: scope.scopeId,
        message: `nesting scope "${scope.scopeId}"에 대응하는 ModuleIR 없음`,
      });
      continue;
    }

    const mod = moduleMap.get(scope.scopeId)!;

    // provides ↔ outputs 매칭
    for (const contract of scope.provides) {
      const hasOutput = mod.interface.outputs.some(o => o.dataId === contract.contractId);
      if (!hasOutput) {
        issues.push({
          severity: "warning",
          source: "cross",
          rule: "provides-without-output",
          target: `${scope.scopeId}/${contract.contractId}`,
          message: `scope provides "${contract.contractId}" 하지만 ModuleIR.outputs에 없음`,
        });
      }
    }

    // consumes ↔ inputs 매칭
    for (const contract of scope.consumes) {
      const hasInput = mod.interface.inputs.some(i => i.dataId === contract.contractId);
      if (!hasInput) {
        issues.push({
          severity: "warning",
          source: "cross",
          rule: "consumes-without-input",
          target: `${scope.scopeId}/${contract.contractId}`,
          message: `scope consumes "${contract.contractId}" 하지만 ModuleIR.inputs에 없음`,
        });
      }
    }
  }

  // IR module에 대응하는 nesting scope가 있는가 (역방향)
  for (const mod of graph.modules) {
    if (mod.relations.children.length > 0 && !scopeMap.has(mod.id)) {
      // group/module 수준이면 nesting에도 있어야 의미
      issues.push({
        severity: "warning",
        source: "cross",
        rule: "module-without-scope",
        target: mod.id,
        message: `ModuleIR "${mod.id}" (level=${mod.meta.level})에 대응하는 nesting scope 없음`,
      });
    }
  }

  return {
    nestingValid: nestingResult.valid,
    irValid: irIssues.filter(i => i.severity === "error").length === 0,
    issues,
  };
}

// ── ScopeNesting → ModuleIR 변환 ─────────────────────

/** ScopeNesting에서 ModuleIR 계층을 파생 */
export function nestingToModuleIRs(nesting: ScopeNesting): ModuleIR[] {
  const modules: ModuleIR[] = [];

  for (let i = 0; i < nesting.scopes.length; i++) {
    const scope = nesting.scopes[i];
    const parent = i > 0 ? nesting.scopes[i - 1] : null;
    const child = i < nesting.scopes.length - 1 ? nesting.scopes[i + 1] : null;

    const inputs: DataRef[] = scope.consumes.map(c => ({
      dataId: c.contractId,
      schemaHash: "",
    }));

    const outputs: DataRef[] = scope.provides.map(c => ({
      dataId: c.contractId,
      schemaHash: "",
    }));

    modules.push({
      id: scope.scopeId,
      source: { filePath: "", line: 0, kind: "module" },
      interface: { inputs, outputs, sideEffects: [] },
      relations: {
        parent: parent ? { moduleId: parent.scopeId } : null,
        children: child ? [{ moduleId: child.scopeId }] : [],
        internal: [],
        external: [],
      },
      meta: {
        level: !parent && child ? "group"
          : parent && child ? "module"
          : "leaf",
      },
    });
  }

  return modules;
}
