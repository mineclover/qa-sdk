import { describe, it, expect } from "vitest";
import {
  matchRules,
  resolvePolicy,
  detectConflicts,
  type PolicyRule,
} from "index-meta";
import { AXIS } from "demo-snapshot";

// shape = [8, 4, 16]  (role × action × resource)
const SHAPE = [AXIS.role.capacity!, AXIS.action.capacity!, AXIS.resource.capacity!] as const;

// ── matchRules ───────────────────────────────────────────────────────────────

describe("matchRules", () => {
  const rules: PolicyRule<string>[] = [
    { id: "R1", pattern: [null, null, null], value: "deny" },
    { id: "R2", pattern: ["1", null, null], value: "allow" },
    { id: "R3", pattern: [null, "4", null], value: "deny" },
    { id: "R4", pattern: ["1", "4", null], value: "allow" },
  ];

  it("coord=[1,4,7] → R4, R2, R3, R1 (구체성 순)", () => {
    const matched = matchRules([1, 4, 7], rules, SHAPE);
    expect(matched.map((r) => r.id)).toEqual(["R4", "R2", "R3", "R1"]);
  });

  it("coord=[2,1,1] → R1만 매칭 (R2,R3,R4 비매칭)", () => {
    const matched = matchRules([2, 1, 1], rules, SHAPE);
    expect(matched.map((r) => r.id)).toEqual(["R1"]);
  });

  it("coord=[1,2,5] → R2, R1 매칭 (R3,R4 비매칭)", () => {
    const matched = matchRules([1, 2, 5], rules, SHAPE);
    expect(matched.map((r) => r.id)).toEqual(["R2", "R1"]);
  });

  it("매칭 규칙 없으면 빈 배열", () => {
    const narrowRules: PolicyRule<string>[] = [
      { id: "X", pattern: ["1", "1", "1"], value: "x" },
    ];
    const matched = matchRules([2, 2, 2], narrowRules, SHAPE);
    expect(matched).toEqual([]);
  });
});

// ── resolvePolicy ────────────────────────────────────────────────────────────

describe("resolvePolicy", () => {
  const rules: PolicyRule<string>[] = [
    { id: "R1", pattern: [null, null, null], value: "deny", priority: 1 },
    { id: "R2", pattern: ["1", null, null], value: "allow", priority: 10 },
    { id: "R3", pattern: [null, "4", null], value: "deny", priority: 5 },
    { id: "R4", pattern: ["1", "4", null], value: "allow", priority: 20 },
  ];

  describe("most-specific", () => {
    it("가장 구체적인 패턴 승리", () => {
      const result = resolvePolicy([1, 4, 7], rules, SHAPE, "most-specific");
      expect(result!.value).toBe("allow"); // R4
    });

    it("와일드카드만 매칭되면 기본 규칙", () => {
      const result = resolvePolicy([2, 1, 1], rules, SHAPE, "most-specific");
      expect(result!.value).toBe("deny"); // R1
    });
  });

  describe("priority", () => {
    it("priority가 가장 높은 규칙 승리", () => {
      const result = resolvePolicy([1, 4, 7], rules, SHAPE, "priority");
      expect(result!.value).toBe("allow"); // R4 (priority=20)
    });

    it("priority 동점이면 먼저 나온 규칙", () => {
      const samePriority: PolicyRule<string>[] = [
        { id: "A", pattern: [null, null, null], value: "first", priority: 5 },
        { id: "B", pattern: [null, null, null], value: "second", priority: 5 },
      ];
      const result = resolvePolicy([1, 1, 1], samePriority, SHAPE, "priority");
      expect(result!.value).toBe("first");
    });
  });

  describe("collect", () => {
    it("매칭되는 모든 값 수집", () => {
      const result = resolvePolicy([1, 4, 7], rules, SHAPE, "collect");
      expect(result!.value).toEqual(["allow", "allow", "deny", "deny"]);
    });
  });

  describe("first-match", () => {
    it("입력 순서 기준 첫 매칭", () => {
      const result = resolvePolicy([1, 4, 7], rules, SHAPE, "first-match");
      expect(result!.value).toBe("deny"); // R1 (입력 순서 첫 번째)
    });
  });

  it("매칭 규칙 없으면 null", () => {
    const narrowRules: PolicyRule<string>[] = [
      { id: "X", pattern: ["1", "1", "1"], value: "x" },
    ];
    expect(resolvePolicy([2, 2, 2], narrowRules, SHAPE, "most-specific")).toBeNull();
  });
});

// ── detectConflicts ──────────────────────────────────────────────────────────

describe("detectConflicts", () => {
  it("겹치는 영역에서 다른 값 → 충돌 탐지", () => {
    const rules: PolicyRule<string>[] = [
      { id: "R1", pattern: [null, "2", null], value: "allow" },
      { id: "R2", pattern: ["3", null, null], value: "deny" },
    ];
    const conflicts = detectConflicts(rules, SHAPE);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].overlapPattern).toEqual(["3", "2", null]);
    expect(conflicts[0].conflictingRules.map((r) => r.id)).toEqual(["R1", "R2"]);
  });

  it("겹치는 영역에서 같은 값 → 충돌 아님", () => {
    const rules: PolicyRule<string>[] = [
      { id: "R1", pattern: [null, "2", null], value: "allow" },
      { id: "R2", pattern: ["3", null, null], value: "allow" },
    ];
    expect(detectConflicts(rules, SHAPE)).toHaveLength(0);
  });

  it("겹치지 않는 규칙 → 충돌 없음", () => {
    const rules: PolicyRule<string>[] = [
      { id: "R1", pattern: ["1-3", null, null], value: "allow" },
      { id: "R2", pattern: ["5-8", null, null], value: "deny" },
    ];
    expect(detectConflicts(rules, SHAPE)).toHaveLength(0);
  });

  it("여러 충돌 쌍 탐지", () => {
    const rules: PolicyRule<string>[] = [
      { id: "R1", pattern: [null, null, null], value: "deny" },
      { id: "R2", pattern: ["1", null, null], value: "allow" },
      { id: "R3", pattern: [null, "4", null], value: "block" },
    ];
    // R1 vs R2: 겹침 = ["1", null, null], deny vs allow → 충돌
    // R1 vs R3: 겹침 = [null, "4", null], deny vs block → 충돌
    // R2 vs R3: 겹침 = ["1", "4", null], allow vs block → 충돌
    const conflicts = detectConflicts(rules, SHAPE);
    expect(conflicts).toHaveLength(3);
  });

  it("커스텀 eq 함수 사용", () => {
    interface RateLimit { limit: number; window: number }
    const rules: PolicyRule<RateLimit>[] = [
      { id: "R1", pattern: [null, "2", null], value: { limit: 100, window: 60 } },
      { id: "R2", pattern: ["3", null, null], value: { limit: 100, window: 60 } },
    ];
    // 기본 === 비교면 object reference가 다르므로 충돌로 감지
    expect(detectConflicts(rules, SHAPE)).toHaveLength(1);
    // 커스텀 eq로 값 비교
    const withEq = detectConflicts(rules, SHAPE, (a, b) => a.limit === b.limit && a.window === b.window);
    expect(withEq).toHaveLength(0);
  });

  it("빈 규칙 → 충돌 없음", () => {
    expect(detectConflicts([], SHAPE)).toHaveLength(0);
  });
});

// ── 통합 시나리오: RBAC ──────────────────────────────────────────────────────

describe("RBAC scenario", () => {
  // UC-1 from spec: RBAC 권한 평가
  const rules: PolicyRule<string>[] = [
    { id: "default", pattern: [null, null, null], value: "deny" },
    { id: "admin-all", pattern: ["1", null, null], value: "allow" },
    { id: "no-delete", pattern: [null, "4", null], value: "deny" },
    { id: "admin-delete", pattern: ["1", "4", null], value: "allow" },
  ];

  it("admin + delete → allow (admin-delete가 가장 구체적)", () => {
    const result = resolvePolicy([1, 4, 7], rules, SHAPE, "most-specific");
    expect(result!.value).toBe("allow");
  });

  it("admin + read → allow", () => {
    const result = resolvePolicy([1, 2, 5], rules, SHAPE, "most-specific");
    expect(result!.value).toBe("allow");
  });

  it("editor + delete → deny", () => {
    const result = resolvePolicy([3, 4, 10], rules, SHAPE, "most-specific");
    expect(result!.value).toBe("deny");
  });

  it("editor + read → deny (기본 규칙)", () => {
    const result = resolvePolicy([3, 2, 10], rules, SHAPE, "most-specific");
    expect(result!.value).toBe("deny");
  });

  it("충돌 탐지: admin-all vs no-delete", () => {
    const conflicts = detectConflicts(rules, SHAPE);
    // default vs admin-all, default vs no-delete, admin-all vs no-delete,
    // default vs admin-delete, admin-all vs admin-delete는 같은 값이므로 제외... no
    // actually: default(deny) vs admin-all(allow) → conflict
    //           default(deny) vs admin-delete(allow) → conflict
    //           admin-all(allow) vs no-delete(deny) → conflict
    // no-delete(deny) vs default(deny) → same value, no conflict
    // admin-all(allow) vs admin-delete(allow) → same value, no conflict
    // no-delete(deny) vs admin-delete(allow) → conflict
    const conflictPairs = conflicts.map((c) =>
      c.conflictingRules.map((r) => r.id).sort().join(","),
    );
    expect(conflictPairs).toContain("admin-all,default");
    expect(conflictPairs).toContain("admin-all,no-delete");
    expect(conflictPairs).toContain("admin-delete,default");
    expect(conflictPairs).toContain("admin-delete,no-delete");
    // same value pairs should not be detected
    expect(conflictPairs).not.toContain("default,no-delete");
    expect(conflictPairs).not.toContain("admin-all,admin-delete");
  });
});
