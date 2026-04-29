// @def.boundary sim-test-fixtures
// @def.doc 02-canary-topology

import type { ScenarioFixture } from "./scenario-fixture.types.js";

/**
 * 시나리오 11: v2가 budget 승인 전이 중 manager_review stage skip → audit_anomaly critical.
 *
 * spec 02-canary-topology.md §4.3.
 *
 * v2 use-case가 의도적으로 currentStage를 manager_review를 건너뛰고
 * advance하면 audit-browser-api가 anomaly로 표시한다. 안전 가드 카테고리가
 * weight=0을 강제하므로 v2는 활성화되지 못한다.
 *
 * patch는 budget.use-case.ts의 stage 전이 로직 한 줄을 변경.
 *
 * 기대:
 * - audit_anomaly_count >= 1 (severity=critical)
 * - controller.weight_v2 = 0 (안전 가드 trip)
 * - gateway.upstream = approval-api-v1
 */
export const scenarioAuditAnomaly: ScenarioFixture = {
  id: "11-audit-anomaly",
  v1Tag: "v3",
  v2Tag: "v4-audit-anomaly",
  v2Patch: {
    // manager_review stage(보통 stageNumber=2)를 건너뛰는 패치 — currentStage += 2.
    "simulations/enterprise-pm/services/approval-api/src/approval/budget/application/use-cases/budget.use-case.ts":
      (src) =>
        src.replace(
          /currentStage:\s*entity\.currentStage\s*\+\s*1/,
          "currentStage: entity.currentStage + 2 /* SCENARIO 11: manager_review skip */",
        ),
  },
  expectedAssertions: {
    "audit-browser-api.anomaly_count_critical": { gte: 1 },
    "controller.weight_v2": { eq: 0 },
    "gateway.upstream": { eq: "approval-api-v1" },
  },
};
