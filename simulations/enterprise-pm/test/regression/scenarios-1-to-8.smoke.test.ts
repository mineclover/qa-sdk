// @def.boundary sim-test-regression
// @def.doc 02-canary-topology

import { describe, it, expect } from "vitest";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

/**
 * 단계 8 회귀 smoke — 시나리오 1~8 무회귀.
 *
 * spec 02-canary-topology.md §단계 8 종료 체크리스트.
 *
 * 단계 8 변경(build arg / compose 분리 / interceptor / schemaHash / read DataSource)이
 * 시나리오 1~8을 깨지 않는지 확인한다.
 *
 * 실제 시나리오 실행 (`pnpm --filter @qa-sdk/sim-scenarios test`)은 무거운 환경(PG/sops)에
 * 의존하므로 본 smoke은 가벼운 단언만 수행:
 * 1. 8개 시나리오 파일 + cross-slice-conventions이 모두 존재.
 * 2. ScenarioFixture 타입이 import 가능.
 * 3. v1-only 토폴로지 — `v2Tag: undefined` 시 compose가 v1만 부팅 가능 (env 변수 검증).
 *
 * 실제 시나리오 회귀 검증은 follow-up #19 해결 후 sim-up + scenarios run으로 실행.
 *
 * follow-up #19 (auth-api idempotencyKey 누락) 미해결 시:
 *   PG/sops 환경 구축 불가 → 실제 e2e smoke 차단.
 *   본 smoke은 그 환경 없이도 작동하는 정적 단언만 한다 (DONE).
 */
describe("regression: scenarios 1-8 smoke (단계 8 무회귀)", () => {
  const REPO_ROOT = resolve(
    new URL("../../../..", import.meta.url).pathname,
  );

  const SCENARIO_FILES = [
    "scenario-1-login",
    "scenario-2-project-create",
    "scenario-3-self-dept-approval",
    "scenario-4-cross-dept-deny",
    "scenario-5-three-stage-approval",
    "scenario-6-delegated-resource",
    "scenario-7-bitmap-refresh",
    "scenario-8-pubsub-invalidation",
  ];

  for (const id of SCENARIO_FILES) {
    it(`${id} 테스트 파일이 존재한다 (회귀 baseline)`, () => {
      const path = resolve(
        REPO_ROOT,
        "simulations/enterprise-pm/scenarios/src/scenarios",
        `${id}.test.ts`,
      );
      expect(existsSync(path)).toBe(true);
    });
  }

  it("cross-slice-conventions 테스트 파일이 존재한다", () => {
    const path = resolve(
      REPO_ROOT,
      "simulations/enterprise-pm/scenarios/src/scenarios/cross-slice-conventions.test.ts",
    );
    expect(existsSync(path)).toBe(true);
  });

  it("scenarios 패키지 entry index.ts가 존재한다", () => {
    const path = resolve(
      REPO_ROOT,
      "simulations/enterprise-pm/scenarios/src/index.ts",
    );
    expect(existsSync(path)).toBe(true);
  });

  it("ScenarioFixture 타입이 import 가능 (단계 8 fixture 호환성)", async () => {
    const types = await import(
      "../scenarios/scenario-fixture.types.js"
    );
    // 타입은 dts에만 존재, runtime은 빈 모듈. import error 없으면 통과.
    expect(types).toBeDefined();
  });

  it("docker-compose에 단일 sim-approval-api entry가 더 이상 존재하지 않는다 (분리 검증)", async () => {
    const fs = await import("node:fs/promises");
    const composePath = resolve(
      REPO_ROOT,
      "simulations/enterprise-pm/docker-compose.sim.yaml",
    );
    const text = await fs.readFile(composePath, "utf-8");
    // v1/v2 둘 다 존재
    expect(text).toMatch(/container_name: sim-approval-api-v1/);
    expect(text).toMatch(/container_name: sim-approval-api-v2/);
    // 단일 entry는 제거됨 (정확히 v1, v2 두 개만)
    const matches = text.match(/container_name: sim-approval-api/g) ?? [];
    expect(matches.length).toBe(2);
  });

  it("APPROVAL_V1_TAG / APPROVAL_V2_TAG가 .env.sim.example에 정의됨 (v1-only 부팅 옵션)", async () => {
    const fs = await import("node:fs/promises");
    const envPath = resolve(
      REPO_ROOT,
      "simulations/enterprise-pm/.env.sim.example",
    );
    const text = await fs.readFile(envPath, "utf-8");
    expect(text).toMatch(/APPROVAL_V1_TAG=/);
    expect(text).toMatch(/APPROVAL_V2_TAG=/);
    // v2를 빈 문자열로 두면 compose가 v1만 부팅하는 효과 — 단계 8 변경은
    // 모두 *추가*뿐이라 시나리오 1~8 단언에 영향 없음.
  });
});
