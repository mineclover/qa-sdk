import { describe, expect, it } from "vitest";
import {
  classifyHarnessDocRole,
  deriveHarnessState,
} from "./harness-model.js";

describe("harness-model", () => {
  it("번들/계약/게이트 문서를 역할로 분류한다", () => {
    expect(classifyHarnessDocRole({
      id: "bundle",
      scope: "flow",
      aspect: "process_flow",
      depth: "overview",
      tags: ["quality-bundle"],
    })).toBe("concept");

    expect(classifyHarnessDocRole({
      id: "contract",
      scope: "interface",
      aspect: "api_contract",
      depth: "specification",
    })).toBe("contract");

    expect(classifyHarnessDocRole({
      id: "gate",
      scope: "constraint",
      aspect: "tech_constraint",
      depth: "validation",
      gate: { kind: "build" },
    })).toBe("gate");
  });

  it("문서만 있으면 gate-bound까지 상태를 도출한다", () => {
    const snapshot = deriveHarnessState([
      {
        id: "bundle",
        scope: "flow",
        aspect: "process_flow",
        depth: "overview",
        tags: ["quality-bundle"],
      },
      {
        id: "contract",
        scope: "interface",
        aspect: "api_contract",
        depth: "specification",
      },
      {
        id: "gate",
        scope: "constraint",
        aspect: "tech_constraint",
        depth: "validation",
        gate: { kind: "build" },
      },
    ]);

    expect(snapshot.current).toBe("gate-bound");
    expect(snapshot.next).toBe("verified");
    expect(snapshot.missing).toContain("게이트 실행 증거");
  });
});
