import { describe, expect, it } from "vitest";
import { createAnalysisPackageBoundary, RLSC_ANALYSIS_PACKAGE_NAME } from "./index.js";

describe("@qa-sdk/rlsc-analysis package boundary", () => {
  it("declares analysis ownership without visualization ownership", () => {
    expect(createAnalysisPackageBoundary()).toEqual({
      packageName: RLSC_ANALYSIS_PACKAGE_NAME,
      ownsScreenAnalysis: true,
      ownsVisualization: false,
    });
  });
});
