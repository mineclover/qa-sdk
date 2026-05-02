// @def.boundary dkg-system-root
// @def.doc dkg-system-root

/**
 * constraint-check — 독립 constraint 위반 검사.
 *
 * analyzeImpact에서 분리된 전용 skill.
 * 단독 실행 가능 + analyzeImpact에서도 호출.
 */

import type { GraphPort, GraphNodeLike } from "spec-schema";
import type { ConstraintNode, ConstraintViolation } from "../dkg.types.js";

export type { ConstraintViolation };

export interface ConstraintCheckResult {
  readonly targetId: string;
  readonly violations: readonly ConstraintViolation[];
  readonly passed: readonly PassedConstraint[];
}

export interface PassedConstraint {
  readonly constraintId: string;
  readonly rule: string;
}

function isConstraintNode(node: GraphNodeLike | undefined): node is ConstraintNode {
  const record = node as (GraphNodeLike & Record<string, unknown>) | undefined;
  return node?.kind === "constraint"
    && typeof record?.rule === "string"
    && Array.isArray(record?.scope);
}

function isActiveConstraintNode(node: GraphNodeLike): node is ConstraintNode {
  return isConstraintNode(node) && node.lifecycle === "active";
}

/**
 * 단일 대상에 대한 constraint 검사.
 */
export function checkConstraints(
  graph: GraphPort,
  targetId: string,
): ConstraintCheckResult {
  const edges = graph.edgesTo(targetId, "constrains");
  const violations: ConstraintViolation[] = [];
  const passed: PassedConstraint[] = [];

  for (const edge of edges) {
    const node = graph.getNode(edge.from);
    if (!isConstraintNode(node)) continue;
    const cn = node;

    if (cn.lifecycle !== "active") continue;

    // formal expression 평가 (간단한 패턴 매칭)
    if (cn.formal) {
      const violated = evaluateFormal(graph, cn.formal, targetId);
      if (violated) {
        violations.push({ constraintId: cn.id, rule: cn.rule, severity: "error" });
        continue;
      }
    }

    passed.push({ constraintId: cn.id, rule: cn.rule });
  }

  return { targetId, violations, passed };
}

/**
 * 여러 대상에 대한 일괄 constraint 검사.
 */
export function checkAllConstraints(
  graph: GraphPort,
  targetIds: readonly string[],
): ConstraintCheckResult[] {
  return targetIds.map(id => checkConstraints(graph, id));
}

/**
 * DKG의 모든 활성 constraint에 대해 전체 scope를 검사.
 */
export function auditAllConstraints(
  graph: GraphPort,
): {
  total: number;
  passed: number;
  violated: number;
  results: ConstraintCheckResult[];
} {
  const constraints = graph.getNodesByKind("constraint").filter(isActiveConstraintNode);
  const allTargets = new Set<string>();

  for (const c of constraints) {
    for (const scopeId of c.scope) {
      allTargets.add(scopeId);
    }
  }

  const results = checkAllConstraints(graph, [...allTargets]);
  const violated = results.filter(r => r.violations.length > 0).length;

  return {
    total: results.length,
    passed: results.length - violated,
    violated,
    results,
  };
}

/**
 * formal expression의 간단한 평가.
 * 현재: REVIEWED_OVERLAP 패턴만 지원 (분리 유지 기록).
 * 확장 가능.
 */
function evaluateFormal(graph: GraphPort, formal: string, _targetId: string): boolean {
  // REVIEWED_OVERLAP(...) = keep-separate → 위반 아님 (이미 검토됨)
  if (formal.startsWith("REVIEWED_OVERLAP")) return false;

  // NOT EXISTS(prefix p WHERE p.dims HAS 'X' AND p.dims HAS 'Y')
  const notExistsMatch = formal.match(/NOT EXISTS\(prefix p WHERE p\.dims HAS '(\w+)' AND p\.dims HAS '(\w+)'\)/);
  if (notExistsMatch) {
    const [, axisA, axisB] = notExistsMatch;
    // 모든 prefix를 검사하여 두 축을 동시에 사용하는 prefix가 있는지
    const prefixes = graph.getNodesByKind("prefix");
    for (const p of prefixes) {
      const composedAxes = graph.neighbors(p.id, "composes");
      if (composedAxes.includes(axisA) && composedAxes.includes(axisB)) {
        return true; // 위반 — 두 축을 동시에 사용하는 prefix 존재
      }
    }
    return false;
  }

  // 알 수 없는 formal → 위반으로 판단하지 않음
  return false;
}
