import { describe, it, expect } from "vitest";
import {
  validateScopeNesting,
  checkSwapSafety,
  type ScopeNesting,
  type ScopeContract,
} from "./scope-nesting.js";

// ── context-action 표준 fixture ──────────────────────

/** Vite+ playbook provider stack — 정상 순서 */
function createPlaybookNesting(): ScopeNesting {
  return {
    nestingId: "viteplus-playbook",
    scopes: [
      {
        scopeId: "qa-bridge",
        provides: [
          { contractId: "logging-session", type: "logging", shape: "QaBridgeFacade" },
        ],
        consumes: [],
        facets: ["소비"],
      },
      {
        scopeId: "feature-context",
        provides: [
          { contractId: "playbook-state", type: "state", shape: "PlaybookState" },
          { contractId: "persist-adapter", type: "persist" },
        ],
        consumes: [
          { contractId: "logging-session", type: "logging" },
        ],
        facets: ["정의", "저장"],
      },
      {
        scopeId: "handlers",
        provides: [
          { contractId: "submission-handlers", type: "adapter" },
        ],
        consumes: [
          { contractId: "playbook-state", type: "state" },
          { contractId: "logging-session", type: "logging" },
        ],
        facets: ["소비", "관리", "생산"],
      },
      {
        scopeId: "view",
        provides: [],
        consumes: [
          { contractId: "playbook-state", type: "state" },
          { contractId: "submission-handlers", type: "adapter" },
        ],
        facets: ["소비"],
      },
    ],
  };
}

describe("validateScopeNesting", () => {
  it("정상 nesting — 에러 없음", () => {
    const result = validateScopeNesting(createPlaybookNesting());
    expect(result.valid).toBe(true);
    expect(result.issues.filter(i => i.severity === "error")).toHaveLength(0);
  });

  it("정상 nesting — descent path가 모든 계약을 추적", () => {
    const result = validateScopeNesting(createPlaybookNesting());
    const contractIds = result.descentPaths.map(d => d.contractId).sort();
    expect(contractIds).toEqual([
      "logging-session",
      "persist-adapter",
      "playbook-state",
      "submission-handlers",
    ]);
  });

  it("logging-session은 qa-bridge가 제공하고 feature-context, handlers가 소비", () => {
    const result = validateScopeNesting(createPlaybookNesting());
    const loggingPath = result.descentPaths.find(d => d.contractId === "logging-session")!;
    expect(loggingPath.providedBy).toBe("qa-bridge");
    expect(loggingPath.consumedBy.sort()).toEqual(["feature-context", "handlers"]);
    expect(loggingPath.providerDepth).toBe(0);
  });

  it("provider가 없는 계약 소비 — missing-provider error", () => {
    const nesting = createPlaybookNesting();
    // view가 존재하지 않는 계약 소비
    nesting.scopes[3].consumes.push({ contractId: "nonexistent", type: "custom" });

    const result = validateScopeNesting(nesting);
    expect(result.valid).toBe(false);
    const missing = result.issues.find(
      i => i.code === "missing-provider" && i.contractId === "nonexistent",
    );
    expect(missing).toBeDefined();
    expect(missing!.scopeId).toBe("view");
  });

  it("provider가 하위에 있으면 — missing-provider error (순서 위반)", () => {
    const nesting = createPlaybookNesting();
    // qa-bridge(depth 0)와 feature-context(depth 1) 교환
    [nesting.scopes[0], nesting.scopes[1]] = [nesting.scopes[1], nesting.scopes[0]];

    const result = validateScopeNesting(nesting);
    expect(result.valid).toBe(false);
    // feature-context가 depth 0이 됨, logging-session 소비하는데 qa-bridge가 depth 1
    const orderIssue = result.issues.find(
      i => i.code === "missing-provider" && i.contractId === "logging-session" && i.scopeId === "feature-context",
    );
    expect(orderIssue).toBeDefined();
  });

  it("동일 계약 복수 제공 — duplicate-provider warning", () => {
    const nesting = createPlaybookNesting();
    // handlers도 logging-session 제공
    nesting.scopes[2].provides.push({ contractId: "logging-session", type: "logging" });

    const result = validateScopeNesting(nesting);
    const dup = result.issues.find(i => i.code === "duplicate-provider");
    expect(dup).toBeDefined();
    expect(dup!.severity).toBe("warning");
  });

  it("소비되지 않는 계약 — unused-contract warning", () => {
    const nesting = createPlaybookNesting();
    // persist-adapter를 아무도 소비하지 않음 — 이미 fixture에서 그러함
    const result = validateScopeNesting(nesting);
    const unused = result.issues.find(
      i => i.code === "unused-contract" && i.contractId === "persist-adapter",
    );
    expect(unused).toBeDefined();
    expect(unused!.severity).toBe("warning");
  });

  it("자기 제공 계약을 자기가 소비 — self-consume error", () => {
    const nesting: ScopeNesting = {
      nestingId: "self-consume-test",
      scopes: [
        {
          scopeId: "broken",
          provides: [{ contractId: "x", type: "state" }],
          consumes: [{ contractId: "x", type: "state" }],
        },
      ],
    };
    const result = validateScopeNesting(nesting);
    expect(result.valid).toBe(false);
    expect(result.issues[0].code).toBe("self-consume");
  });

  it("빈 스코프 — empty-scope warning", () => {
    const nesting: ScopeNesting = {
      nestingId: "empty-test",
      scopes: [
        { scopeId: "empty", provides: [], consumes: [] },
        { scopeId: "normal", provides: [{ contractId: "x", type: "state" }], consumes: [] },
      ],
    };
    const result = validateScopeNesting(nesting);
    const empty = result.issues.find(i => i.code === "empty-scope");
    expect(empty).toBeDefined();
    expect(empty!.scopeId).toBe("empty");
  });

  it("단일 스코프 — 제공만 하면 유효 (최외부)", () => {
    const nesting: ScopeNesting = {
      nestingId: "single",
      scopes: [
        { scopeId: "root", provides: [{ contractId: "ctx", type: "state" }], consumes: [] },
      ],
    };
    const result = validateScopeNesting(nesting);
    // unused warning만, error 없음
    expect(result.valid).toBe(true);
  });

  it("같은 depth의 provider는 상위가 아님 — error", () => {
    // A(depth 0)가 X 제공, B(depth 0은 불가하므로 depth 1)가 X 소비는 정상
    // 하지만 같은 depth에서 소비하면?
    // → providerMap은 먼저 등록된 것이 depth 정보를 가짐
    // depth가 같으면 provider.depth >= consumer depth이므로 error
    const nesting: ScopeNesting = {
      nestingId: "same-depth",
      scopes: [
        {
          scopeId: "first",
          provides: [],
          consumes: [{ contractId: "x", type: "state" }],
        },
        {
          scopeId: "second",
          provides: [{ contractId: "x", type: "state" }],
          consumes: [],
        },
      ],
    };
    const result = validateScopeNesting(nesting);
    expect(result.valid).toBe(false);
    const issue = result.issues.find(i => i.code === "missing-provider");
    expect(issue).toBeDefined();
  });
});

describe("checkSwapSafety", () => {
  it("qa-bridge ↔ feature-context 교환 — 계약 깨짐", () => {
    const nesting = createPlaybookNesting();
    const errors = checkSwapSafety(nesting, 0, 1);
    expect(errors).not.toBeNull();
    expect(errors!.length).toBeGreaterThan(0);
  });

  it("handlers ↔ view 교환 — 계약 깨짐 (view가 handlers 제공 계약 소비)", () => {
    const nesting = createPlaybookNesting();
    const errors = checkSwapSafety(nesting, 2, 3);
    expect(errors).not.toBeNull();
    // view(depth 2)가 submission-handlers를 소비하는데 handlers(depth 3)가 제공 → 상위 아님
    const handlerIssue = errors!.find(i => i.contractId === "submission-handlers");
    expect(handlerIssue).toBeDefined();
  });

  it("독립적인 스코프 교환 — 안전", () => {
    const nesting: ScopeNesting = {
      nestingId: "independent",
      scopes: [
        { scopeId: "root", provides: [{ contractId: "a", type: "state" }], consumes: [] },
        { scopeId: "mid-1", provides: [{ contractId: "b", type: "state" }], consumes: [{ contractId: "a", type: "state" }] },
        { scopeId: "mid-2", provides: [{ contractId: "c", type: "state" }], consumes: [{ contractId: "a", type: "state" }] },
        { scopeId: "leaf", provides: [], consumes: [{ contractId: "b", type: "state" }, { contractId: "c", type: "state" }] },
      ],
    };
    // mid-1과 mid-2는 서로 의존하지 않으므로 교환 안전
    const errors = checkSwapSafety(nesting, 1, 2);
    expect(errors).toBeNull();
  });
});
