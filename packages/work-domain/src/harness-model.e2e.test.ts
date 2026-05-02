// @def.boundary shared-utility-group
// @def.doc shared-utility-group

import { describe, it, expect } from "vitest";
import { deriveHarnessState } from "./harness-model.js";
import type { HarnessBundleDoc } from "./harness-model.js";

// concept 문서: tags에 quality-bundle 포함
const conceptDoc: HarnessBundleDoc = {
  id: "concept-bundle",
  scope: "flow",
  aspect: "checkout",
  depth: "overview",
  tags: ["quality-bundle"],
};

// contract 문서: scope=interface
const contractDoc: HarnessBundleDoc = {
  id: "contract-checkout",
  scope: "interface",
  aspect: "checkout",
  depth: "spec",
};

// gate 문서: gate 필드 존재
const gateDoc: HarnessBundleDoc = {
  id: "gate-checkout",
  scope: "constraint",
  aspect: "checkout",
  depth: "validation",
  gate: { type: "unit", threshold: 80 },
};

describe("concept-defined → verified 전이 검증", () => {
  it("concept-defined → verified 전이: 문서를 하나씩 추가할 때 상태가 순서대로 진행", () => {
    const step0 = deriveHarnessState([]);
    expect(step0.current).toBe("concept-defined");
    expect(step0.reached).not.toContain("concept-defined");

    const step1 = deriveHarnessState([conceptDoc]);
    expect(step1.current).toBe("concept-defined");
    expect(step1.reached).toContain("concept-defined");

    const step2 = deriveHarnessState([conceptDoc, contractDoc]);
    expect(step2.current).toBe("contract-bound");
    expect(step2.reached).toContain("concept-defined");
    expect(step2.reached).toContain("contract-bound");

    const step3 = deriveHarnessState([conceptDoc, contractDoc, gateDoc]);
    expect(step3.current).toBe("gate-bound");
    expect(step3.reached).toContain("gate-bound");

    const step4 = deriveHarnessState([conceptDoc, contractDoc, gateDoc], { verified: true });
    expect(step4.current).toBe("verified");
    expect(step4.reached).toContain("verified");
  });

  it("concept만 있을 때 missing에 계약 문서 관련 항목이 포함됨", () => {
    const result = deriveHarnessState([conceptDoc]);
    expect(result.missing).toContain("인터페이스 계약 문서");
    expect(result.missing).not.toContain("개념 번들 문서");
  });

  it("verified 상태에서 next는 undefined (종단 상태)", () => {
    const result = deriveHarnessState([conceptDoc, contractDoc, gateDoc], { verified: true });
    expect(result.next).toBeUndefined();
    expect(result.current).toBe("verified");
  });
});
