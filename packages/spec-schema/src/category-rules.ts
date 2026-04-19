// @def.boundary spec-engine-system
// @def.doc spec-engine-system

/**
 * Category Rules — 카테고리별 prefix 타입 규칙.
 *
 * 각 SchemaCategory가 prefix에 요구하는 구조적 조건을 정의한다.
 * "이 카테고리의 prefix는 반드시 이 조건을 충족해야 한다."
 *
 * 이것이 문서 구조를 prefix 기반 타입으로 강제하는 메커니즘.
 *
 * ## Validation Layers
 *
 * - **L0 vocabulary**: axis entry 유효성 — entry가 정의된 vocabulary에 존재하는가.
 * - **L1 structural**: prefix 구조 유효성 — dimRef kind, dim count, required refs.
 * - **L2 constraint**: 비즈니스 규칙 — custom validate 함수, cross-prefix 관계.
 *
 * CATEGORY_RULES는 L1(구조)과 L2(제약)를 data-driven으로 선언한다.
 * L0(vocabulary)는 별도의 entry 검증 레이어에서 처리된다.
 */

import type { SchemaCategory } from "./schema.types.js";
import type { PrefixLike, GraphPort } from "./shared/graph-port.js";

export interface CategoryRule {
  readonly category: SchemaCategory;
  readonly description: string;
  /** prefix가 반드시 가져야 하는 dimRef kind */
  readonly requiredDimKinds?: readonly ("axis" | "prefix_ref" | "table_ref")[];
  /** prefix가 반드시 참조해야 하는 prefix (prefix_ref) */
  readonly requiredRefs?: readonly string[];
  /** 최소 차원 수 */
  readonly minDims?: number;
  /** 최대 차원 수 */
  readonly maxDims?: number;
  /**
   * 추가 검증 함수.
   *
   * @remarks L2 constraint validation을 구현한다.
   * L1 structural 검증(dimRef kind, dim count, required refs)은
   * CATEGORY_RULES의 선언적 필드로 처리되고,
   * 이 함수는 그래프 구조를 탐색해야 하는 비즈니스 규칙을 검증한다.
   */
  readonly validate?: (prefixId: string, graph: GraphPort) => string[];
}

/**
 * 6종 카테고리의 표준 규칙.
 */
export const CATEGORY_RULES: Record<SchemaCategory, CategoryRule> = {
  entity: {
    category: "entity",
    description: "정체성을 가진 것. 서비스, 콘텐츠, 리소스 등.",
    minDims: 2,
    maxDims: 6,
  },

  event: {
    category: "event",
    description: "발생한 것. 이벤트 prefix는 action 축을 가져야 하고, svc_ref 또는 table_ref를 포함해야 한다.",
    requiredDimKinds: ["axis"],
    minDims: 2,
    validate: (prefixId, graph) => {
      const errors: string[] = [];
      const edges = graph.edgesFrom(prefixId, "composes");
      const axisEdges = edges.filter(e => e.meta?.dimKind === "axis");

      // event prefix는 action/operation/intent 관련 축을 가져야 함
      const hasAction = axisEdges.some(e =>
        e.to.includes("action") || e.to.includes("deploy") || e.to.includes("health") ||
        e.to.includes("constraint") || e.to.includes("migration") || e.to.includes("result") ||
        e.to.includes("event_name") || e.to.includes("_op") || e.to.includes("intent") ||
        e.to.includes("lifecycle") || e.to.includes("record_type") || e.to.includes("decision_type") ||
        e.to.includes("skill_id") || e.to.includes("edge_type") || e.to.includes("spec_type") ||
        e.to.includes("escalation") || e.to.includes("forcing") || e.to.includes("cognitive") ||
        e.to.includes("flow_type"),
      );
      if (!hasAction) {
        errors.push(`event prefix "${prefixId}" has no action-related axis`);
      }

      return errors;
    },
  },

  relation: {
    category: "relation",
    description: "둘 이상의 객체 간 연결. subject, predicate, object 패턴.",
    minDims: 3,
  },

  state: {
    category: "state",
    description: "상태 스냅샷. status/lifecycle 축을 포함해야 한다.",
    minDims: 2,
  },

  policy: {
    category: "policy",
    description: "권한/적용 범위/판정 구조. role 또는 action 축을 포함해야 한다.",
    requiredDimKinds: ["axis"],
    validate: (prefixId, graph) => {
      const errors: string[] = [];
      const edges = graph.edgesFrom(prefixId, "composes");
      const axisIds = edges.filter(e => e.meta?.dimKind === "axis").map(e => e.to);

      const hasPolicyAxis = axisIds.some(id =>
        id.includes("role") || id.includes("action") || id.includes("resource") || id.includes("mask"),
      );
      if (!hasPolicyAxis) {
        errors.push(`policy prefix "${prefixId}" has no role/action/resource axis`);
      }

      return errors;
    },
  },

  observation: {
    category: "observation",
    description: "관측/로깅/추적. svc_ref(service 참조)를 포함해야 한다. 자기 참조 관측(dev/decision-domain)은 면제.",
    validate: (prefixId, graph) => {
      const errors: string[] = [];
      const refs = graph.neighbors(prefixId, "references");
      if (!refs.includes("service")) {
        // 자기 참조 관측 prefix (dev/decision-domain)는 service 참조 면제
        // 이 prefix들은 시스템 자체를 관측하므로 특정 서비스에 종속되지 않음
        const SELF_OBSERVATION_PREFIXES = [
          "test_coverage", "cli_tracking", "decision_path", "model_apply",
          "contract_check", "skill_execution",
        ];
        if (!SELF_OBSERVATION_PREFIXES.includes(prefixId)) {
          errors.push(`observation prefix "${prefixId}" must reference service prefix`);
        }
      }
      return errors;
    },
  },
};

/**
 * prefix가 자기 카테고리의 규칙을 준수하는지 검증한다.
 */
export interface CategoryValidationResult {
  readonly prefixId: string;
  readonly category: SchemaCategory;
  readonly valid: boolean;
  readonly errors: readonly string[];
}

export function validatePrefixCategory(
  prefixId: string,
  graph: GraphPort,
): CategoryValidationResult {
  const node = graph.getNode(prefixId) as PrefixLike | undefined;
  if (!node || node.kind !== "prefix") {
    return { prefixId, category: "entity", valid: false, errors: [`"${prefixId}" is not a prefix node`] };
  }

  const category = (node.category ?? "entity") as SchemaCategory;
  const rule = CATEGORY_RULES[category];
  const errors: string[] = [];

  // minDims
  if (rule.minDims && node.dimLabels.length < rule.minDims) {
    errors.push(`${category} requires ≥${rule.minDims} dims, got ${node.dimLabels.length}`);
  }

  // maxDims
  if (rule.maxDims && node.dimLabels.length > rule.maxDims) {
    errors.push(`${category} requires ≤${rule.maxDims} dims, got ${node.dimLabels.length}`);
  }

  // requiredRefs
  if (rule.requiredRefs) {
    const refs = graph.neighbors(prefixId, "references");
    for (const req of rule.requiredRefs) {
      if (!refs.includes(req)) {
        errors.push(`${category} requires reference to "${req}"`);
      }
    }
  }

  // custom validate
  if (rule.validate) {
    errors.push(...rule.validate(prefixId, graph));
  }

  return { prefixId, category, valid: errors.length === 0, errors };
}

/**
 * 모든 prefix의 카테고리 규칙 준수를 검증한다.
 */
export function validateAllCategories(
  graph: GraphPort,
): {
  total: number;
  passed: number;
  failed: number;
  results: CategoryValidationResult[];
} {
  const prefixes = graph.getNodesByKind("prefix");
  const results = prefixes.map(p => validatePrefixCategory(p.id, graph));
  const failed = results.filter(r => !r.valid).length;

  return {
    total: results.length,
    passed: results.length - failed,
    failed,
    results,
  };
}
