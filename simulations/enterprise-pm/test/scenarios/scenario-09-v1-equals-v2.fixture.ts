// @def.boundary sim-test-fixtures
// @def.doc 02-canary-topology

import type { ScenarioFixture } from './scenario-fixture.types.js';

/**
 * 시나리오 9: v2 = v1과 schema/behavior 동일 (no-op canary).
 *
 * spec 02-canary-topology.md §4.3.
 *
 * v2 image는 v1과 동일한 source에서 빌드되며 (`v2Patch` 비어있음),
 * 카나리 사이클은 100% 승격까지 진행된다. 안전 가드가 정상 작동하는지
 * 확인하는 baseline 케이스.
 *
 * 기대:
 * - schemaCompatRate = 1.0 (v1 hash == v2 hash)
 * - audit_anomaly = 0
 * - controller가 weight=1.0까지 진행 (승격 성공)
 */
export const scenarioV1EqualsV2: ScenarioFixture = {
  id: '09-v1-equals-v2',
  v1Tag: 'v3',
  v2Tag: 'v4-stable-clone',
  // v2Patch 의도적으로 비움 — v2 코드가 v1과 동일.
  expectedAssertions: {
    'ingest-server.schema_drift_count': { eq: 0 },
    'controller.schemaCompatRate': { eq: 1.0 },
    'controller.audit_anomaly_count': { eq: 0 },
    'controller.final_weight_v2': { eq: 1.0 },
  },
};
