// @def.boundary spec-engine-system
// @def.doc spec-engine-system

import { describe, expect, it } from "vitest";
import { generateVerificationClaimReport } from "./claim-report.js";

describe("generateVerificationClaimReport", () => {
  it("composite state별 개수를 집계한다", () => {
    const report = generateVerificationClaimReport([
      {
        claim: {
          claimId: "c1",
          specId: "gate-api",
          subjectRef: "endpoint:/check",
          text: "prefix는 필수다",
          marker: "inputs",
        },
        definition: { declared: true },
      },
      {
        claim: {
          claimId: "c2",
          specId: "gate-api",
          subjectRef: "endpoint:/check",
          text: "state를 반환한다",
          marker: "outputs",
        },
        definition: { declared: true, structured: true, linked: true },
        implementation: { bindings: ["controller"], implementedBindings: ["controller"] },
        testing: {
          bindings: ["gate-api.test.ts"],
          evidences: [{ specId: "gate-api", status: "pass", source: "test", timestamp: "2026-03-29T00:00:00Z" }],
        },
        review: { accepted: true },
      },
      {
        claim: {
          claimId: "c3",
          specId: "gate-api",
          subjectRef: "endpoint:/check",
          text: "invalid input이면 실패한다",
          marker: "failure",
        },
        definition: { declared: true, structured: true, linked: true },
        testing: {
          bindings: ["gate-api.test.ts"],
          evidences: [{ specId: "gate-api", status: "fail", source: "test", timestamp: "2026-03-29T00:00:00Z" }],
        },
      },
    ]);

    expect(report.snapshots).toHaveLength(3);
    expect(report.counts.find((row) => row.state === "declared")!.count).toBe(1);
    expect(report.counts.find((row) => row.state === "verified")!.count).toBe(1);
    expect(report.counts.find((row) => row.state === "contradicted")!.count).toBe(1);
  });
});
