/**
 * 상태 전이 검증 — state-transition.spec.md 기준
 *
 * 전이 6종 + 불변량 3종 + provider-stack 순서 제약 4종
 */

import { describe, it, expect } from "vitest";
import {
  transition, isViolation, verifyInvariants,
  type PlaybookStatus, type TransitionTrigger,
} from "./scope-nesting-state.js";
import {
  validateScopeNesting,
  type ScopeNesting,
} from "./scope-nesting.js";

// ── 전이 6종 ─────────────────────────────────────────

describe("상태 전이 6종 — state-transition.spec.md", () => {
  it("draft 변경 (idle) → editing", () => {
    const result = transition("idle", "draft-change");
    expect(isViolation(result)).toBe(false);
    if (!isViolation(result)) {
      expect(result.next).toBe("editing");
    }
  });

  it("draft 변경 (error) → editing, 부수효과 없음", () => {
    const result = transition("error", "draft-change");
    expect(isViolation(result)).toBe(false);
    if (!isViolation(result)) {
      expect(result.next).toBe("editing");
      expect(result.sideEffects).toHaveLength(0);
    }
  });

  it("draft 변경 (invalid) → editing, 부수효과 없음", () => {
    const result = transition("invalid", "draft-change");
    expect(isViolation(result)).toBe(false);
    if (!isViolation(result)) {
      expect(result.next).toBe("editing");
      expect(result.sideEffects).toHaveLength(0);
    }
  });

  it("draft 변경 (editing) → editing, 멱등", () => {
    const result = transition("editing", "draft-change");
    expect(isViolation(result)).toBe(false);
    if (!isViolation(result)) {
      expect(result.next).toBe("editing");
    }
  });

  it("invalid submit → invalid + focus first invalid", () => {
    const result = transition("editing", "invalid-submit");
    expect(isViolation(result)).toBe(false);
    if (!isViolation(result)) {
      expect(result.next).toBe("invalid");
      expect(result.sideEffects).toContain("update-validation-issues");
      expect(result.sideEffects).toContain("focus-first-invalid");
    }
  });

  it("valid submit → submitting + 버튼 비활성화", () => {
    const result = transition("editing", "valid-submit");
    expect(isViolation(result)).toBe(false);
    if (!isViolation(result)) {
      expect(result.next).toBe("submitting");
      expect(result.sideEffects).toContain("disable-submit-button");
    }
  });

  it("submit 성공 → success + result/timestamp 갱신", () => {
    const result = transition("submitting", "submit-success");
    expect(isViolation(result)).toBe(false);
    if (!isViolation(result)) {
      expect(result.next).toBe("success");
      expect(result.sideEffects).toContain("update-result");
      expect(result.sideEffects).toContain("update-last-submitted");
    }
  });

  it("submit 실패 → error + submissionError 갱신", () => {
    const result = transition("submitting", "submit-failure");
    expect(isViolation(result)).toBe(false);
    if (!isViolation(result)) {
      expect(result.next).toBe("error");
      expect(result.sideEffects).toContain("update-submission-error");
    }
  });

  it("reset → idle + baseline 복원", () => {
    const result = transition("success", "reset");
    expect(isViolation(result)).toBe(false);
    if (!isViolation(result)) {
      expect(result.next).toBe("idle");
      expect(result.sideEffects).toContain("reset-all-to-baseline");
    }
  });
});

// ── 불변량 3종 ───────────────────────────────────────

describe("불변량 3종 — state-transition.spec.md", () => {
  it("submitting에서 draft 변경 불가", () => {
    const result = transition("submitting", "draft-change");
    expect(isViolation(result)).toBe(true);
  });

  it("success → draft 변경 시 editing 복귀 + stale result 제거", () => {
    const result = transition("success", "draft-change");
    expect(isViolation(result)).toBe(false);
    if (!isViolation(result)) {
      expect(result.next).toBe("editing");
      expect(result.sideEffects).toContain("clear-stale-result");
    }
  });

  it("어떤 상태에서든 reset → idle", () => {
    const allStatuses: PlaybookStatus[] = [
      "idle", "editing", "invalid", "submitting", "success", "error",
    ];
    for (const status of allStatuses) {
      const result = transition(status, "reset");
      expect(isViolation(result)).toBe(false);
      if (!isViolation(result)) {
        expect(result.next).toBe("idle");
      }
    }
  });

  it("verifyInvariants — 위반 0건, valid: true", () => {
    const result = verifyInvariants();
    expect(result.valid).toBe(true);
    expect(result.violations).toHaveLength(0);
  });
});

// ── provider-stack 순서 제약 4종 (명시적 검증) ────────

describe("provider-stack 순서 제약 4종 — provider-stack.spec.md", () => {
  /** 정상 nesting */
  const fullNesting: ScopeNesting = {
    nestingId: "playbook-full",
    scopes: [
      {
        scopeId: "qa-bridge",
        provides: [{ contractId: "logging-session", type: "logging" }],
        consumes: [],
      },
      {
        scopeId: "feature-context",
        provides: [
          { contractId: "playbook-state", type: "state" },
          { contractId: "persist-adapter", type: "persist" },
        ],
        consumes: [{ contractId: "logging-session", type: "logging" }],
      },
      {
        scopeId: "handlers",
        provides: [{ contractId: "submission-handlers", type: "adapter" }],
        consumes: [
          { contractId: "playbook-state", type: "state" },
          { contractId: "logging-session", type: "logging" },
        ],
      },
      {
        scopeId: "view",
        provides: [],
        consumes: [
          { contractId: "playbook-state", type: "state" },
          { contractId: "submission-handlers", type: "adapter" },
        ],
      },
    ],
  };

  it("제약 1: qa-bridge 없으면 handler가 logging 불가", () => {
    // qa-bridge 제거
    const withoutBridge: ScopeNesting = {
      ...fullNesting,
      scopes: fullNesting.scopes.filter(s => s.scopeId !== "qa-bridge"),
    };
    const result = validateScopeNesting(withoutBridge);
    expect(result.valid).toBe(false);
    // feature-context, handlers 모두 logging-session 소비 불가
    const loggingErrors = result.issues.filter(
      i => i.code === "missing-provider" && i.contractId === "logging-session",
    );
    expect(loggingErrors.length).toBeGreaterThanOrEqual(2);
  });

  it("제약 2: feature-context 없으면 handler/view가 state 공유 불가", () => {
    // feature-context 제거
    const withoutContext: ScopeNesting = {
      ...fullNesting,
      scopes: fullNesting.scopes.filter(s => s.scopeId !== "feature-context"),
    };
    const result = validateScopeNesting(withoutContext);
    expect(result.valid).toBe(false);
    // handlers, view 모두 playbook-state 소비 불가
    const stateErrors = result.issues.filter(
      i => i.code === "missing-provider" && i.contractId === "playbook-state",
    );
    expect(stateErrors.length).toBeGreaterThanOrEqual(2);
    expect(stateErrors.some(e => e.scopeId === "handlers")).toBe(true);
    expect(stateErrors.some(e => e.scopeId === "view")).toBe(true);
  });

  it("제약 3: handler binding은 context 이후여야 함", () => {
    // handlers를 feature-context 앞으로 이동
    const wrongOrder: ScopeNesting = {
      ...fullNesting,
      scopes: [
        fullNesting.scopes[0], // qa-bridge
        fullNesting.scopes[2], // handlers (앞으로)
        fullNesting.scopes[1], // feature-context (뒤로)
        fullNesting.scopes[3], // view
      ],
    };
    const result = validateScopeNesting(wrongOrder);
    expect(result.valid).toBe(false);
    // handlers가 playbook-state를 소비하는데 feature-context가 뒤에 있음
    const orderError = result.issues.find(
      i => i.scopeId === "handlers" && i.contractId === "playbook-state",
    );
    expect(orderError).toBeDefined();
  });

  it("제약 4: view는 가장 마지막이어야 함", () => {
    // view를 handlers 앞으로 이동
    const wrongOrder: ScopeNesting = {
      ...fullNesting,
      scopes: [
        fullNesting.scopes[0], // qa-bridge
        fullNesting.scopes[1], // feature-context
        fullNesting.scopes[3], // view (앞으로)
        fullNesting.scopes[2], // handlers (뒤로)
      ],
    };
    const result = validateScopeNesting(wrongOrder);
    expect(result.valid).toBe(false);
    // view가 submission-handlers를 소비하는데 handlers가 뒤에 있음
    const viewError = result.issues.find(
      i => i.scopeId === "view" && i.contractId === "submission-handlers",
    );
    expect(viewError).toBeDefined();
  });
});

// ── boundary↔scope 일관성 ────────────────────────────

describe("boundary↔scope 일관성 — boundary-relation.spec.md", () => {
  /** 스펙에서 정의한 5개 boundary의 패싯 분포 */
  const BOUNDARY_FACETS: Record<string, string[]> = {
    "qa-bridge": ["소비"],
    "feature-context": ["정의", "저장"],
    "handlers": ["소비", "관리", "생산"],
    "view": ["소비"],
    // page-root는 패싯 없음 — scope-nesting에서 생략 가능
  };

  const nesting: ScopeNesting = {
    nestingId: "playbook",
    scopes: [
      { scopeId: "qa-bridge", provides: [{ contractId: "logging-session", type: "logging" }], consumes: [], facets: ["소비"] },
      { scopeId: "feature-context", provides: [{ contractId: "playbook-state", type: "state" }, { contractId: "persist-adapter", type: "persist" }], consumes: [{ contractId: "logging-session", type: "logging" }], facets: ["정의", "저장"] },
      { scopeId: "handlers", provides: [{ contractId: "submission-handlers", type: "adapter" }], consumes: [{ contractId: "playbook-state", type: "state" }, { contractId: "logging-session", type: "logging" }], facets: ["소비", "관리", "생산"] },
      { scopeId: "view", provides: [], consumes: [{ contractId: "playbook-state", type: "state" }, { contractId: "submission-handlers", type: "adapter" }], facets: ["소비"] },
    ],
  };

  it("모든 scope가 boundary 정의와 일치하는 패싯을 가짐", () => {
    for (const scope of nesting.scopes) {
      const expected = BOUNDARY_FACETS[scope.scopeId];
      expect(expected).toBeDefined();
      expect(scope.facets).toEqual(expected);
    }
  });

  it("provides가 있는 scope는 정의/생산/저장/소비 패싯 중 하나 이상 보유", () => {
    for (const scope of nesting.scopes) {
      if (scope.provides.length > 0) {
        expect(scope.facets?.length).toBeGreaterThan(0);
      }
    }
  });

  it("consumes만 있는 scope는 소비 패싯 보유", () => {
    for (const scope of nesting.scopes) {
      if (scope.provides.length === 0 && scope.consumes.length > 0) {
        expect(scope.facets).toContain("소비");
      }
    }
  });

  it("nesting 구조가 유효", () => {
    const result = validateScopeNesting(nesting);
    expect(result.valid).toBe(true);
  });
});
