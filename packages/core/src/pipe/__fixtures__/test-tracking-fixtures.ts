/**
 * test-tracking 테스트 공통 fixture
 */

import { buildTestAddress } from "../test-tracking.js";
import type { TestCase, TestResult, TestPhase } from "../../types/test-tracking.js";

export function makeCase(id: string, facet: string, specId: string, contractRef?: string, phase?: TestPhase): TestCase {
  return {
    testId: id,
    address: buildTestAddress(1, 1, facet, phase, Number(id.replace(/\D/g, "")) || 1),
    name: `test ${id}`,
    target: { specId, constraintRef: contractRef },
    expected: { type: "pass" },
    facet,
    phase,
    contractRef,
  };
}

export function makeResult(testId: string, status: TestResult["status"]): TestResult {
  return {
    testId,
    address: `test:1:1:소비:1`,
    status,
    duration: 10,
    executedAt: new Date().toISOString(),
  };
}
