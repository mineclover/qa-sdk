import { describe, expect, it } from "vitest";
import {
  buildClaimStateKey,
  deriveDefinitionState,
  deriveImplementationState,
  deriveReviewState,
  deriveRuntimeState,
  deriveTestState,
  deriveVerificationClaim,
} from "./verification-claim.js";

describe("verification-claim state derivation", () => {
  it("definition은 declared → structured → linked 순으로 승격된다", () => {
    expect(deriveDefinitionState()).toBe("missing");
    expect(deriveDefinitionState({ declared: true })).toBe("declared");
    expect(deriveDefinitionState({ declared: true, structured: true })).toBe("structured");
    expect(deriveDefinitionState({ declared: true, structured: true, linked: true })).toBe("linked");
  });

  it("implementation은 binding 대비 구현 수로 none/partial/implemented를 계산한다", () => {
    expect(deriveImplementationState()).toBe("none");
    expect(deriveImplementationState({ bindings: ["a"] })).toBe("partial");
    expect(deriveImplementationState({ bindings: ["a", "b"], implementedBindings: ["a"] })).toBe("partial");
    expect(deriveImplementationState({ bindings: ["a"], implementedBindings: ["a"] })).toBe("implemented");
  });

  it("test는 evidence가 우선이며 fail이 pass를 덮는다", () => {
    expect(deriveTestState()).toBe("none");
    expect(deriveTestState({ bindings: ["test/a.test.ts"] })).toBe("mapped");
    expect(deriveTestState({
      bindings: ["test/a.test.ts"],
      evidences: [{ specId: "s", status: "pass", source: "test", timestamp: "2026-03-29T00:00:00Z" }],
    })).toBe("passing");
    expect(deriveTestState({
      bindings: ["test/a.test.ts"],
      evidences: [
        { specId: "s", status: "pass", source: "test", timestamp: "2026-03-29T00:00:00Z" },
        { specId: "s", status: "fail", source: "test", timestamp: "2026-03-29T00:00:01Z" },
      ],
    })).toBe("failing");
  });

  it("runtime/review 상태를 단순 승격 규칙으로 계산한다", () => {
    expect(deriveRuntimeState()).toBe("none");
    expect(deriveRuntimeState({ observable: true })).toBe("observable");
    expect(deriveRuntimeState({ observed: true })).toBe("observed");
    expect(deriveReviewState()).toBe("none");
    expect(deriveReviewState({ reviewed: true })).toBe("reviewed");
    expect(deriveReviewState({ accepted: true })).toBe("accepted");
  });
});

describe("deriveVerificationClaim", () => {
  const claim = {
    claimId: "claim-1",
    specId: "gate-api",
    subjectRef: "endpoint:/docs/:id",
    marker: "inputs" as const,
    text: "GET /docs/:id는 docId 입력을 받는다",
  };

  it("문서만 있으면 declared", () => {
    const snapshot = deriveVerificationClaim({
      claim,
      definition: { declared: true },
    });

    expect(snapshot.compositeState).toBe("declared");
    expect(snapshot.missing).toContain("구현 바인딩");
    expect(snapshot.missing).toContain("테스트 매핑");
  });

  it("구현/테스트 binding이 있으면 bound", () => {
    const snapshot = deriveVerificationClaim({
      claim,
      definition: { declared: true, structured: true },
      implementation: { bindings: ["packages/definition-service/src/modules/docs/docs.controller.ts"] },
      testing: { bindings: ["packages/definition-service/test/docs.e2e.test.ts"] },
    });

    expect(snapshot.compositeState).toBe("bound");
    expect(snapshot.definitionState).toBe("structured");
    expect(snapshot.stateKey).toBe(buildClaimStateKey(snapshot));
  });

  it("pass evidence 또는 runtime observed가 있으면 exercised", () => {
    const snapshot = deriveVerificationClaim({
      claim,
      definition: { declared: true, structured: true, linked: true },
      implementation: {
        bindings: ["controller"],
        implementedBindings: ["controller"],
      },
      testing: {
        bindings: ["docs.e2e.test.ts"],
        evidences: [{ specId: "gate-api", status: "pass", source: "test", timestamp: "2026-03-29T00:00:00Z" }],
      },
    });

    expect(snapshot.compositeState).toBe("exercised");
  });

  it("linked + implemented + exercised + accepted면 verified", () => {
    const snapshot = deriveVerificationClaim({
      claim,
      definition: { declared: true, structured: true, linked: true },
      implementation: {
        bindings: ["controller"],
        implementedBindings: ["controller"],
      },
      testing: {
        bindings: ["docs.e2e.test.ts"],
        evidences: [{ specId: "gate-api", status: "pass", source: "test", timestamp: "2026-03-29T00:00:00Z" }],
      },
      runtime: { observed: true },
      review: { accepted: true },
    });

    expect(snapshot.compositeState).toBe("verified");
    expect(snapshot.missing).not.toContain("리뷰 승인");
  });

  it("실패 증거가 있으면 contradicted", () => {
    const snapshot = deriveVerificationClaim({
      claim,
      definition: { declared: true, structured: true, linked: true },
      implementation: {
        bindings: ["controller"],
        implementedBindings: ["controller"],
      },
      testing: {
        bindings: ["docs.e2e.test.ts"],
        evidences: [{ specId: "gate-api", status: "fail", source: "test", timestamp: "2026-03-29T00:00:00Z" }],
      },
    });

    expect(snapshot.compositeState).toBe("contradicted");
    expect(snapshot.blockers).toContain("실패한 검증 증거 존재");
  });

  it("stale 플래그가 있으면 stale이 최우선이다", () => {
    const snapshot = deriveVerificationClaim({
      claim,
      definition: { declared: true, structured: true, linked: true, stale: true },
      implementation: {
        bindings: ["controller"],
        implementedBindings: ["controller"],
      },
      testing: {
        bindings: ["docs.e2e.test.ts"],
        evidences: [{ specId: "gate-api", status: "pass", source: "test", timestamp: "2026-03-29T00:00:00Z" }],
      },
      runtime: { observed: true },
      review: { accepted: true },
    });

    expect(snapshot.compositeState).toBe("stale");
  });
});
