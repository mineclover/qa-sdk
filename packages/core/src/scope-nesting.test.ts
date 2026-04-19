// @def.boundary qa-sdk-core-system
// @def.doc qa-sdk-core-system

import { describe, it, expect } from "vitest";
import {
  validateScopeNesting,
  checkSwapSafety,
  resolveGuards,
  resolveContracts,
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

// ── L0 guard 테스트 ──────────────────────────────────

describe("L0 SimulationGuards", () => {
  it("guard 미주입 — fail-open, 기존 결과와 동일", () => {
    const withoutGuards = validateScopeNesting(createPlaybookNesting());
    const withGuards = validateScopeNesting(createPlaybookNesting(), {});
    expect(withGuards.valid).toBe(withoutGuards.valid);
    expect(withGuards.descentPaths.length).toBe(withoutGuards.descentPaths.length);
  });

  it("isEncodable false — 해당 계약 비활성 + 하위 missing-provider", () => {
    const nesting = createPlaybookNesting();
    const result = validateScopeNesting(nesting, {
      // logging-session을 비활성화
      isEncodable: (contractId) => contractId !== "logging-session",
    });

    // logging-session이 비활성 → guard-inactive warning
    const guardIssue = result.issues.find(
      i => i.code === "guard-inactive" && i.contractId === "logging-session",
    );
    expect(guardIssue).toBeDefined();

    // feature-context, handlers가 logging-session 소비 → missing-provider error
    const missingErrors = result.issues.filter(
      i => i.code === "missing-provider" && i.contractId === "logging-session",
    );
    expect(missingErrors.length).toBeGreaterThanOrEqual(2);
    expect(result.valid).toBe(false);
  });

  it("isEncodable 전부 true — guard 영향 없음", () => {
    const result = validateScopeNesting(createPlaybookNesting(), {
      isEncodable: () => true,
    });
    expect(result.valid).toBe(true);
    expect(result.issues.filter(i => i.code === "guard-inactive")).toHaveLength(0);
  });

  it("isEncodable 특정 계약만 비활성 — 해당 하위만 영향", () => {
    const nesting = createPlaybookNesting();
    const result = validateScopeNesting(nesting, {
      // submission-handlers만 비활성
      isEncodable: (contractId) => contractId !== "submission-handlers",
    });

    // handlers의 submission-handlers가 비활성
    const guardIssue = result.issues.find(
      i => i.code === "guard-inactive" && i.contractId === "submission-handlers",
    );
    expect(guardIssue).toBeDefined();

    // view가 submission-handlers 소비 → missing-provider
    const viewError = result.issues.find(
      i => i.code === "missing-provider" && i.scopeId === "view" && i.contractId === "submission-handlers",
    );
    expect(viewError).toBeDefined();

    // logging-session, playbook-state는 영향 없음
    expect(result.issues.filter(i => i.contractId === "logging-session" && i.code === "guard-inactive")).toHaveLength(0);
  });

  it("guard-inactive + optional consume — warning 2건, valid 유지", () => {
    const nesting: ScopeNesting = {
      nestingId: "guard-optional",
      scopes: [
        { scopeId: "bridge", provides: [{ contractId: "logging", type: "logging" }], consumes: [] },
        { scopeId: "handler", provides: [], consumes: [
          { contractId: "logging", type: "logging", required: false },
        ] },
      ],
    };
    const result = validateScopeNesting(nesting, {
      isEncodable: (c) => c !== "logging",
    });
    expect(result.valid).toBe(true);
    // guard-inactive + optional-missing 두 건
    expect(result.issues.filter(i => i.code === "guard-inactive")).toHaveLength(1);
    expect(result.issues.filter(i => i.code === "optional-missing")).toHaveLength(1);
  });

  it("gateResult / harnessState — resolveGuards에서 기본값 제공", () => {
    // 현재 gateResult/harnessState는 validateScopeNesting 내부에서 직접 사용하지 않음
    // resolveGuards가 기본값을 제공하는지만 확인
    const resolved = resolveGuards({ isEncodable: () => false });
    expect(resolved.gateResult("any")).toBe("pass");
    expect(resolved.harnessState("any")).toBe("active");
    expect(resolved.isEncodable("any")).toBe(false);
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

// ── Provider Override 테스트 ─────────────────────────

describe("provider override", () => {
  it("override: true — 상위 provider를 대체, duplicate-provider 없음", () => {
    const nesting: ScopeNesting = {
      nestingId: "override-test",
      scopes: [
        { scopeId: "parent", provides: [{ contractId: "state", type: "state" }], consumes: [] },
        { scopeId: "child", provides: [{ contractId: "state", type: "state", override: true }], consumes: [] },
        { scopeId: "leaf", provides: [], consumes: [{ contractId: "state", type: "state" }] },
      ],
    };
    const result = validateScopeNesting(nesting);
    expect(result.valid).toBe(true);
    // duplicate-provider warning 없어야 함
    expect(result.issues.filter(i => i.code === "duplicate-provider")).toHaveLength(0);
    // leaf의 provider는 child
    const path = result.descentPaths.find(d => d.contractId === "state")!;
    expect(path.providedBy).toBe("child");
  });

  it("override: false — duplicate-provider warning 발생", () => {
    const nesting: ScopeNesting = {
      nestingId: "no-override",
      scopes: [
        { scopeId: "parent", provides: [{ contractId: "x", type: "state" }], consumes: [] },
        { scopeId: "child", provides: [{ contractId: "x", type: "state" }], consumes: [] },
        { scopeId: "leaf", provides: [], consumes: [{ contractId: "x", type: "state" }] },
      ],
    };
    const result = validateScopeNesting(nesting);
    expect(result.issues.some(i => i.code === "duplicate-provider")).toBe(true);
  });

  it("override: true + 상위에 대상 없음 — override-no-parent warning", () => {
    const nesting: ScopeNesting = {
      nestingId: "override-orphan",
      scopes: [
        { scopeId: "root", provides: [{ contractId: "x", type: "state", override: true }], consumes: [] },
      ],
    };
    const result = validateScopeNesting(nesting);
    const issue = result.issues.find(i => i.code === "override-no-parent");
    expect(issue).toBeDefined();
    expect(issue!.scopeId).toBe("root");
  });

  // I2: DescentPath 교체 상세 — 3-depth override
  it("override — 3-depth에서 중간이 override하면 최하위는 중간 provider를 봄", () => {
    const nesting: ScopeNesting = {
      nestingId: "3-depth-override",
      scopes: [
        { scopeId: "grandparent", provides: [{ contractId: "x", type: "state" }], consumes: [] },
        { scopeId: "parent", provides: [{ contractId: "x", type: "state", override: true }], consumes: [] },
        { scopeId: "child", provides: [], consumes: [{ contractId: "x", type: "state" }] },
      ],
    };
    const result = validateScopeNesting(nesting);
    expect(result.valid).toBe(true);

    const path = result.descentPaths.find(d => d.contractId === "x")!;
    expect(path.providedBy).toBe("parent");
    expect(path.providerDepth).toBe(1);
  });

  it("override 후 상위 provider의 unused-contract — grandparent의 x가 미소비", () => {
    const nesting: ScopeNesting = {
      nestingId: "override-unused",
      scopes: [
        { scopeId: "grandparent", provides: [{ contractId: "x", type: "state" }], consumes: [] },
        { scopeId: "parent", provides: [{ contractId: "x", type: "state", override: true }], consumes: [] },
        { scopeId: "child", provides: [], consumes: [{ contractId: "x", type: "state" }] },
      ],
    };
    const result = validateScopeNesting(nesting);
    // grandparent의 x는 override로 대체되어 직접 소비자가 없음
    // 하지만 buildProviderMap에서 override가 대체하면 grandparent의 x는 providerMap에서 제거됨
    // → unused-contract가 grandparent에서 발생하지 않음 (providerMap에 없으므로)
    // 이 동작이 의도적인지 확인
    expect(result.valid).toBe(true);
  });
});

// ── Procedure 통합 테스트 ────────────────────────────

describe("procedure — scope 추가/변경/제거 절차", () => {
  it("추가 — 올바른 위치에 새 scope 삽입 → valid", () => {
    const nesting = createPlaybookNesting();
    // handlers와 view 사이에 새 scope 삽입 (handlers의 계약 소비)
    const extended: ScopeNesting = {
      ...nesting,
      scopes: [
        ...nesting.scopes.slice(0, 3),
        {
          scopeId: "middleware",
          provides: [{ contractId: "middleware-result", type: "adapter" }],
          consumes: [{ contractId: "submission-handlers", type: "adapter" }],
        },
        nesting.scopes[3], // view
      ],
    };
    const result = validateScopeNesting(extended);
    expect(result.valid).toBe(true);
  });

  it("추가 — 잘못된 위치(provider보다 상위)에 삽입 → missing-provider error", () => {
    const nesting = createPlaybookNesting();
    // playbook-state를 소비하는 scope를 feature-context 앞에 삽입
    const wrongPosition: ScopeNesting = {
      ...nesting,
      scopes: [
        nesting.scopes[0], // qa-bridge
        {
          scopeId: "early-consumer",
          provides: [],
          consumes: [{ contractId: "playbook-state", type: "state" }],
        },
        ...nesting.scopes.slice(1),
      ],
    };
    const result = validateScopeNesting(wrongPosition);
    expect(result.valid).toBe(false);
    expect(result.issues.some(
      i => i.code === "missing-provider" && i.scopeId === "early-consumer",
    )).toBe(true);
  });

  it("순서 변경 — 안전한 교환 후 mount flow 재검증 통과", () => {
    // mid-1과 mid-2가 독립인 nesting
    const nesting: ScopeNesting = {
      nestingId: "swap-procedure",
      scopes: [
        { scopeId: "root", provides: [{ contractId: "a", type: "state" }], consumes: [] },
        { scopeId: "mid-1", provides: [{ contractId: "b", type: "state" }], consumes: [{ contractId: "a", type: "state" }] },
        { scopeId: "mid-2", provides: [{ contractId: "c", type: "state" }], consumes: [{ contractId: "a", type: "state" }] },
        { scopeId: "leaf", provides: [], consumes: [{ contractId: "b", type: "state" }, { contractId: "c", type: "state" }] },
      ],
    };
    // 안전성 확인
    const errors = checkSwapSafety(nesting, 1, 2);
    expect(errors).toBeNull();

    // 교환 적용
    const swapped: ScopeNesting = {
      ...nesting,
      scopes: [nesting.scopes[0], nesting.scopes[2], nesting.scopes[1], nesting.scopes[3]],
    };
    const result = validateScopeNesting(swapped);
    expect(result.valid).toBe(true);
  });

  it("제거 — qa-bridge 제거 시 descentPaths.consumedBy로 영향 파악", () => {
    const nesting = createPlaybookNesting();
    const result = validateScopeNesting(nesting);
    const loggingPath = result.descentPaths.find(d => d.contractId === "logging-session")!;

    // 영향받는 scope 확인
    expect(loggingPath.consumedBy).toContain("feature-context");
    expect(loggingPath.consumedBy).toContain("handlers");

    // 제거 후 검증
    const withoutBridge: ScopeNesting = {
      ...nesting,
      scopes: nesting.scopes.filter(s => s.scopeId !== "qa-bridge"),
    };
    const afterRemoval = validateScopeNesting(withoutBridge);
    expect(afterRemoval.valid).toBe(false);
    expect(afterRemoval.issues.filter(
      i => i.code === "missing-provider" && i.contractId === "logging-session",
    ).length).toBeGreaterThanOrEqual(2);
  });
});

// ── Optional Consume 테스트 ──────────────────────────

describe("optional consume", () => {
  it("required: false + provider 없음 — optional-missing warning (valid)", () => {
    const nesting: ScopeNesting = {
      nestingId: "optional-test",
      scopes: [
        { scopeId: "handler", provides: [], consumes: [
          { contractId: "logging", type: "logging", required: false },
        ] },
      ],
    };
    const result = validateScopeNesting(nesting);
    expect(result.valid).toBe(true); // error 아님
    const issue = result.issues.find(i => i.code === "optional-missing");
    expect(issue).toBeDefined();
    expect(issue!.contractId).toBe("logging");
  });

  it("required: true (기본) + provider 없음 — missing-provider error", () => {
    const nesting: ScopeNesting = {
      nestingId: "required-test",
      scopes: [
        { scopeId: "handler", provides: [], consumes: [
          { contractId: "logging", type: "logging" }, // required 미설정 = true
        ] },
      ],
    };
    const result = validateScopeNesting(nesting);
    expect(result.valid).toBe(false);
    expect(result.issues.some(i => i.code === "missing-provider")).toBe(true);
  });

  it("required: false + provider 있음 — 정상 (optional 아닌 것처럼 동작)", () => {
    const nesting: ScopeNesting = {
      nestingId: "optional-with-provider",
      scopes: [
        { scopeId: "bridge", provides: [{ contractId: "logging", type: "logging" }], consumes: [] },
        { scopeId: "handler", provides: [], consumes: [
          { contractId: "logging", type: "logging", required: false },
        ] },
      ],
    };
    const result = validateScopeNesting(nesting);
    expect(result.valid).toBe(true);
    expect(result.issues.filter(i => i.code === "optional-missing")).toHaveLength(0);
  });

  it("playbook nesting에서 logging을 optional로 — qa-bridge 없어도 valid", () => {
    const nesting: ScopeNesting = {
      nestingId: "playbook-optional-logging",
      scopes: [
        // qa-bridge 생략
        {
          scopeId: "feature-context",
          provides: [{ contractId: "playbook-state", type: "state" }],
          consumes: [{ contractId: "logging-session", type: "logging", required: false }],
        },
        {
          scopeId: "handlers",
          provides: [{ contractId: "submission-handlers", type: "adapter" }],
          consumes: [
            { contractId: "playbook-state", type: "state" },
            { contractId: "logging-session", type: "logging", required: false },
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
    const result = validateScopeNesting(nesting);
    expect(result.valid).toBe(true);
    // optional-missing warning 2건 (feature-context, handlers)
    const optionalIssues = result.issues.filter(i => i.code === "optional-missing");
    expect(optionalIssues.length).toBe(2);
  });
});

// ── resolveContracts 테스트 ──────────────────────────

describe("resolveContracts", () => {
  it("handler의 계약 provider를 정확히 조회", () => {
    const resolved = resolveContracts(createPlaybookNesting(), "handlers");
    expect(resolved).toHaveLength(2);

    const state = resolved.find(r => r.contractId === "playbook-state")!;
    expect(state.provider?.scopeId).toBe("feature-context");
    expect(state.optional).toBe(false);

    const logging = resolved.find(r => r.contractId === "logging-session")!;
    expect(logging.provider?.scopeId).toBe("qa-bridge");
  });

  it("view의 계약 provider를 정확히 조회", () => {
    const resolved = resolveContracts(createPlaybookNesting(), "view");
    const handlers = resolved.find(r => r.contractId === "submission-handlers")!;
    expect(handlers.provider?.scopeId).toBe("handlers");
  });

  it("override 반영 — child가 대체하면 overridden: true", () => {
    const nesting: ScopeNesting = {
      nestingId: "resolve-override",
      scopes: [
        { scopeId: "parent", provides: [{ contractId: "x", type: "state" }], consumes: [] },
        { scopeId: "child", provides: [{ contractId: "x", type: "state", override: true }], consumes: [] },
        { scopeId: "leaf", provides: [], consumes: [{ contractId: "x", type: "state" }] },
      ],
    };
    const resolved = resolveContracts(nesting, "leaf");
    const x = resolved.find(r => r.contractId === "x")!;
    expect(x.provider?.scopeId).toBe("child");
    expect(x.overridden).toBe(true);
  });

  it("optional + provider 없음 — optional: true", () => {
    const nesting: ScopeNesting = {
      nestingId: "resolve-optional",
      scopes: [
        { scopeId: "handler", provides: [], consumes: [
          { contractId: "logging", type: "logging", required: false },
        ] },
      ],
    };
    const resolved = resolveContracts(nesting, "handler");
    const logging = resolved.find(r => r.contractId === "logging")!;
    expect(logging.provider).toBeNull();
    expect(logging.optional).toBe(true);
  });

  it("존재하지 않는 scopeId — 빈 배열", () => {
    const resolved = resolveContracts(createPlaybookNesting(), "nonexistent");
    expect(resolved).toHaveLength(0);
  });
});
