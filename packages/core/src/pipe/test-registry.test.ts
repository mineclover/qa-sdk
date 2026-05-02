// @def.boundary qa-sdk-core-system
// @def.doc qa-sdk-core-system

/**
 * TestRegistry — 케이스/스위트/결과 관리 + 전체 현황
 */

import { describe, it, expect } from "vitest";
import { TestRegistry } from "./test-tracking.js";
import type { TestSuite } from "../types/test-tracking.js";
import { makeCase, makeResult } from "./__fixtures__/test-tracking-fixtures.js";

describe("TestRegistry", () => {
  describe("케이스 관리", () => {
    it("등록 + 조회", () => {
      const reg = new TestRegistry();
      reg.registerCase(makeCase("t1", "소비", "spec1"));
      expect(reg.getCase("t1")).not.toBeNull();
      expect(reg.getCase("t1")!.facet).toBe("소비");
    });

    it("스펙별 조회", () => {
      const reg = new TestRegistry();
      reg.registerCase(makeCase("t1", "소비", "spec1"));
      reg.registerCase(makeCase("t2", "관리", "spec1"));
      reg.registerCase(makeCase("t3", "소비", "spec2"));
      expect(reg.getCasesBySpec("spec1")).toHaveLength(2);
      expect(reg.getCasesBySpec("spec2")).toHaveLength(1);
    });

    it("패싯별 조회", () => {
      const reg = new TestRegistry();
      reg.registerCase(makeCase("t1", "소비", "s1"));
      reg.registerCase(makeCase("t2", "소비", "s2"));
      reg.registerCase(makeCase("t3", "관리", "s1"));
      expect(reg.getCasesByFacet("소비")).toHaveLength(2);
    });

    it("단계별 조회", () => {
      const reg = new TestRegistry();
      reg.registerCase(makeCase("t1", "소비", "s1", undefined, "arrange"));
      reg.registerCase(makeCase("t2", "소비", "s1", undefined, "arrange"));
      reg.registerCase(makeCase("t3", "소비", "s1", undefined, "assert-primary"));
      reg.registerCase(makeCase("t4", "관리", "s1"));
      expect(reg.getCasesByPhase("arrange")).toHaveLength(2);
      expect(reg.getCasesByPhase("assert-primary")).toHaveLength(1);
      expect(reg.getCasesByPhase("teardown")).toHaveLength(0);
    });
  });

  describe("스위트 관리", () => {
    it("스위트 등록 → 내부 케이스 자동 등록", () => {
      const reg = new TestRegistry();
      const suite: TestSuite = {
        suiteId: "s1",
        facet: "소비",
        cases: [makeCase("t1", "소비", "spec1"), makeCase("t2", "소비", "spec1")],
      };
      reg.registerSuite(suite);
      expect(reg.getSuite("s1")).not.toBeNull();
      expect(reg.listCases()).toHaveLength(2);
    });

    it("패싯별 스위트 조회", () => {
      const reg = new TestRegistry();
      reg.registerSuite({ suiteId: "s1", facet: "소비", cases: [makeCase("t1", "소비", "s")] });
      reg.registerSuite({ suiteId: "s2", facet: "관리", cases: [makeCase("t2", "관리", "s")] });
      reg.registerSuite({ suiteId: "s3", facet: "소비", cases: [makeCase("t3", "소비", "s")] });
      expect(reg.getSuitesByFacet("소비")).toHaveLength(2);
    });

    it("단계별 스위트 조회 — phases 선언", () => {
      const reg = new TestRegistry();
      reg.registerSuite({ suiteId: "s1", facet: "소비", phases: ["arrange", "act"], cases: [makeCase("t1", "소비", "s")] });
      reg.registerSuite({ suiteId: "s2", facet: "관리", cases: [makeCase("t2", "관리", "s", undefined, "assert-primary")] });
      expect(reg.getSuitesByPhase("arrange")).toHaveLength(1);
      expect(reg.getSuitesByPhase("assert-primary")).toHaveLength(1);
      expect(reg.getSuitesByPhase("teardown")).toHaveLength(0);
    });
  });

  describe("결과 수집", () => {
    it("결과 기록 + 최신 조회", () => {
      const reg = new TestRegistry();
      reg.registerCase(makeCase("t1", "소비", "s1"));
      reg.recordResult(makeResult("t1", "fail"));
      reg.recordResult(makeResult("t1", "pass"));
      expect(reg.getLatestResult("t1")?.status).toBe("pass");
    });

    it("실패 목록 (최신 결과 기준)", () => {
      const reg = new TestRegistry();
      reg.registerCase(makeCase("t1", "소비", "s1"));
      reg.registerCase(makeCase("t2", "관리", "s1"));
      reg.recordResult(makeResult("t1", "pass"));
      reg.recordResult(makeResult("t2", "fail"));
      expect(reg.getFailures()).toHaveLength(1);
      expect(reg.getFailures()[0].testId).toBe("t2");
    });
  });

  describe("전체 현황", () => {
    it("종합 현황", () => {
      const reg = new TestRegistry();
      reg.registerSuite({ suiteId: "s1", facet: "소비", cases: [
        makeCase("t1", "소비", "s1"),
        makeCase("t2", "소비", "s1"),
      ]});
      reg.registerSuite({ suiteId: "s2", facet: "관리", cases: [
        makeCase("t3", "관리", "s1"),
      ]});
      reg.recordResult(makeResult("t1", "pass"));
      reg.recordResult(makeResult("t2", "pass"));
      reg.recordResult(makeResult("t3", "fail"));

      const status = reg.getOverallStatus();
      expect(status.totalCases).toBe(3);
      expect(status.totalSuites).toBe(2);
      expect(status.passRate).toBe(67);
      expect(status.failures).toBe(1);
    });
  });
});
