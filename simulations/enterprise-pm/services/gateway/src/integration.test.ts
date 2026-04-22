// @def.boundary sim-gateway
// @def.doc authorization-ontology-bitmap-pipeline

/**
 * sim-gateway ↔ sim-auth-api 통합 — login 흐름 e2e 검증.
 *
 * 본 테스트는 Plan 11a의 `bootstrapTestAuthApi` 헬퍼를 요구하며,
 * 현재 해당 헬퍼는 미존재. Plan 11a 후속 보강 시 활성화 예정.
 * SIM_GATEWAY_INTEGRATION=1 env 시에만 실행.
 */

import { describe, it } from "vitest";

const SKIP = process.env.SIM_GATEWAY_INTEGRATION !== "1";

describe.skipIf(SKIP)("sim-gateway integration — 실 sim-auth-api", () => {
  it("bootstrapTestAuthApi 헬퍼 미존재 — Plan 11a 보강 대기", () => {
    // TODO(Plan 11a): bootstrapTestAuthApi export 후 본 스텁을 실제 e2e로 교체.
    // 관련 경로: @qa-sdk/sim-auth-api/test-bootstrap
  });
});
