/**
 * activation-gate — 활성화 전 DKG constraint/domain-health 검사.
 *
 * registry-service가 이 순수 함수를 소비하여 활성화 게이트를 구현한다.
 */

import type { GraphPort } from "../shared/graph-port.js";
import { checkConstraints } from "../dkg/skills/constraint-check.js";
import { validatePrefixCategory } from "../schema/category-rules.js";

export interface ActivationDiagnostic {
  readonly level: "error" | "warning" | "info";
  readonly source: "constraint" | "domain-health" | "observation" | "schema";
  readonly id: string;
  readonly message: string;
}

export interface ActivationGateResult {
  readonly allowed: boolean;
  readonly diagnostics: readonly ActivationDiagnostic[];
  readonly constraintViolations: number;
}

/**
 * prefix 활성화 전 DKG constraint + observation 검사.
 *
 * mode:
 * - "strict": constraint violation이 있으면 allowed=false
 * - "warn": 항상 allowed=true (진단만 반환)
 */
export function checkActivationReadiness(
  graph: GraphPort,
  prefixId: string,
  options?: { mode?: "strict" | "warn"; schemaCheck?: boolean },
): ActivationGateResult {
  const mode = options?.mode ?? "warn";
  const diagnostics: ActivationDiagnostic[] = [];

  // 1. Constraint check for this prefix
  const constraintResult = checkConstraints(graph, prefixId);
  for (const v of constraintResult.violations) {
    diagnostics.push({
      level: v.severity ?? "warning",
      source: "constraint",
      id: v.constraintId,
      message: `Constraint violated: ${v.rule}`,
    });
  }

  // 2. Check unresolved critical observations on this prefix
  const obsEdges = graph.edgesTo(prefixId, "observes");
  for (const edge of obsEdges) {
    const obs = graph.getNode(edge.from) as any;
    if (!obs || obs.kind !== "observation") continue;
    if (obs.resolution) continue; // already resolved

    // Only report action-needed observations
    const intent: string = obs.intent
      ?? (obs.source === "metric" ? "action-needed"
        : (obs.suggestion ? "action-needed" : "monitoring"));
    if (intent !== "action-needed") continue;

    diagnostics.push({
      level: "warning",
      source: "observation",
      id: obs.id,
      message: `Unresolved observation: ${obs.finding}`,
    });
  }

  // 3. Find which domain this prefix belongs to, check domain health
  const domainEdges = graph.edgesTo(prefixId, "contains");
  for (const edge of domainEdges) {
    const domain = graph.getNode(edge.from) as any;
    if (!domain || domain.kind !== "domain") continue;

    // Check constraints on the domain itself
    const domainConstraints = checkConstraints(graph, domain.id);
    for (const v of domainConstraints.violations) {
      diagnostics.push({
        level: "warning",
        source: "domain-health",
        id: v.constraintId,
        message: `Domain ${domain.id} constraint violated: ${v.rule}`,
      });
    }
  }

  // 4. Schema category validation (opt-in, fail-open)
  if (options?.schemaCheck) {
    try {
      const schemaResult = validatePrefixCategory(prefixId, graph);
      if (!schemaResult.valid) {
        for (const err of schemaResult.errors) {
          diagnostics.push({
            level: "warning",
            source: "schema",
            id: `schema-${prefixId}`,
            message: `Schema category violation: ${err}`,
          });
        }
      }
    } catch {
      // fail-open: schema 검증 실패 시 무시
    }
  }

  const constraintViolations = diagnostics.filter(
    d => d.source === "constraint" && d.level === "error",
  ).length;

  const allowed = mode === "warn" || constraintViolations === 0;

  return { allowed, diagnostics, constraintViolations };
}
