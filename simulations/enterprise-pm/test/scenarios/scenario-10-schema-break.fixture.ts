// @def.boundary sim-test-fixtures
// @def.doc 02-canary-topology

import type { ScenarioFixture } from "./scenario-fixture.types.js";

/**
 * 시나리오 10: v2 outbox payloadShape 변경 → schemaHash drift → 자동 롤백.
 *
 * spec 02-canary-topology.md §4.3.
 *
 * v2 코드가 BUDGET_PAYLOAD_SHAPE에 `escalationLevel: "number"` 필드를 추가하면
 * grammar #6 buildSchemaHash 결과가 v1과 달라진다 →
 * ingest-server가 schema_drift 진단 → controller가 v2 가중치를 0으로 강제.
 *
 * 기대:
 * - ingest-server.schema_drift_count >= 1
 * - controller.schemaCompatRate < 1.0
 * - controller.weight (v2) = 0 (안전 가드)
 * - gateway.upstream = approval-api-v1 (전부 v1로 라우팅)
 */
export const scenarioSchemaBreak: ScenarioFixture = {
  id: "10-schema-break",
  v1Tag: "v3",
  v2Tag: "v4-schema-break",
  v2Patch: {
    "simulations/enterprise-pm/services/approval-api/src/approval/budget/infrastructure/outbox/budget.outbox.ts":
      (src) =>
        src.replace(
          /totalStages: "number",/,
          'totalStages: "number",\n  escalationLevel: "number",',
        ),
  },
  expectedAssertions: {
    "ingest-server.schema_drift_count": { gte: 1 },
    "controller.schemaCompatRate": { lt: 1.0 },
    "controller.weight_v2": { eq: 0 },
    "gateway.upstream": { eq: "approval-api-v1" },
  },
};
