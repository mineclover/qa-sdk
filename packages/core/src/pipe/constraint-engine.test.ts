// @def.boundary qa-sdk-core-system
// @def.doc qa-sdk-core-system

import { describe, it, expect } from "vitest";
import {
  ConstraintRegistry, evaluatePredicate, executeConstraint,
} from "./constraint-engine.js";
import type { ConstraintDef, ConstraintPredicate } from "../types/constraint.js";

// ── 헬퍼 ─────────────────────────────────────────────

function makeConstraint(
  id: string,
  specId: string,
  op: ConstraintPredicate["op"],
  expected?: unknown,
): ConstraintDef {
  return {
    constraintId: id,
    specId,
    subject: { kind: "schema", ref: "orders" },
    predicate: { op, expected },
    context: { when: "always" },
    evidence: { method: "unit-test", reversible: true },
    severity: "error",
    description: `${id}: ${op} ${expected}`,
  };
}

// ── evaluatePredicate ────────────────────────────────

describe("evaluatePredicate", () => {
  describe("값 비교", () => {
    it("eq", () => {
      expect(evaluatePredicate({ op: "eq", expected: 42 }, 42)).toBe(true);
      expect(evaluatePredicate({ op: "eq", expected: 42 }, 43)).toBe(false);
    });

    it("neq", () => {
      expect(evaluatePredicate({ op: "neq", expected: 42 }, 43)).toBe(true);
    });

    it("gt / gte / lt / lte", () => {
      expect(evaluatePredicate({ op: "gt", expected: 10 }, 15)).toBe(true);
      expect(evaluatePredicate({ op: "gt", expected: 10 }, 10)).toBe(false);
      expect(evaluatePredicate({ op: "gte", expected: 10 }, 10)).toBe(true);
      expect(evaluatePredicate({ op: "lt", expected: 10 }, 5)).toBe(true);
      expect(evaluatePredicate({ op: "lte", expected: 10 }, 10)).toBe(true);
    });
  });

  describe("존재/포함", () => {
    it("exists / not-exists", () => {
      expect(evaluatePredicate({ op: "exists" }, "value")).toBe(true);
      expect(evaluatePredicate({ op: "exists" }, null)).toBe(false);
      expect(evaluatePredicate({ op: "not-exists" }, null)).toBe(true);
      expect(evaluatePredicate({ op: "not-exists" }, undefined)).toBe(true);
    });

    it("contains (배열)", () => {
      expect(evaluatePredicate({ op: "contains", expected: "a" }, ["a", "b"])).toBe(true);
      expect(evaluatePredicate({ op: "contains", expected: "c" }, ["a", "b"])).toBe(false);
    });

    it("contains (문자열)", () => {
      expect(evaluatePredicate({ op: "contains", expected: "bar" }, "foobar")).toBe(true);
    });

    it("not-contains", () => {
      expect(evaluatePredicate({ op: "not-contains", expected: "c" }, ["a", "b"])).toBe(true);
    });

    it("subset-of", () => {
      expect(evaluatePredicate({ op: "subset-of", expected: [1, 2, 3] }, [1, 2])).toBe(true);
      expect(evaluatePredicate({ op: "subset-of", expected: [1, 2] }, [1, 3])).toBe(false);
    });

    it("superset-of", () => {
      expect(evaluatePredicate({ op: "superset-of", expected: [1, 2] }, [1, 2, 3])).toBe(true);
    });
  });

  describe("타입", () => {
    it("type-is", () => {
      expect(evaluatePredicate({ op: "type-is", expected: "string" }, "hello")).toBe(true);
      expect(evaluatePredicate({ op: "type-is", expected: "number" }, "hello")).toBe(false);
    });
  });

  describe("논리 조합", () => {
    it("and", () => {
      expect(evaluatePredicate({
        op: "and",
        children: [
          { op: "gt", expected: 0 },
          { op: "lt", expected: 100 },
        ],
      }, 50)).toBe(true);

      expect(evaluatePredicate({
        op: "and",
        children: [
          { op: "gt", expected: 0 },
          { op: "lt", expected: 100 },
        ],
      }, 150)).toBe(false);
    });

    it("or", () => {
      expect(evaluatePredicate({
        op: "or",
        children: [
          { op: "eq", expected: "A" },
          { op: "eq", expected: "B" },
        ],
      }, "B")).toBe(true);
    });

    it("not", () => {
      expect(evaluatePredicate({
        op: "not",
        children: [{ op: "eq", expected: 0 }],
      }, 5)).toBe(true);
    });

    it("중첩: and(gt(0), or(eq(10), eq(20)))", () => {
      expect(evaluatePredicate({
        op: "and",
        children: [
          { op: "gt", expected: 0 },
          { op: "or", children: [
            { op: "eq", expected: 10 },
            { op: "eq", expected: 20 },
          ]},
        ],
      }, 20)).toBe(true);

      expect(evaluatePredicate({
        op: "and",
        children: [
          { op: "gt", expected: 0 },
          { op: "or", children: [
            { op: "eq", expected: 10 },
            { op: "eq", expected: 20 },
          ]},
        ],
      }, 15)).toBe(false);
    });
  });
});

// ── executeConstraint ────────────────────────────────

describe("executeConstraint", () => {
  it("통과 시 verdict: pass", () => {
    const c = makeConstraint("c1", "spec1", "eq", 42);
    const result = executeConstraint(c, 42);
    expect(result.verdict).toBe("pass");
    expect(result.failureTrace).toBeUndefined();
  });

  it("실패 시 verdict: fail + failureTrace", () => {
    const c = makeConstraint("c1", "spec1", "eq", 42);
    const result = executeConstraint(c, 99);
    expect(result.verdict).toBe("fail");
    expect(result.failureTrace).toBeDefined();
    expect(result.failureTrace!.subject.ref).toBe("orders");
    expect(result.failureTrace!.predicate.op).toBe("eq");
    expect(result.actualValue).toBe(99);
    expect(result.expectedValue).toBe(42);
  });

  it("실패 trace에 hint 포함", () => {
    const c = makeConstraint("c1", "spec1", "gt", 100);
    const result = executeConstraint(c, 50);
    expect(result.failureTrace!.hint).toContain("gt");
  });
});

// ── ConstraintRegistry ───────────────────────────────

describe("ConstraintRegistry", () => {
  it("등록 + 조회", () => {
    const reg = new ConstraintRegistry();
    reg.register(makeConstraint("c1", "spec1", "eq", 42));
    expect(reg.get("c1")).not.toBeNull();
    expect(reg.get("c1")!.constraintId).toBe("c1");
  });

  it("스펙별 조회", () => {
    const reg = new ConstraintRegistry();
    reg.register(makeConstraint("c1", "spec1", "eq", 1));
    reg.register(makeConstraint("c2", "spec1", "gt", 0));
    reg.register(makeConstraint("c3", "spec2", "exists"));
    expect(reg.getBySpec("spec1")).toHaveLength(2);
    expect(reg.getBySpec("spec2")).toHaveLength(1);
  });

  it("결과 기록 + 조회", () => {
    const reg = new ConstraintRegistry();
    const c = makeConstraint("c1", "spec1", "eq", 42);
    reg.register(c);

    const result = executeConstraint(c, 42);
    reg.recordResult(result);

    expect(reg.getLatestResult("c1")).not.toBeNull();
    expect(reg.getLatestResult("c1")!.verdict).toBe("pass");
  });

  it("실패 결과 필터링", () => {
    const reg = new ConstraintRegistry();
    const c1 = makeConstraint("c1", "spec1", "eq", 42);
    const c2 = makeConstraint("c2", "spec1", "eq", 99);
    reg.register(c1);
    reg.register(c2);

    reg.recordResult(executeConstraint(c1, 42)); // pass
    reg.recordResult(executeConstraint(c2, 0));  // fail

    expect(reg.getFailures()).toHaveLength(1);
    expect(reg.getFailures()[0].constraintId).toBe("c2");
  });

  it("스펙별 검증 현황", () => {
    const reg = new ConstraintRegistry();
    reg.register(makeConstraint("c1", "spec1", "eq", 1));
    reg.register(makeConstraint("c2", "spec1", "eq", 2));
    reg.register(makeConstraint("c3", "spec1", "eq", 3));

    reg.recordResult(executeConstraint(reg.get("c1")!, 1)); // pass
    reg.recordResult(executeConstraint(reg.get("c2")!, 0)); // fail
    // c3: 미실행

    const status = reg.getSpecVerificationStatus("spec1");
    expect(status.total).toBe(3);
    expect(status.verified).toBe(1);
    expect(status.failed).toBe(1);
    expect(status.untested).toBe(1);
    expect(status.verificationRate).toBe(33);
  });

  it("시스템 전체 현황", () => {
    const reg = new ConstraintRegistry();
    reg.register(makeConstraint("c1", "spec1", "eq", 1));
    reg.register(makeConstraint("c2", "spec2", "eq", 2));

    reg.recordResult(executeConstraint(reg.get("c1")!, 1));
    reg.recordResult(executeConstraint(reg.get("c2")!, 2));

    const status = reg.getSystemStatus();
    expect(status.totalConstraints).toBe(2);
    expect(status.totalVerified).toBe(2);
    expect(status.overallRate).toBe(100);
  });
});

// ── 실전 시나리오 ────────────────────────────────────

describe("실전: 데이터 계약 constraint 검증 루프", () => {
  it("스키마 호환 constraint 정의 → 실행 → 오류 추적", () => {
    const reg = new ConstraintRegistry();

    // constraint 정의: "소비자 필수 필드는 생산자에 반드시 존재"
    const compatConstraint: ConstraintDef = {
      constraintId: "compat-required-fields",
      specId: "data-contract",
      subject: { kind: "contract", ref: "order-payment-contract" },
      predicate: { op: "superset-of", expected: ["id", "amount", "status"] },
      context: { when: "on-schema-change" },
      evidence: {
        method: "contract-test",
        testAddresses: ["test:1:3:소비:2"],
        reversible: true,
      },
      severity: "critical",
      description: "결제 서비스가 기대하는 필드(id, amount, status)가 주문 스키마에 존재해야 함",
    };

    reg.register(compatConstraint);

    // 시나리오 1: 정상 — 생산자가 모든 필드 포함
    const result1 = executeConstraint(compatConstraint, ["id", "amount", "status", "created_at"]);
    reg.recordResult(result1);
    expect(result1.verdict).toBe("pass");

    // 시나리오 2: 실패 — status 필드 제거 (breaking change)
    const result2 = executeConstraint(compatConstraint, ["id", "amount"]);
    reg.recordResult(result2);
    expect(result2.verdict).toBe("fail");

    // 오류 추적
    expect(result2.failureTrace).toBeDefined();
    expect(result2.failureTrace!.subject.ref).toBe("order-payment-contract");
    expect(result2.failureTrace!.predicate.op).toBe("superset-of");
    expect(result2.failureTrace!.context.when).toBe("on-schema-change");

    // 검증 현황
    const status = reg.getSpecVerificationStatus("data-contract");
    expect(status.total).toBe(1);
    // 마지막 결과가 fail
    expect(reg.getLatestResult("compat-required-fields")!.verdict).toBe("fail");
  });
});
